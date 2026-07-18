// MatchLock application layout: header + a centered content column on a
// dark radial "midnight" backdrop.

import React from 'react';
import { Box } from '@mui/material';
import { Header } from './Header';

export const MainLayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        background:
          'radial-gradient(900px 500px at 15% 0%, rgba(139,124,255,0.16), transparent 55%),' +
          'radial-gradient(900px 500px at 85% 10%, rgba(34,211,238,0.10), transparent 55%),' +
          '#08080f',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(139,124,255,0.05) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(139,124,255,0.05) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at 50% 0%, #000 0%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 0%, #000 0%, transparent 70%)',
          pointerEvents: 'none',
        },
      }}
    >
      <Header />
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          px: 2,
          py: { xs: 4, md: 8 },
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
