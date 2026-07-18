// MatchLock private state + witnesses. The only hidden state is the user's
// secret scalar 'sk' (a Field, i.e. a bigint in TS); it never leaves the wallet.

import { Ledger } from "./managed/matchlock/contract/index.js";
import { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

export type MatchLockPrivateState = {
  readonly secretKey: bigint;
};

export const createMatchLockPrivateState = (
  secretKey: bigint,
): MatchLockPrivateState => ({
  secretKey,
});

export const witnesses = {
  localSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, MatchLockPrivateState>): [
    MatchLockPrivateState,
    bigint,
  ] => [privateState, privateState.secretKey],
};
