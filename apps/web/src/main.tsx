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
                style: {
                  background: 'rgba(15, 15, 25, 0.9)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#e2e8f0',
                  backdropFilter: 'blur(12px)',
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
