import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import ErrorBoundary from './ErrorBoundary';
import { applyTheme, resolveTheme } from './theme';
import { resolveLanguage } from './language';
import { copy } from './copy';
import { initChunkErrorListener } from './live-safety';
import './styles.css';

initChunkErrorListener();
applyTheme(resolveTheme());
const text = copy[resolveLanguage(window.location.search, () => localStorage)];
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallback={<div className="app-shell scene-message" role="alert">
      <h1>{text.appUnavailable}</h1>
      <a href={basename}>{text.home}</a>
      <button onClick={() => window.location.reload()}>{text.retryPage}</button>
    </div>}>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
