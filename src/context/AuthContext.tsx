import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loginNip07, hasNip07 } from '../nostr/nip07';
import { fetchRelayList, readRelays, writeRelays, type RelayEntry } from '../nostr/core';
import { fetchProfile, type Profile } from '../nostr/profile';
import { fallbackRelays } from '../nostr/relays';
import { loadState, updateState } from '../utils/storage';

interface AuthState {
  pubkey: string | null;
  profile: Profile | null;
  relays: RelayEntry[];
  readRelays: string[];
  writeRelays: string[];
  loading: boolean;
  hasExtension: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [relays, setRelays] = useState<RelayEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasExtension, setHasExtension] = useState(hasNip07());
  const [error, setError] = useState<string | null>(null);

  async function hydrate(pk: string) {
    setPubkey(pk);
    const entries = await fetchRelayList(pk);
    setRelays(entries);
    const profileRelays = readRelays(entries);
    const p = await fetchProfile(pk, profileRelays);
    setProfile(p);
  }

  async function login() {
    setLoading(true);
    setError(null);
    try {
      const pk = await loginNip07();
      updateState({ loggedIn: true });
      await hydrate(pk);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'login failed');
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    updateState({ loggedIn: false });
    setPubkey(null);
    setProfile(null);
    setRelays([]);
  }

  // NIP-07 extensions often inject window.nostr after React mounts, so poll for
  // it for a few seconds instead of checking only once.
  useEffect(() => {
    if (hasExtension) return;
    let tries = 0;
    const id = setInterval(() => {
      if (hasNip07()) {
        setHasExtension(true);
        clearInterval(id);
      } else if (++tries > 20) {
        clearInterval(id);
      }
    }, 200);
    return () => clearInterval(id);
  }, [hasExtension]);

  // Auto re-login once the extension is available and the user logged in before.
  useEffect(() => {
    if (!hasExtension || pubkey || !loadState().loggedIn) return;
    setLoading(true);
    loginNip07()
      .then(hydrate)
      .catch(() => updateState({ loggedIn: false }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasExtension]);

  const value = useMemo<AuthState>(
    () => ({
      pubkey,
      profile,
      relays,
      readRelays: relays.length ? readRelays(relays) : fallbackRelays(),
      writeRelays: relays.length ? writeRelays(relays) : fallbackRelays(),
      loading,
      hasExtension,
      error,
      login,
      logout,
    }),
    [pubkey, profile, relays, loading, hasExtension, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
