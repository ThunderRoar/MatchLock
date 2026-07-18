# MatchLock

**Reveal nothing until it's mutual.**

MatchLock is a private deal-matching engine built on the [Midnight Network](https://midnight.network/). You privately signal willingness to trade or partner with a *specific* counterparty. Your intent is revealed to **no one** — not the counterparty, not the public, not the chain — until that counterparty *independently* signals matching intent back. Only then, and only for the two of you, does the match unlock.

One-sided interest stays secret **forever**. There is nothing to leak and nothing to front-run.

> Built for the Midnight Hackathon (July 2026). Submitted under **DeFi**.

---

## The problem

In any market where you must *express intent before a deal exists* — OTC desks, block trades, M&A origination, RFQ — signaling is dangerous. The moment your interest in a counterparty or a size leaks, the market moves against you (front-running / MEV), or the mere fact that you approached someone is itself sensitive information.

Today you either broadcast intent and accept the leakage, or you route through trusted intermediaries. MatchLock removes the tradeoff: **express intent that is cryptographically invisible until it is reciprocated.**

## How it works

MatchLock rests on **non-interactive ECDH "matching tags"** on Midnight's Jubjub curve.

1. **Register.** Each participant holds a secret scalar `sk` (in wallet-local private state, never on-chain) and publishes their public key `PK = sk·G` to an on-chain directory. A public key is not secret — only *intent* is.
2. **Express interest.** To signal interest in a target `PK_T`, you compute the ECDH shared secret `s = sk·PK_T` inside a zero-knowledge circuit and disclose only:
   - a **link** = `hash(s)` — an opaque slot tag,
   - a **nullifier** = `hash(sk, target)` — prevents you from posting the same direction twice,
   - a **ciphertext** — your reveal payload (contact, terms), encrypted client-side (AES-GCM) under a key derived from `s`.
3. **Match without coordination.** Because `sk_A·PK_B = sk_B·PK_A` (Diffie–Hellman), two people who point at each other derive the **same link** with no communication. Their two submissions land in the same slot; when both have posted, the slot flips to *matched* and each side decrypts the other's payload.

**Why the chain learns nothing:** an observer without either private key cannot compute the link, so every record looks like unlinkable noise. **Why fake matches are impossible:** producing a valid submission requires knowing `sk`, so a match provably requires *both* real endpoints — and the nullifier stops anyone from filling both sides of a slot alone.

### What the chain saw

The live **"What the chain saw"** panel in the UI shows the raw ledger: only opaque `link` tags and ciphertext, tagged `one-sided (hidden)` or `matched`. It never shows identities or who-pointed-at-whom — that data exists nowhere on-chain.

## Architecture

Monorepo (npm workspaces):

```
matchlock/
├── contract/     Compact smart contract + TS witnesses + off-chain crypto + tests
│   └── src/matchlock.compact   register() and expressInterest()
├── api/          MatchLockAPI: providers, circuit wrappers, match scanning
├── ui/          React DApp — connect, register, express interest, matches, "what the chain saw"
└── cli/         Standalone two-party match demo (local network, no wallet/faucet needed)
```

Runtime: **Lace wallet** → **api layer** → compiled contract → **proof server** (Docker) → **Midnight testnet** (Preprod). The reveal payload is encrypted in the browser using the *same* runtime EC primitives the circuit uses, so off-chain and in-circuit math agree bit-for-bit.

## Security — threat model

| Threat | Mitigation |
|---|---|
| Secret key `sk` leaking on-chain | `sk` is a witness; only `link`, nullifier, and ciphertext are ever disclosed. Enforced by the Compact disclosure checker. |
| Forging a counterparty's side to fake a match | A valid submission requires the ECDH secret, which requires `sk`. You cannot post as someone whose key you lack. |
| Replaying / self-inflating a slot | Per-direction nullifier; a party can post each direction at most once, so no one can fill both sides alone. |
| Brute-forcing "who likes whom" from tags | The ECDH tag is unlinkable without a private key. |
| A *malicious* target probing one-sided interest in themselves | Documented residual: a party can always compute links for pairs involving their own key. The honest client never does. Full protection needs private set intersection (PSI) — noted as future work. |

Contract behavior is verified by a simulator test suite (mutual match, one-sided secrecy, replay rejection, self-match rejection, ECDH cross-decrypt).

## It generalizes: threshold matching escrow

Two-party mutual matching is the *threshold = 2* case of a general **threshold matching-escrow** primitive: a payload unlocks only when *k* independent parties commit to the same key. The same ledger powers **multi-accuser safety escrow** (a report surfaces only when ≥2 people independently name the same target) with a blinding authority over low-entropy identifiers — a distinct trust model, presented here as the generalization story.

## Getting started

**Prerequisites:** Node.js (24+ recommended), Docker, the Compact toolchain, and the Lace wallet extension. On Windows, build inside **WSL2** — the Windows `compact.exe` (NTFS compression) collides with the Compact CLI on `PATH`.

```bash
# 1. Install (single hoisted node_modules at the root)
npm install

# 2. Compile the contract + generate ZK keys
cd contract && npm run compact && npm run build && cd ..

# 3. Run the contract tests
cd contract && npm test && cd ..     # 6 passing

# 4. Start the local proof server (Docker)
cd cli && docker compose -f proof-server-local.yml up -d && cd ..

# 5. Build and serve the UI (Preprod)
cd ui && npm run build:start   # http://127.0.0.1:8080
```

In Lace: create a wallet, switch to **Preprod**, set the proof server to **Local (http://localhost:6300)**, fund from the [Preprod faucet](https://midnight-tmnight-preprod.nethermind.dev/), and generate **tDUST** for fees.

### Fastest end-to-end demo (no wallet, no faucet)

The CLI runs the full two-party match on a self-contained local network (its own node, indexer, and proof server, funded from the genesis wallet):

```bash
cd cli && npm run standalone
```

It deploys the contract, registers two parties, shows one-sided interest staying hidden, then reciprocates so the match unlocks and both sides decrypt — printing what the chain saw at each step.

**To demo the match in the browser UI** you need two identities (two browser profiles, each with its own funded wallet): deploy a contract in one, share its address, join from the other, both register, then each expresses interest in the other — the match unlocks and decrypts live.

## Tech stack

Compact smart contract · Midnight Jubjub ECDH · zero-knowledge proofs · TypeScript · Midnight.js 4.x · React + MUI · WebCrypto AES-GCM.

---

MatchLock is built on the [Midnight Network](https://midnight.network/), a data-protection blockchain that uses zero-knowledge technology to enable selective disclosure of information.
