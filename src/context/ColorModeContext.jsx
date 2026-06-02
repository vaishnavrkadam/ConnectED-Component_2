import { createContext, useContext, useMemo } from 'react';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';

const ColorModeContext = createContext(null);

export function ColorModeProvider({ children }) {
  const value = useMemo(
    () => ({
      mode: 'dark',
    }),
    [],
  );

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: 'dark',
          primary: { main: '#6fb6ff' },
          secondary: { main: '#2f8f72' },
          background: {
            default: '#000000',
            paper: '#171d22',
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
                borderColor: '#27313a',
                boxShadow: 'none',
              },
            },
          },
          MuiButton: {
            defaultProps: { disableElevation: true },
          },
        },
      }),
    [],
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
