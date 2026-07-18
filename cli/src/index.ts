// MatchLock CLI — a scripted, non-interactive end-to-end demo that runs the
// full two-party mutual-match flow on a local standalone network (its own node,
// indexer, and proof server, funded from the genesis wallet — no Lace, no
// faucet). Every step prints what it did and, crucially, what the chain saw.

import { WebSocket } from 'ws';
import {
  MatchLockAPI,
  type MatchLockDerivedState,
  type MatchLockProviders,
  type PrivateStateId,
} from '../../api/src/index';
import { type Point } from '../../contract/src/crypto';
import { type MatchLockPrivateState } from '../../contract/src/witnesses.js';
import { type WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { TestEnvironment } from '@midnight-ntwrk/testkit-js';
import { type Logger } from 'pino';
import { firstValueFrom, filter, timeout } from 'rxjs';
import { type Config } from './config.js';
import { MidnightWalletProvider } from './midnight-wallet-provider';
import { waitForUnshieldedFunds, syncWallet } from './wallet-utils';
import { generateDust } from './generate-dust';

// @ts-expect-error: enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

/** Seed of the genesis-mint wallet on a standalone node (pre-funded). */
const GENESIS_MINT_WALLET_SEED = '0000000000000000000000000000000000000000000000000000000000000001';

const banner = (logger: Logger, title: string) => {
  logger.info('');
  logger.info(`──────────── ${title} ────────────`);
};

/** Await the first derived state that satisfies `predicate`. */
const waitFor = (
  api: MatchLockAPI,
  predicate: (s: MatchLockDerivedState) => boolean,
  ms = 180_000,
): Promise<MatchLockDerivedState> => firstValueFrom(api.state$.pipe(filter(predicate), timeout(ms)));

const showChain = (logger: Logger, s: MatchLockDerivedState) => {
  logger.info(`  what the chain saw: ${s.chainSlots.length} slot(s), ${s.registrantCount} registrant(s)`);
  for (const slot of s.chainSlots) {
    logger.info(`    · link ${slot.link.slice(0, 16)}… → ${slot.count === 2 ? 'MATCHED' : 'one-sided (intent hidden)'}`);
  }
};

export const run = async (config: Config, testEnv: TestEnvironment, logger: Logger): Promise<void> => {
  const stopWallets: MidnightWalletProvider[] = [];
  try {
    banner(logger, 'Starting local MatchLock network');
    const env = await testEnv.start();
    const seed = GENESIS_MINT_WALLET_SEED;

    const walletProvider = await MidnightWalletProvider.build(logger, env, seed);
    stopWallets.push(walletProvider);
    const wallet: WalletFacade = walletProvider.wallet;
    await walletProvider.start();

    const unshielded = await waitForUnshieldedFunds(logger, wallet, env, unshieldedToken());
    logger.info(`Genesis wallet NIGHT balance: ${unshielded.balances[unshieldedToken().raw]}`);
    if (config.generateDust) {
      const dust = await generateDust(logger, seed, unshielded, wallet);
      if (dust) await syncWallet(logger, wallet);
    }

    // Shared network providers; each identity gets its own private-state store.
    const zkConfigProvider = new NodeZkConfigProvider<'register' | 'expressInterest'>(config.zkConfigPath);
    const base = {
      publicDataProvider: indexerPublicDataProvider(env.indexer, env.indexerWS),
      zkConfigProvider,
      proofProvider: httpClientProofProvider(env.proofServer, zkConfigProvider),
      walletProvider,
      midnightProvider: walletProvider,
    };
    const providersFor = (store: string): MatchLockProviders => ({
      ...base,
      privateStateProvider: levelPrivateStateProvider<PrivateStateId, MatchLockPrivateState>({
        privateStateStoreName: store,
        signingKeyStoreName: `${store}-signing-keys`,
        privateStoragePasswordProvider: () => 'MatchLock-Test-2026!',
        accountId: seed,
      }),
    });

    // ---- Two independent identities (Acme and Beta) on one contract ----
    banner(logger, 'Acme deploys MatchLock and registers');
    const acme = await MatchLockAPI.deploy(providersFor('matchlock-acme'), logger);
    logger.info(`Contract deployed at: ${acme.deployedContractAddress}`);
    await acme.register();

    banner(logger, 'Beta joins the same contract and registers');
    const beta = await MatchLockAPI.join(providersFor('matchlock-beta'), acme.deployedContractAddress, logger);
    await beta.register();

    // Each side discovers the other's public key from the on-chain directory.
    const acmeSees = await waitFor(acme, (s) => s.isRegistered && s.registrants.length >= 1);
    const betaSees = await waitFor(beta, (s) => s.isRegistered && s.registrants.length >= 1);
    const betaPk: Point = acmeSees.registrants[0].pk;
    const acmePk: Point = betaSees.registrants[0].pk;
    logger.info(`Acme id ${acmeSees.myId.slice(0, 12)}…  Beta id ${betaSees.myId.slice(0, 12)}…`);

    // ---- One-sided interest: invisible to everyone ----
    banner(logger, 'Acme privately expresses interest in Beta');
    await acme.expressInterest(betaPk, 'Acme: willing to trade 500 blocks @ ref A-7788');
    const afterOne = await waitFor(acme, (s) => s.chainSlots.length >= 1);
    showChain(logger, afterOne);
    logger.info(`  matches so far: ${afterOne.matches.length}  ← one-sided intent reveals nothing`);

    // ---- Beta reciprocates: the match unlocks ----
    banner(logger, 'Beta independently expresses interest in Acme');
    await beta.expressInterest(acmePk, 'Beta Capital: yes — settle via our desk, ir@beta.example');

    const matchedForAcme = await waitFor(acme, (s) => s.matches.length >= 1);
    const matchedForBeta = await waitFor(beta, (s) => s.matches.length >= 1);
    showChain(logger, matchedForAcme);

    banner(logger, 'Match unlocked — each side decrypts the other');
    for (const m of matchedForAcme.matches) {
      const theirs = await acme.reveal(m.targetPk, m.cipherB);
      logger.info(`  Acme now sees Beta's reveal: "${theirs}"`);
    }
    for (const m of matchedForBeta.matches) {
      const theirs = await beta.reveal(m.targetPk, m.cipherA);
      logger.info(`  Beta now sees Acme's reveal: "${theirs}"`);
    }

    banner(logger, 'Done — intent stayed private until it was mutual');
  } catch (e) {
    logError(logger, e);
  } finally {
    try {
      for (const w of stopWallets) {
        logger.info('Stopping wallet...');
        await w.stop();
      }
      if (testEnv) {
        logger.info('Stopping test environment...');
        await testEnv.shutdown();
      }
    } catch (e) {
      logError(logger, e);
    }
  }
};

function logError(logger: Logger, e: unknown) {
  if (e instanceof Error) {
    logger.error(`Found error '${e.message}'`);
    logger.debug(`${e.stack}`);
  } else {
    logger.error('Found error (unknown type)');
  }
}
