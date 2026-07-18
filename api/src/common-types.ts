// MatchLock common types and abstractions shared by the CLI and UI.

import { type MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { type FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { MatchLockPrivateState, Contract, Witnesses } from '../../contract/src/index';
import type { Point } from '../../contract/src/crypto';

export const matchLockPrivateStateKey = 'matchLockPrivateState';
export type PrivateStateId = typeof matchLockPrivateStateKey;

export type PrivateStates = {
  readonly matchLockPrivateState: MatchLockPrivateState;
};

export type MatchLockContract = Contract<MatchLockPrivateState, Witnesses<MatchLockPrivateState>>;

export type MatchLockCircuitKeys = Exclude<keyof MatchLockContract['impureCircuits'], number | symbol>;

export type MatchLockProviders = MidnightProviders<MatchLockCircuitKeys, PrivateStateId, MatchLockPrivateState>;

export type DeployedMatchLockContract = FoundContract<MatchLockContract>;

/** A registered participant: shareable id plus the public-key point to target. */
export type Registrant = {
  readonly id: string; // hex of publicKeyId
  readonly pk: Point;
};

/** A mutual match discovered on-chain (slot count == 2). */
export type Match = {
  readonly targetId: string; // hex
  readonly targetPk: Point;
  readonly link: string; // hex
  readonly cipherA: Uint8Array;
  readonly cipherB: Uint8Array;
};

/** A raw on-chain match slot, exactly as an outside observer sees it. */
export type ChainSlot = {
  readonly link: string; // hex — an opaque tag, not tied to any identity
  readonly count: number; // 1 = one-sided (invisible intent), 2 = matched
};

/** Derived combination of public (ledger) and private state. */
export type MatchLockDerivedState = {
  /** The current user's public identity id (hex), derived from their secret key. */
  readonly myId: string;
  readonly isRegistered: boolean;
  readonly registrantCount: number;
  /** Everyone in the directory (excluding self), available as interest targets. */
  readonly registrants: readonly Registrant[];
  /** Mutual matches involving the current user. */
  readonly matches: readonly Match[];
  /** The raw public ledger view — the "what the chain saw" panel. */
  readonly chainSlots: readonly ChainSlot[];
};
