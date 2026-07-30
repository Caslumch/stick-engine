import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './theme/ThemeProvider';
import { AgentStateProvider } from './app/AgentStateProvider';
import { App } from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AgentStateProvider>
        <App />
      </AgentStateProvider>
    </ThemeProvider>
  </StrictMode>,
);
