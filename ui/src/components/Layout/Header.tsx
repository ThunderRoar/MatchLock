// MatchLock application header.

import React from 'react';
import { AppBar, Box, Chip, Typography } from '@mui/material';
import { Logo } from '../Logo';

export const Header: React.FC = () => (
  <AppBar
    position="static"
    data-testid="header"
    sx={{
      background: 'linear-gradient(90deg, #0a0a12 0%, #14101f 100%)',
      borderBottom: '1px solid rgba(139,124,255,0.18)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      px: { xs: 3, md: 8 },
      py: 1.5,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }} data-testid="header-logo">
      <Logo size={34} />
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>
          Match<span style={{ color: '#8b7cff' }}>Lock</span>
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(244,244,251,0.55)' }}>
          Reveal nothing until it&apos;s mutual
        </Typography>
      </Box>
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Chip
        label="Private DeFi matching"
        size="small"
        sx={{ bgcolor: 'rgba(139,124,255,0.12)', color: '#c7bfff', display: { xs: 'none', sm: 'flex' } }}
      />
      <img src="/midnight-logo.png" alt="Built on Midnight" height={40} />
    </Box>
  </AppBar>
);
