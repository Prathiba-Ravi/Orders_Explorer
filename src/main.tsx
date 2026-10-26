import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DocsPage } from './DocsPage';
import './styles/tokens.css';
import './styles/base.css';

const isDocsPage = window.location.hash === '#docs';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isDocsPage ? <DocsPage /> : <App />}
  </StrictMode>,
);
