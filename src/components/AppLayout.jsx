import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Button,
  Container,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useColorMode } from '../context/ColorModeContext.jsx';

export default function AppLayout() {
  const { mode, toggleMode } = useColorMode();
  const location = useLocation();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 2 }}>
          <AssignmentTurnedInIcon color="primary" />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Mentor Allocation
          </Typography>
          <Stack direction="row" spacing={1} sx={{ display: { xs: 'none', sm: 'flex' } }}>
            <Button component={Link} to="/" variant={location.pathname === '/' ? 'contained' : 'text'}>
              Student
            </Button>
            <Button
              component={Link}
              to="/admin"
              startIcon={<AdminPanelSettingsIcon />}
              variant={location.pathname === '/admin' ? 'contained' : 'text'}
            >
              Admin
            </Button>
          </Stack>
          <Tooltip title={mode === 'light' ? 'Dark theme' : 'Light theme'}>
            <IconButton onClick={toggleMode} color="inherit">
              {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
