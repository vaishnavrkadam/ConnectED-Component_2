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
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 2 }}>
          <Box component="img" src="/logo.svg" alt="Mentor Allocation logo" sx={{ width: 34, height: 34, objectFit: 'contain' }} />
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
