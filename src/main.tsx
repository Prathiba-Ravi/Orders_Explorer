import { StrictMode } from 'react';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DocsPage } from './DocsPage';
import './styles/tokens.css';
import './styles/base.css';

function Routes() {
  const [isDocsPage, setIsDocsPage] = useState(() => window.location.hash === '#docs');

  useEffect(() => {
    const syncRoute = () => setIsDocsPage(window.location.hash === '#docs');
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

  return isDocsPage ? <DocsPage /> : <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Routes />
  </StrictMode>,
);
