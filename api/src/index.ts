/**
 * Types and utilities for working with MatchLock contracts.
 *
 * @packageDocumentation
 */

import * as MatchLock from '../../contract/src/managed/matchlock/contract/index.js';
import {
  type ContractAddress,
  convertBytesToField,
} from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { type Logger } from 'pino';
import {
  type MatchLockDerivedState,
  type MatchLockContract,
  type MatchLockProviders,
  type DeployedMatchLockContract,
  type Registrant,
  type Match,
  matchLockPrivateStateKey,
} from './common-types.js';
import { CompiledMatchLockContractContract } from '../../contract/src/index';
import {
  type Point,
  publicKey,
  sharedSecret,
  computeLink,
  encryptPayload,
  decryptPayload,
  randomScalar,
} from '../../contract/src/crypto';
import {
  type MatchLockPrivateState,
  createMatchLockPrivateState,
} from '../../contract/src/witnesses';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { map, type Observable } from 'rxjs';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';

const pkToPoint = (pk: { x: Uint8Array; y: Uint8Array }): Point => ({
  x: convertBytesToField(32, pk.x, 'api'),
  y: convertBytesToField(32, pk.y, 'api'),
});

/** An API for a deployed MatchLock contract. */
export interface DeployedMatchLockAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<MatchLockDerivedState>;

  register: () => Promise<void>;
  expressInterest: (target: Point, payload: string) => Promise<string>;
  /** Decrypt a counterparty's reveal blob using the ECDH secret with `target`. */
  reveal: (target: Point, blob: Uint8Array) => Promise<string>;
}

export class MatchLockAPI implements DeployedMatchLockAPI {
  private constructor(
    public readonly deployedContract: DeployedMatchLockContract,
    private readonly providers: MatchLockProviders,
    private readonly secretKey: bigint,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    providers.privateStateProvider.setContractAddress(this.deployedContractAddress);

    const myId = toHex(MatchLock.pureCircuits.publicKeyId(publicKey(secretKey)));
    this.myId = myId;

    this.state$ = providers.publicDataProvider
      .contractStateObservable(this.deployedContractAddress, { type: 'latest' })
      .pipe(
        map((contractState) => MatchLock.ledger(contractState.data)),
        map((ledgerState): MatchLockDerivedState => {
          const registrants: Registrant[] = [];
          for (const [id, pk] of ledgerState.registry) {
            const idHex = toHex(id);
            if (idHex === myId) continue;
            registrants.push({ id: idHex, pk: pkToPoint(pk) });
          }

          const matches: Match[] = [];
          for (const r of registrants) {
            const link = computeLink(secretKey, r.pk);
            if (ledgerState.slotCount.member(link) && ledgerState.slotCount.lookup(link) === 2n) {
              matches.push({
                targetId: r.id,
                targetPk: r.pk,
                link: toHex(link),
                cipherA: ledgerState.slotCipherA.lookup(link),
                cipherB: ledgerState.slotCipherB.lookup(link),
              });
            }
          }

          const chainSlots = [];
          for (const [link, count] of ledgerState.slotCount) {
            chainSlots.push({ link: toHex(link), count: Number(count) });
          }

          return {
            myId,
            isRegistered: ledgerState.registry.member(MatchLock.pureCircuits.publicKeyId(publicKey(secretKey))),
            registrantCount: Number(ledgerState.registrantCount),
            registrants,
            matches,
            chainSlots,
          };
        }),
      );
  }

  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<MatchLockDerivedState>;
  readonly myId: string;

  async register(): Promise<void> {
    this.logger?.info('register');
    const txData = await this.deployedContract.callTx.register();
    this.logger?.trace({
      transactionAdded: { circuit: 'register', txHash: txData.public.txHash },
    });
  }

  /** Encrypt `payload` under the ECDH secret with `target` and post the interest. */
  async expressInterest(target: Point, payload: string): Promise<string> {
    this.logger?.info('expressInterest');
    const shared = sharedSecret(this.secretKey, target);
    const ciphertext = await encryptPayload(shared, payload);
    const txData = await this.deployedContract.callTx.expressInterest(target.x, target.y, ciphertext);
    this.logger?.trace({
      transactionAdded: { circuit: 'expressInterest', txHash: txData.public.txHash },
    });
    return toHex(txData.private.result);
  }

  async reveal(target: Point, blob: Uint8Array): Promise<string> {
    return decryptPayload(sharedSecret(this.secretKey, target), blob);
  }

  static async deploy(providers: MatchLockProviders, logger?: Logger): Promise<MatchLockAPI> {
    logger?.info('deployContract');
    const secretKey = randomScalar();
    const deployed = await deployContract(providers, {
      compiledContract: CompiledMatchLockContractContract,
      privateStateId: matchLockPrivateStateKey,
      initialPrivateState: createMatchLockPrivateState(secretKey),
    });
    logger?.trace({ contractDeployed: { finalizedDeployTxData: deployed.deployTxData.public } });
    return new MatchLockAPI(deployed, providers, secretKey, logger);
  }

  static async join(
    providers: MatchLockProviders,
    contractAddress: ContractAddress,
    logger?: Logger,
  ): Promise<MatchLockAPI> {
    logger?.info({ joinContract: { contractAddress } });
    const privateState = await MatchLockAPI.getOrCreatePrivateState(providers, contractAddress);
    const deployed = await findDeployedContract<MatchLockContract>(providers, {
      contractAddress,
      compiledContract: CompiledMatchLockContractContract,
      privateStateId: matchLockPrivateStateKey,
      initialPrivateState: privateState,
    });
    logger?.trace({ contractJoined: { finalizedDeployTxData: deployed.deployTxData.public } });
    return new MatchLockAPI(deployed, providers, privateState.secretKey, logger);
  }

  private static async getOrCreatePrivateState(
    providers: MatchLockProviders,
    contractAddress: ContractAddress,
  ): Promise<MatchLockPrivateState> {
    providers.privateStateProvider.setContractAddress(contractAddress);
    const existing = await providers.privateStateProvider.get(matchLockPrivateStateKey);
    return existing ?? createMatchLockPrivateState(randomScalar());
  }
}

export * as utils from './utils/index.js';
export * from './common-types.js';
export type { Point } from '../../contract/src/crypto';
export type { MatchLockPrivateState } from '../../contract/src/witnesses';
