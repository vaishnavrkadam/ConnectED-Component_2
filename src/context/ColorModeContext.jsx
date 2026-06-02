import { createContext, useContext, useMemo, useState } from 'react';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';

const ColorModeContext = createContext(null);

export function ColorModeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem('mentor-theme') || 'light');

  const value = useMemo(
    () => ({
      mode,
      toggleMode: () => {
        setMode((current) => {
          const next = current === 'light' ? 'dark' : 'light';
          localStorage.setItem('mentor-theme', next);
          return next;
        });
      },
    }),
    [mode],
  );

  const theme = useMemo(
    () =>
      createTheme({
        colorSchemes: { light: true, dark: true },
        palette: {
          mode,
          primary: { main: mode === 'light' ? '#1262a3' : '#6fb6ff' },
          secondary: { main: '#2f8f72' },
          background: {
            default: mode === 'light' ? '#f6f8fb' : '#101417',
            paper: mode === 'light' ? '#ffffff' : '#171d22',
          },
        },
        shape: { borderRadius: 8 },
        typography: {
          fontFamily: 'Inter, system-ui, sans-serif',
          h4: { fontWeight: 700, letterSpacing: 0 },
          h5: { fontWeight: 700, letterSpacing: 0 },
          h6: { fontWeight: 700, letterSpacing: 0 },
          button: { textTransform: 'none', fontWeight: 600 },
        },
        components: {
          MuiCard: {
            styleOverrides: {
              root: {
                border: '1px solid',
                borderColor: mode === 'light' ? '#e3e8ef' : '#27313a',
                boxShadow: 'none',
              },
            },
          },
          MuiButton: {
            defaultProps: { disableElevation: true },
          },
        },
      }),
    [mode],
  );

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export const useColorMode = () => useContext(ColorModeContext);
