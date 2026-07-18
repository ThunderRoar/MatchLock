// The deploy / join call-to-action shown before a MatchLock contract is live.

import React, { useState } from 'react';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { Box, Button, CardContent, Stack, Typography } from '@mui/material';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import { TextPromptDialog } from './TextPromptDialog';

export interface EmptyCardContentProps {
  onCreateBoardCallback: () => void;
  onJoinBoardCallback: (contractAddress: ContractAddress) => void;
}

export const EmptyCardContent: React.FC<Readonly<EmptyCardContentProps>> = ({
  onCreateBoardCallback,
  onJoinBoardCallback,
}) => {
  const [textPromptOpen, setTextPromptOpen] = useState(false);

  return (
    <CardContent sx={{ textAlign: 'center', py: 4 }}>
      <Box
        sx={{
          width: 56,
          height: 56,
          mx: 'auto',
          mb: 2,
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#c7bfff',
          background: 'rgba(139,124,255,0.14)',
        }}
      >
        <RocketLaunchOutlinedIcon />
      </Box>
      <Typography sx={{ fontWeight: 700, fontSize: 20, color: '#f6f6ff' }}>Start matching</Typography>
      <Typography sx={{ color: 'rgba(244,244,251,0.6)', fontSize: 14, mt: 0.5, mb: 3 }}>
        Deploy a fresh MatchLock contract, or join one someone shared with you.
      </Typography>

      <Stack spacing={1.5}>
        <Button
          variant="contained"
          size="large"
          startIcon={<RocketLaunchOutlinedIcon />}
          data-testid="board-deploy-btn"
          onClick={onCreateBoardCallback}
          sx={{
            background: 'linear-gradient(100deg, #8b7cff 0%, #6f5cf0 100%)',
            py: 1.2,
            fontSize: 15,
          }}
        >
          Deploy a new contract
        </Button>
        <Button
          variant="outlined"
          startIcon={<LinkOutlinedIcon />}
          data-testid="board-join-btn"
          onClick={() => setTextPromptOpen(true)}
          sx={{ borderColor: 'rgba(139,124,255,0.35)', color: '#c7bfff' }}
        >
          Join with a contract address
        </Button>
      </Stack>

      <TextPromptDialog
        prompt="Enter contract address"
        isOpen={textPromptOpen}
        onCancel={() => setTextPromptOpen(false)}
        onSubmit={(text) => {
          setTextPromptOpen(false);
          onJoinBoardCallback(text);
        }}
      />
    </CardContent>
  );
};
