import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './i18n';
import './index.css';
import App from './App';
import { rxNostr } from './nostr/core';
import { fallbackRelays } from './nostr/relays';
import { AuthProvider } from './context/AuthContext';
import { EmojiListProvider } from './context/EmojiListContext';
import { ProfilesProvider } from './context/ProfilesContext';

// Default relays for unauthenticated browsing; per-request relays override these.
rxNostr.setDefaultRelays(fallbackRelays());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <ProfilesProvider>
          <EmojiListProvider>
            <App />
          </EmojiListProvider>
        </ProfilesProvider>
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
);
