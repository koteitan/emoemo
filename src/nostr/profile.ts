// kind:0 profile metadata.
import { fetchEvents, type NostrEvent } from './core';

export interface Profile {
  pubkey: string;
  name?: string;
  display_name?: string;
  picture?: string;
}

function parseProfile(ev: NostrEvent): Profile {
  try {
    const c = JSON.parse(ev.content) as Record<string, string>;
    return {
      pubkey: ev.pubkey,
      name: c.name,
      display_name: c.display_name,
      picture: c.picture,
    };
  } catch {
    return { pubkey: ev.pubkey };
  }
}

function newestPerAuthor(events: NostrEvent[]): NostrEvent[] {
  const byAuthor = new Map<string, NostrEvent>();
  for (const ev of events) {
    const cur = byAuthor.get(ev.pubkey);
    if (!cur || ev.created_at > cur.created_at) byAuthor.set(ev.pubkey, ev);
  }
  return [...byAuthor.values()];
}

export async function fetchProfile(pubkey: string, relays: string[]): Promise<Profile> {
  const [p] = await fetchProfiles([pubkey], relays);
  return p ?? { pubkey };
}

// Batch-fetch kind:0 profiles, chunked by 200 authors per project rules.
export async function fetchProfiles(pubkeys: string[], relays: string[]): Promise<Profile[]> {
  const unique = [...new Set(pubkeys)];
  if (unique.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 200) chunks.push(unique.slice(i, i + 200));

  const results = await Promise.all(
    chunks.map((authors) =>
      fetchEvents([{ kinds: [0], authors, limit: authors.length }], { relays, timeoutMs: 5000 }),
    ),
  );
  return newestPerAuthor(results.flat()).map(parseProfile);
}

// NIP-50 full-text search over kind:0 profiles to find authors by name/display_name.
export async function searchProfiles(
  query: string,
  relays: string[],
  limit = 100,
): Promise<Profile[]> {
  const events = await fetchEvents([{ kinds: [0], search: query, limit }], {
    relays,
    timeoutMs: 5000,
  });
  return newestPerAuthor(events).map(parseProfile);
}
