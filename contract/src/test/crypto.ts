// Off-chain crypto for MatchLock, built on the runtime's own primitives so an
// ECDH shared secret computed here is identical to the one derived in-circuit.
// Handles what Compact can't: key generation, PK derivation, ECDH, and AES-GCM
// encryption of the reveal payload into the fixed-size blob the ledger stores.

import {
  ecMul,
  ecMulGenerator,
  convertFieldToBytes,
} from "@midnight-ntwrk/compact-runtime";

export type Point = { x: bigint; y: bigint };

/** Fixed on-chain ciphertext width (must equal Bytes<N> in the contract). */
export const CIPHERTEXT_BYTES = 128;
const IV_BYTES = 12;
export const MAX_PAYLOAD_BYTES = CIPHERTEXT_BYTES - IV_BYTES - 16; // minus GCM tag

/**
 * Random non-zero Jubjub scalar. The Jubjub scalar field (~2^252) is smaller
 * than the base Field, and a too-large value fails WASM decoding as EmbeddedFr;
 * 248 random bits are always in range with ample entropy.
 */
export const randomScalar = (): bigint => {
  const bytes = new Uint8Array(31);
  let n = 0n;
  do {
    crypto.getRandomValues(bytes);
    n = bytes.reduce((acc, b) => (acc << 8n) | BigInt(b), 0n);
  } while (n === 0n);
  return n;
};

/** PK = sk * G. */
export const publicKey = (sk: bigint): Point => ecMulGenerator(sk);

/** ECDH shared secret point (symmetric: sk_A*PK_B == sk_B*PK_A). */
export const sharedSecret = (sk: bigint, target: Point): Point =>
  ecMul(target, sk);

const deriveAesKey = async (shared: Point): Promise<CryptoKey> => {
  const material = new Uint8Array(64);
  material.set(convertFieldToBytes(32, shared.x, "crypto.ts"), 0);
  material.set(convertFieldToBytes(32, shared.y, "crypto.ts"), 32);
  const digest = await crypto.subtle.digest("SHA-256", material);
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
};

/** Encrypt a short payload into [ IV | ciphertext+tag | zero pad | length ]. */
export const encryptPayload = async (
  shared: Point,
  payload: string,
): Promise<Uint8Array> => {
  const plaintext = new TextEncoder().encode(payload);
  if (plaintext.length > MAX_PAYLOAD_BYTES) {
    throw new Error(
      `payload too long: ${plaintext.length} > ${MAX_PAYLOAD_BYTES} bytes`,
    );
  }
  const key = await deriveAesKey(shared);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext),
  );
  const blob = new Uint8Array(CIPHERTEXT_BYTES);
  blob.set(iv, 0);
  blob.set(ct, IV_BYTES);
  blob[CIPHERTEXT_BYTES - 1] = ct.length; // where the padding starts
  return blob;
};

/** Decrypt the on-chain blob back to the UTF-8 payload. */
export const decryptPayload = async (
  shared: Point,
  blob: Uint8Array,
): Promise<string> => {
  const key = await deriveAesKey(shared);
  const iv = blob.slice(0, IV_BYTES);
  const ctLen = blob[CIPHERTEXT_BYTES - 1];
  const ct = blob.slice(IV_BYTES, IV_BYTES + ctLen);
  const plaintext = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct),
  );
  return new TextDecoder().decode(plaintext);
};
