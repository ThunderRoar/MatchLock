// MatchLock theme — a dark "midnight" palette with a single violet accent.

import { createTheme, alpha } from '@mui/material';

const accent = '#8b7cff'; // violet — the one accent color
const paper = '#14141f';
const bg = '#0a0a12';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: accent, light: alpha(accent, 0.75), dark: '#6f5cf0' },
    secondary: { main: '#22d3ee' },
    success: { main: '#34d399' },
    background: { default: bg, paper },
    text: { primary: '#f4f4fb', secondary: alpha('#f4f4fb', 0.6) },
  },
  typography: {
    fontFamily: 'Helvetica, Arial, sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    overline: { letterSpacing: '0.12em' },
  },
  shape: { borderRadius: 14 },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${alpha(accent, 0.18)}`,
          boxShadow: `0 12px 40px ${alpha('#000', 0.5)}`,
          backdropFilter: 'blur(6px)',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { textTransform: 'none', borderRadius: 999, fontWeight: 600 } },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
  },
});
