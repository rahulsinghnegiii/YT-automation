import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, GlobalStyles } from '@mui/material';
import App from './App';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#bb86fc',
      light: '#d7b4ff',
      dark: '#9354ff'
    },
    secondary: {
      main: '#03dac6',
      light: '#5ddef4',
      dark: '#00a896'
    },
    background: {
      default: '#0f0f0f',
      paper: '#1a1a1a'
    },
    text: {
      primary: '#ffffff',
      secondary: '#b3b3b3'
    }
  },
  typography: {
    fontFamily: '"Roboto", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    h4: {
      fontWeight: 700,
      background: 'linear-gradient(45deg, #bb86fc 30%, #03dac6 90%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent'
    }
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
          border: '1px solid rgba(187, 134, 252, 0.2)',
          backdropFilter: 'blur(10px)'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(45deg, #bb86fc 30%, #03dac6 90%)',
          borderRadius: '12px',
          textTransform: 'none',
          fontWeight: 600,
          '&:hover': {
            background: 'linear-gradient(45deg, #d7b4ff 30%, #5ddef4 90%)',
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 25px rgba(187, 134, 252, 0.3)'
          }
        }
      }
    }
  }
});

const globalStyles = (
  <GlobalStyles
    styles={{
      '*': {
        scrollbarWidth: 'thin',
        scrollbarColor: '#bb86fc #1a1a1a'
      },
      '*::-webkit-scrollbar': {
        width: '8px'
      },
      '*::-webkit-scrollbar-track': {
        background: '#1a1a1a'
      },
      '*::-webkit-scrollbar-thumb': {
        background: 'linear-gradient(45deg, #bb86fc, #03dac6)',
        borderRadius: '4px'
      },
      body: {
        background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 50%, #0f0f0f 100%)',
        minHeight: '100vh'
      }
    }}
  />
);

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      {globalStyles}
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
