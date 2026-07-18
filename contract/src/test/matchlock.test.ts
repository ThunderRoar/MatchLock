// MatchLock contract unit tests (in-process simulator, no network).
//
// Gate criteria from the build plan:
//   - two independent posts under one `link` flip the slot to matched
//   - a one-sided post reveals nothing linkable and never matches
//   - a per-direction replay is rejected by the nullifier
// Plus: the ECDH shared secret is symmetric, so each side can decrypt the
// other's reveal payload.

import { MatchLockSimulator } from "./matchlock-simulator.js";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { convertFieldToBytes } from "@midnight-ntwrk/compact-runtime";
import { describe, it, expect } from "vitest";
import {
  publicKey,
  sharedSecret,
  encryptPayload,
  decryptPayload,
  randomScalar,
  type Point,
} from "../crypto.js";

setNetworkId("undeployed");

const filler = new Uint8Array(128); // placeholder ciphertext where content is irrelevant

describe("MatchLock smart contract", () => {
  it("registers a user, publishes their public key, and bumps the count", () => {
    const sk = randomScalar();
    const sim = new MatchLockSimulator(sk);
    const id = sim.register();

    const l = sim.getLedger();
    expect(l.registrantCount).toEqual(1n);
    expect(l.registry.member(id)).toBe(true);

    // The published coordinates match the off-chain public key (compared via the
    // same Field->Bytes conversion the circuit uses, so endianness lines up).
    const pk = publicKey(sk);
    const stored = l.registry.lookup(id);
    expect(Uint8Array.from(stored.x)).toEqual(convertFieldToBytes(32, pk.x, "test"));
    expect(Uint8Array.from(stored.y)).toEqual(convertFieldToBytes(32, pk.y, "test"));
  });

  it("rejects double registration", () => {
    const sim = new MatchLockSimulator(randomScalar());
    sim.register();
    expect(() => sim.register()).toThrow("already registered");
  });

  it("unlocks a mutual match: same link, count == 2, cross-decryptable", async () => {
    const skA = randomScalar();
    const skB = randomScalar();
    const pkA = publicKey(skA);
    const pkB = publicKey(skB);

    const sim = new MatchLockSimulator(skA);
    sim.register();
    sim.switchUser(skB);
    sim.register();

    // A -> B
    const secretAB: Point = sharedSecret(skA, pkB);
    const cipherA = await encryptPayload(secretAB, "Acme: term sheet ref #A-7788");
    sim.switchUser(skA);
    const linkA = sim.expressInterest(pkB.x, pkB.y, cipherA);

    let l = sim.getLedger();
    expect(l.slotCount.lookup(linkA)).toEqual(1n);
    expect(l.slotCipherA.member(linkA)).toBe(true);
    expect(l.slotCipherB.member(linkA)).toBe(false);

    // B -> A: B independently derives the same shared secret and points back.
    const secretBA: Point = sharedSecret(skB, pkA);
    expect(secretBA).toEqual(secretAB); // ECDH symmetry
    const cipherB = await encryptPayload(secretBA, "Beta Capital: yes, contact ir@beta.example");
    sim.switchUser(skB);
    const linkB = sim.expressInterest(pkA.x, pkA.y, cipherB);

    expect(linkB).toEqual(linkA); // same slot -> matched
    l = sim.getLedger();
    expect(l.slotCount.lookup(linkA)).toEqual(2n);
    expect(l.slotCipherA.member(linkA)).toBe(true);
    expect(l.slotCipherB.member(linkA)).toBe(true);

    // Each side decrypts the other's payload.
    const aReadsB = await decryptPayload(secretAB, l.slotCipherB.lookup(linkA));
    const bReadsA = await decryptPayload(secretBA, l.slotCipherA.lookup(linkA));
    expect(aReadsB).toEqual("Beta Capital: yes, contact ir@beta.example");
    expect(bReadsA).toEqual("Acme: term sheet ref #A-7788");
  });

  it("keeps one-sided interest secret and unmatched", () => {
    const skA = randomScalar();
    const skB = randomScalar();
    const pkB = publicKey(skB);

    const sim = new MatchLockSimulator(skA);
    sim.register();
    sim.switchUser(skB);
    sim.register();
    sim.switchUser(skA);
    const link = sim.expressInterest(pkB.x, pkB.y, filler);

    // Never matched, and only an opaque link + one ciphertext is on-chain — no
    // identity was disclosed, so the slot key is unrelated to the registry.
    const l = sim.getLedger();
    expect(l.slotCount.lookup(link)).toEqual(1n);
    expect(l.slotCipherB.member(link)).toBe(false);
    expect(l.registry.member(link)).toBe(false);
  });

  it("rejects a per-direction replay via the nullifier", () => {
    const skA = randomScalar();
    const skB = randomScalar();
    const pkB = publicKey(skB);

    const sim = new MatchLockSimulator(skA);
    sim.register();
    sim.switchUser(skB);
    sim.register();
    sim.switchUser(skA);
    sim.expressInterest(pkB.x, pkB.y, filler);
    expect(() => sim.expressInterest(pkB.x, pkB.y, filler)).toThrow(
      "already expressed this interest",
    );
  });

  it("cannot self-match (nullifier blocks the second same-direction post)", () => {
    const skA = randomScalar();
    const pkA = publicKey(skA);

    const sim = new MatchLockSimulator(skA);
    sim.register();
    const link = sim.expressInterest(pkA.x, pkA.y, filler);
    expect(sim.getLedger().slotCount.lookup(link)).toEqual(1n);
    expect(() => sim.expressInterest(pkA.x, pkA.y, filler)).toThrow(
      "already expressed this interest",
    );
  });
});
