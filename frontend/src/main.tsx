import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@tabler/core/dist/css/tabler.min.css';
import '@tabler/core';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
