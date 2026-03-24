import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from './App';
import { AuthProvider } from './providers/AuthProvider';
import { LocaleProvider } from './providers/LocaleContext';
import { ThemeProvider } from './providers/ThemeContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <LocaleProvider>
        <AuthProvider>
          <BrowserRouter>
            <App />
            <Toaster
              position="top-center"
              visibleToasts={2}
              expand={false}
              gap={12}
              offset={20}
              toastOptions={{
                duration: 4200,
                style: {
                  background: 'var(--toast-bg)',
                  border: '1px solid var(--toast-border)',
                  color: 'var(--color-label)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  borderRadius: '20px',
                  boxShadow: '0 24px 54px rgba(15, 23, 42, 0.12)',
                  fontSize: '13px',
                  padding: '14px 16px',
                  maxWidth: '380px',
                  lineHeight: '1.5',
                },
              }}
            />
          </BrowserRouter>
        </AuthProvider>
      </LocaleProvider>
    </ThemeProvider>
  </StrictMode>,
)
