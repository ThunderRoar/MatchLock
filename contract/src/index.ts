import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";

export * from "./managed/matchlock/contract/index.js";
export * from "./witnesses";

import * as CompiledMatchLockContract from "./managed/matchlock/contract/index.js";
import * as Witnesses from "./witnesses";

export const CompiledMatchLockContractContract = CompiledContract.make<
  CompiledMatchLockContract.Contract<Witnesses.MatchLockPrivateState>
>(
  "MatchLock",
  CompiledMatchLockContract.Contract<Witnesses.MatchLockPrivateState>,
).pipe(
  CompiledContract.withWitnesses(Witnesses.witnesses),
  CompiledContract.withCompiledFileAssets("./managed/matchlock"),
);
