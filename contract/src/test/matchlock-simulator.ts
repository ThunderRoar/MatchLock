// In-process test harness that drives the MatchLock contract (no network).

import {
  type CircuitContext,
  QueryContext,
  sampleContractAddress,
  createConstructorContext,
  CostModel,
} from "@midnight-ntwrk/compact-runtime";
import { Contract, type Ledger, ledger } from "../managed/matchlock/contract/index.js";
import { type MatchLockPrivateState, witnesses } from "../witnesses.js";

export class MatchLockSimulator {
  readonly contract: Contract<MatchLockPrivateState>;
  circuitContext: CircuitContext<MatchLockPrivateState>;

  constructor(secretKey: bigint) {
    this.contract = new Contract<MatchLockPrivateState>(witnesses);
    const { currentPrivateState, currentContractState, currentZswapLocalState } =
      this.contract.initialState(
        createConstructorContext({ secretKey }, "0".repeat(64)),
      );
    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(
        currentContractState.data,
        sampleContractAddress(),
      ),
    };
  }

  /** Switch to a different user's secret key (simulates a second wallet). */
  public switchUser(secretKey: bigint) {
    this.circuitContext.currentPrivateState = { secretKey };
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): MatchLockPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  /** Register the current user; returns their public identity id. */
  public register(): Uint8Array {
    const res = this.contract.impureCircuits.register(this.circuitContext);
    this.circuitContext = res.context;
    return res.result;
  }

  /** Express interest in a target public key; returns the slot `link`. */
  public expressInterest(
    targetPkX: bigint,
    targetPkY: bigint,
    ciphertext: Uint8Array,
  ): Uint8Array {
    const res = this.contract.impureCircuits.expressInterest(
      this.circuitContext,
      targetPkX,
      targetPkY,
      ciphertext,
    );
    this.circuitContext = res.context;
    return res.result;
  }
}
