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
              toastOptions={{
                duration: 3500,
                style: {
                  background: 'var(--glass-bg-heavy)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--color-label)',
                  backdropFilter: 'blur(var(--glass-blur))',
                  fontSize: '13px',
                },
              }}
            />
          </BrowserRouter>
        </AuthProvider>
      </LocaleProvider>
    </ThemeProvider>
  </StrictMode>,
)
