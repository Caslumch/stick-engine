import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './theme/ThemeProvider';
import { AgentStateProvider } from './app/AgentStateProvider';
import { App } from './App';
import { instalarPonteDeLogs } from './hooks/logUI';
import './index.css';

// Espelha console + erros no terminal da API (o WebView do Tauri não mostra)
instalarPonteDeLogs();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AgentStateProvider>
        <App />
      </AgentStateProvider>
    </ThemeProvider>
  </StrictMode>,
);
