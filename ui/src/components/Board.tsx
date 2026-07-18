// MatchLock — the main DApp panel: connect/deploy, register an identity,
// express private interest in a counterparty, watch mutual matches unlock, and
// inspect exactly what the chain saw.

import React, { useCallback, useEffect, useState } from 'react';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  Backdrop,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  List,
  ListItem,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CopyIcon from '@mui/icons-material/ContentPasteOutlined';
import SendIcon from '@mui/icons-material/SendOutlined';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import LockOpenIcon from '@mui/icons-material/LockOpenOutlined';
import StopIcon from '@mui/icons-material/HighlightOffOutlined';
import { type MatchLockDerivedState, type DeployedMatchLockAPI, type Point } from '../../../api/src/index';
import { useDeployedBoardContext } from '../hooks';
import { type BoardDeployment } from '../contexts';
import { type Observable } from 'rxjs';
import { EmptyCardContent } from './Board.EmptyCardContent';

export interface BoardProps {
  boardDeployment$?: Observable<BoardDeployment>;
}

const shortHex = (hex?: string): string =>
  hex ? `${hex.slice(0, 8)}…${hex.slice(-6)}` : '';

const payloadKey = (address: string, link: string) => `matchlock:${address}:payload:${link}`;

export const Board: React.FC<Readonly<BoardProps>> = ({ boardDeployment$ }) => {
  const provider = useDeployedBoardContext();
  const [deployment, setDeployment] = useState<BoardDeployment>();
  const [api, setApi] = useState<DeployedMatchLockAPI>();
  const [error, setError] = useState<string>();
  const [state, setState] = useState<MatchLockDerivedState>();
  const [working, setWorking] = useState(!!boardDeployment$);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, { theirs: string; mine?: string }>>({});
  const [showChain, setShowChain] = useState(false);

  const onCreate = useCallback(() => provider.resolve(), [provider]);
  const onJoin = useCallback((addr: ContractAddress) => provider.resolve(addr), [provider]);

  const run = useCallback(async (fn: () => Promise<void>) => {
    try {
      setError(undefined);
      setWorking(true);
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(false);
    }
  }, []);

  const onRegister = useCallback(() => run(async () => { if (api) await api.register(); }), [api, run]);

  const onExpress = useCallback(
    (targetId: string, pk: Point) =>
      run(async () => {
        if (!api) return;
        const payload = (drafts[targetId] ?? '').trim();
        if (!payload) throw new Error('Enter a message to reveal on match');
        const link = await api.expressInterest(pk, payload);
        localStorage.setItem(payloadKey(api.deployedContractAddress, link), payload);
        setDrafts((d) => ({ ...d, [targetId]: '' }));
      }),
    [api, drafts, run],
  );

  const onCopy = useCallback((text: string) => navigator.clipboard.writeText(text), []);

  // Subscribe to the deployment observable.
  useEffect(() => {
    if (!boardDeployment$) return;
    const sub = boardDeployment$.subscribe(setDeployment);
    return () => sub.unsubscribe();
  }, [boardDeployment$]);

  // Once deployed, capture the API and subscribe to its derived state.
  useEffect(() => {
    if (!deployment || deployment.status === 'in-progress') return;
    setWorking(false);
    if (deployment.status === 'failed') {
      setError(deployment.error.message || 'Unexpected error.');
      return;
    }
    setApi(deployment.api);
    const sub = deployment.api.state$.subscribe(setState);
    return () => sub.unsubscribe();
  }, [deployment]);

  // Decrypt reveal payloads for every mutual match.
  useEffect(() => {
    if (!api || !state) return;
    let cancelled = false;
    (async () => {
      for (const m of state.matches) {
        if (revealed[m.link]) continue;
        try {
          const a = await api.reveal(m.targetPk, m.cipherA);
          const b = await api.reveal(m.targetPk, m.cipherB);
          const mine = localStorage.getItem(payloadKey(api.deployedContractAddress, m.link)) ?? undefined;
          const theirs = mine === a ? b : mine === b ? a : b;
          if (!cancelled) setRevealed((r) => ({ ...r, [m.link]: { theirs, mine } }));
        } catch {
          /* ignore undecryptable slots */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, state, revealed]);

  if (!boardDeployment$) {
    return (
      <Card sx={{ position: 'relative', width: 320, minHeight: 220 }}>
        <EmptyCardContent onCreateBoardCallback={onCreate} onJoinBoardCallback={onJoin} />
      </Card>
    );
  }

  return (
    <Card sx={{ position: 'relative', width: 520, minHeight: 300 }}>
      <Backdrop sx={{ position: 'absolute', color: '#fff', zIndex: 10 }} open={working}>
        <CircularProgress data-testid="board-working-indicator" />
      </Backdrop>
      <Backdrop sx={{ position: 'absolute', color: '#ff5252', zIndex: 10, flexDirection: 'column', p: 2 }} open={!!error}>
        <StopIcon fontSize="large" />
        <Typography align="center" sx={{ mt: 1 }}>{error}</Typography>
        <Button size="small" sx={{ mt: 1 }} onClick={() => setError(undefined)}>Dismiss</Button>
      </Backdrop>

      <CardHeader
        title="MatchLock"
        subheader="Reveal nothing until it's mutual"
        titleTypographyProps={{ color: 'primary' }}
        action={
          api ? (
            <Tooltip title="Copy contract address">
              <IconButton onClick={() => onCopy(api.deployedContractAddress)}>
                <CopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Skeleton variant="circular" width={20} height={20} />
          )
        }
      />
      <CardContent>
        {!state ? (
          <Skeleton variant="rectangular" width="100%" height={200} />
        ) : (
          <Stack spacing={2}>
            {/* Identity */}
            <Box>
              <Typography variant="overline" color="text.secondary">Your identity</Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Chip label={shortHex(state.myId)} size="small" onClick={() => onCopy(state.myId)} />
                {state.isRegistered ? (
                  <Chip label="registered" color="success" size="small" />
                ) : (
                  <Button variant="contained" size="small" onClick={onRegister}>Register</Button>
                )}
                <Typography variant="caption" color="text.secondary">
                  {state.registrantCount} in directory
                </Typography>
              </Stack>
            </Box>

            <Divider />

            {/* Matches */}
            <Box>
              <Typography variant="overline" color="text.secondary">
                Matches ({state.matches.length})
              </Typography>
              {state.matches.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No mutual matches yet. One-sided interest stays invisible to everyone.
                </Typography>
              ) : (
                <List dense disablePadding>
                  {state.matches.map((m) => (
                    <ListItem key={m.link} sx={{ display: 'block', px: 0 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <LockOpenIcon color="success" fontSize="small" />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          Matched with {shortHex(m.targetId)}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ ml: 3 }}>
                        Them: {revealed[m.link]?.theirs ?? '…decrypting'}
                      </Typography>
                      {revealed[m.link]?.mine && (
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 3 }}>
                          You: {revealed[m.link]?.mine}
                        </Typography>
                      )}
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>

            <Divider />

            {/* Directory / express interest */}
            <Box>
              <Typography variant="overline" color="text.secondary">Express interest</Typography>
              {!state.isRegistered ? (
                <Typography variant="body2" color="text.secondary">Register first to appear in the directory and match.</Typography>
              ) : state.registrants.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No one else has registered yet.</Typography>
              ) : (
                <Stack spacing={1}>
                  {state.registrants.map((r) => (
                    <Stack key={r.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Chip label={shortHex(r.id)} size="small" sx={{ minWidth: 120 }} />
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="Message revealed only if they match back"
                        value={drafts[r.id] ?? ''}
                        onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                      />
                      <Tooltip title="Express private interest">
                        <span>
                          <IconButton color="primary" onClick={() => onExpress(r.id, r.pk)}>
                            <SendIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Box>

            <Divider />

            {/* What the chain saw */}
            <Box>
              <Button
                size="small"
                startIcon={<VisibilityIcon />}
                onClick={() => setShowChain((s) => !s)}
              >
                {showChain ? 'Hide' : 'What the chain saw'}
              </Button>
              <Collapse in={showChain}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  The ledger holds only opaque tags — no identities, no "who likes whom".
                </Typography>
                {state.chainSlots.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No interest posted yet.</Typography>
                ) : (
                  <List dense disablePadding>
                    {state.chainSlots.map((s) => (
                      <ListItem key={s.link} sx={{ px: 0 }}>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          link {shortHex(s.link)} · {s.count === 2 ? 'matched' : 'one-sided (hidden)'}
                        </Typography>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Collapse>
            </Box>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};
