import { Outlet } from 'react-router-dom';
import {
  AppBar,
  Box,
  Container,
  Toolbar,
  Typography,
} from '@mui/material';

export default function AppLayout() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#000000' }}>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: '#050505', borderBottom: '1px solid #27313a' }}>
        <Toolbar sx={{ gap: 2, minHeight: 76 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 1,
              bgcolor: '#ffffff',
              display: 'grid',
              placeItems: 'center',
              p: 0.5,
            }}
          >
            <Box component="img" src="/logo.svg?v=2" alt="Mentor Allocation logo" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </Box>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Mentor Allocation
          </Typography>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
