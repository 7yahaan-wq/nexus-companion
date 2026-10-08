import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import ErrorBoundary from './components/ErrorBoundary';
import './ui/styles.css';
import './ui/features.css';
import './ui/calendar.css';
import './ui/agents.css';
import './ui/productivity.css';
import './ui/avatar.css';
import './ui/home.css';
import './ui/focus.css';
import './ui/light.css';
import './ui/notes.css';
import './ui/planning.css';
import './ui/workflow.css';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
