import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './i18n';
import './index.css';
import App from './App';
import { rxNostr } from './nostr/core';
import { browseRelays } from './nostr/relays';
import { AuthProvider } from './context/AuthContext';
import { EmojiListProvider } from './context/EmojiListContext';

// Default relays for unauthenticated browsing; per-request relays override these.
rxNostr.setDefaultRelays(browseRelays());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <EmojiListProvider>
          <App />
        </EmojiListProvider>
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
);
