// The root MatchLock application component.

import React, { useEffect, useState } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { MainLayout, Board } from './components';
import { useDeployedBoardContext } from './hooks';
import { type BoardDeployment } from './contexts';
import { type Observable } from 'rxjs';

const steps = [
  {
    icon: <VisibilityOffOutlinedIcon />,
    title: 'Signal privately',
    body: 'Express intent toward a counterparty. The chain sees only an opaque tag — never who you picked.',
  },
  {
    icon: <HandshakeOutlinedIcon />,
    title: 'They signal back',
    body: 'An independent party expresses matching intent. Still nothing is revealed to anyone.',
  },
  {
    icon: <LockOpenOutlinedIcon />,
    title: 'The match unlocks',
    body: 'Only when intent is mutual do both sides — and only they — see the reveal. No leaked intent, no front-running.',
  },
];

const Hero: React.FC = () => (
  <Stack spacing={4} sx={{ maxWidth: 1000, textAlign: 'center', alignItems: 'center', pt: { xs: 2, md: 5 } }}>
    <Chip
      icon={<AutoAwesomeIcon sx={{ fontSize: 16, color: '#c7bfff !important' }} />}
      label="Private DeFi matching · Built on Midnight"
      sx={{
        bgcolor: 'rgba(139,124,255,0.10)',
        color: '#c7bfff',
        border: '1px solid rgba(139,124,255,0.35)',
        px: 1,
        fontWeight: 600,
        letterSpacing: '0.02em',
      }}
    />

    <Typography
      component="h1"
      sx={{
        fontWeight: 800,
        lineHeight: 1.05,
        letterSpacing: '-0.03em',
        fontSize: { xs: 40, sm: 56, md: 72 },
        color: '#f6f6ff',
        textShadow: '0 2px 40px rgba(0,0,0,0.5)',
      }}
    >
      Your intent stays secret
      <br />
      until it&apos;s{' '}
      <Box
        component="span"
        sx={{
          background: 'linear-gradient(100deg, #8b7cff 0%, #22d3ee 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          filter: 'drop-shadow(0 0 24px rgba(139,124,255,0.45))',
        }}
      >
        mutual
      </Box>
    </Typography>

    <Typography sx={{ color: 'rgba(244,244,251,0.72)', maxWidth: 640, fontSize: { xs: 16, md: 19 }, lineHeight: 1.6 }}>
      A private deal-matching engine on Midnight. Signal willingness to trade or partner with a specific
      counterparty — revealed to no one, not even the chain, until they independently signal back.
    </Typography>

    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} sx={{ mt: 2, width: '100%', justifyContent: 'center' }}>
      {steps.map((s, i) => (
        <Box
          key={s.title}
          sx={{
            flex: 1,
            maxWidth: 300,
            p: 3,
            borderRadius: 4,
            textAlign: 'left',
            border: '1px solid rgba(139,124,255,0.16)',
            background: 'linear-gradient(180deg, rgba(28,26,44,0.7) 0%, rgba(16,15,26,0.7) 100%)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
            transition: 'transform 160ms ease, border-color 160ms ease',
            '&:hover': { transform: 'translateY(-4px)', borderColor: 'rgba(139,124,255,0.45)' },
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c7bfff',
              background: 'rgba(139,124,255,0.14)',
              mb: 1.5,
            }}
          >
            {s.icon}
          </Box>
          <Typography sx={{ color: 'rgba(139,124,255,0.9)', fontWeight: 700, fontSize: 13, mb: 0.5 }}>
            0{i + 1}
          </Typography>
          <Typography sx={{ color: '#f6f6ff', fontWeight: 700, fontSize: 18, mb: 0.75 }}>{s.title}</Typography>
          <Typography sx={{ color: 'rgba(244,244,251,0.6)', fontSize: 14, lineHeight: 1.55 }}>{s.body}</Typography>
        </Box>
      ))}
    </Stack>
  </Stack>
);

const App: React.FC = () => {
  const boardApiProvider = useDeployedBoardContext();
  const [boardDeployments, setBoardDeployments] = useState<Array<Observable<BoardDeployment>>>([]);

  useEffect(() => {
    const subscription = boardApiProvider.boardDeployments$.subscribe(setBoardDeployments);
    return () => subscription.unsubscribe();
  }, [boardApiProvider]);

  return (
    <MainLayout>
      <Hero />
      <Stack
        direction="row"
        spacing={2}
        sx={{ flexWrap: 'wrap', justifyContent: 'center', gap: 2, mt: { xs: 2, md: 4 } }}
      >
        {boardDeployments.map((boardDeployment, idx) => (
          <div data-testid={`board-${idx}`} key={`board-${idx}`}>
            <Board boardDeployment$={boardDeployment} />
          </div>
        ))}
        <div data-testid="board-start">
          <Board />
        </div>
      </Stack>
    </MainLayout>
  );
};

export default App;
