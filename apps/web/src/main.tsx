import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import AppToaster from './components/feedback/AppToaster';
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
            <AppToaster />
          </BrowserRouter>
        </AuthProvider>
      </LocaleProvider>
    </ThemeProvider>
  </StrictMode>,
)
