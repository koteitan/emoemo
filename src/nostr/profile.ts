// kind:0 profile metadata.
import { fetchEvents } from './core';

export interface Profile {
  pubkey: string;
  name?: string;
  display_name?: string;
  picture?: string;
}

export async function fetchProfile(pubkey: string, relays: string[]): Promise<Profile> {
  const events = await fetchEvents([{ kinds: [0], authors: [pubkey], limit: 1 }], {
    relays,
    timeoutMs: 5000,
  });
  const newest = events.reduce<(typeof events)[number] | undefined>(
    (best, e) => (!best || e.created_at > best.created_at ? e : best),
    undefined,
  );
  if (!newest) return { pubkey };
  try {
    const c = JSON.parse(newest.content) as Record<string, string>;
    return {
      pubkey,
      name: c.name,
      display_name: c.display_name,
      picture: c.picture,
    };
  } catch {
    return { pubkey };
  }
}
