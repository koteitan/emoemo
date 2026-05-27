import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { fetchProfiles, type Profile } from '../nostr/profile';
import { browseRelays } from '../nostr/relays';
import { useAuth } from './AuthContext';

interface ProfilesState {
  get: (pubkey: string) => Profile | undefined;
  ensure: (pubkeys: string[]) => void;
  merge: (profiles: Profile[]) => void;
}

const Ctx = createContext<ProfilesState | null>(null);

export function ProfilesProvider({ children }: { children: ReactNode }) {
  const { readRelays } = useAuth();
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const knownRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const merge = useCallback((list: Profile[]) => {
    if (list.length === 0) return;
    for (const p of list) knownRef.current.add(p.pubkey);
    setProfiles((prev) => {
      const next = new Map(prev);
      for (const p of list) next.set(p.pubkey, p);
      return next;
    });
  }, []);

  const flush = useCallback(() => {
    const batch = [...queueRef.current];
    queueRef.current.clear();
    if (batch.length === 0) return;
    const relays = [...new Set([...browseRelays(), ...readRelays])];
    fetchProfiles(batch, relays).then((found) => {
      // Mark all requested as known even if no profile came back (avoid refetch loops).
      for (const pk of batch) knownRef.current.add(pk);
      merge(found);
    });
  }, [readRelays, merge]);

  const ensure = useCallback(
    (pubkeys: string[]) => {
      let added = false;
      for (const pk of pubkeys) {
        if (!pk || knownRef.current.has(pk) || queueRef.current.has(pk)) continue;
        queueRef.current.add(pk);
        added = true;
      }
      if (!added) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, 150);
    },
    [flush],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const get = useCallback((pubkey: string) => profiles.get(pubkey), [profiles]);

  return <Ctx.Provider value={{ get, ensure, merge }}>{children}</Ctx.Provider>;
}

export function useProfiles(): ProfilesState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProfiles must be used within ProfilesProvider');
  return ctx;
}

// Convenience: human-readable author label with shortNpub fallback.
export function profileName(profile: Profile | undefined, fallback: string): string {
  return profile?.display_name?.trim() || profile?.name?.trim() || fallback;
}
