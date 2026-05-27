// NIP-30 custom emoji + NIP-51 emoji list (kind:10030) / emoji sets (kind:30030).
import { fetchEvents, type NostrEvent } from './core';

export const KIND_EMOJI_LIST = 10030;
export const KIND_EMOJI_SET = 30030;

export interface Emoji {
  shortcode: string;
  url: string;
}

export interface PackRef {
  pubkey: string;
  identifier: string;
}

export interface EmojiPack {
  pubkey: string;
  identifier: string;
  title: string;
  emojis: Emoji[];
  created_at: number;
  event?: NostrEvent;
}

export interface EmojiList {
  pubkey: string;
  emojis: Emoji[];
  packRefs: PackRef[];
  created_at: number;
  event?: NostrEvent;
}

export function packCoordinate(pack: PackRef): string {
  return `${KIND_EMOJI_SET}:${pack.pubkey}:${pack.identifier}`;
}

export function parsePackCoordinate(coord: string): PackRef | null {
  const parts = coord.split(':');
  if (parts.length < 3 || parts[0] !== String(KIND_EMOJI_SET)) return null;
  return { pubkey: parts[1], identifier: parts.slice(2).join(':') };
}

function emojiTags(tags: string[][]): Emoji[] {
  const out: Emoji[] = [];
  for (const t of tags) {
    if (t[0] === 'emoji' && t[1] && t[2]) {
      out.push({ shortcode: t[1], url: t[2] });
    }
  }
  return out;
}

export function parsePack(ev: NostrEvent): EmojiPack {
  const dTag = ev.tags.find((t) => t[0] === 'd');
  const titleTag = ev.tags.find((t) => t[0] === 'title');
  const identifier = dTag?.[1] ?? '';
  return {
    pubkey: ev.pubkey,
    identifier,
    title: titleTag?.[1] || identifier,
    emojis: emojiTags(ev.tags),
    created_at: ev.created_at,
    event: ev,
  };
}

export function parseList(ev: NostrEvent): EmojiList {
  const packRefs: PackRef[] = [];
  for (const t of ev.tags) {
    if (t[0] === 'a' && t[1]) {
      const ref = parsePackCoordinate(t[1]);
      if (ref) packRefs.push(ref);
    }
  }
  return {
    pubkey: ev.pubkey,
    emojis: emojiTags(ev.tags),
    packRefs,
    created_at: ev.created_at,
    event: ev,
  };
}

function newest(events: NostrEvent[]): NostrEvent | undefined {
  return events.reduce<NostrEvent | undefined>(
    (best, e) => (!best || e.created_at > best.created_at ? e : best),
    undefined,
  );
}

export async function fetchUserList(pubkey: string, relays: string[]): Promise<EmojiList | null> {
  const events = await fetchEvents([{ kinds: [KIND_EMOJI_LIST], authors: [pubkey], limit: 1 }], {
    relays,
    timeoutMs: 5000,
  });
  const ev = newest(events);
  return ev ? parseList(ev) : null;
}

export async function fetchUserPacks(pubkey: string, relays: string[]): Promise<EmojiPack[]> {
  const events = await fetchEvents([{ kinds: [KIND_EMOJI_SET], authors: [pubkey] }], {
    relays,
    timeoutMs: 6000,
  });
  return dedupeReplaceable(events).map(parsePack);
}

export async function fetchPack(ref: PackRef, relays: string[]): Promise<EmojiPack | null> {
  const events = await fetchEvents(
    [{ kinds: [KIND_EMOJI_SET], authors: [ref.pubkey], '#d': [ref.identifier] }],
    { relays, timeoutMs: 6000 },
  );
  const ev = newest(events);
  return ev ? parsePack(ev) : null;
}

export async function fetchPacksByRefs(refs: PackRef[], relays: string[]): Promise<EmojiPack[]> {
  if (refs.length === 0) return [];
  const authors = [...new Set(refs.map((r) => r.pubkey))];
  const ids = [...new Set(refs.map((r) => r.identifier))];
  const events = await fetchEvents(
    [{ kinds: [KIND_EMOJI_SET], authors, '#d': ids }],
    { relays, timeoutMs: 6000 },
  );
  const wanted = new Set(refs.map((r) => packCoordinate(r)));
  return dedupeReplaceable(events)
    .map(parsePack)
    .filter((p) => wanted.has(packCoordinate(p)));
}

export async function fetchPacksByAuthors(authors: string[], relays: string[]): Promise<EmojiPack[]> {
  if (authors.length === 0) return [];
  const unique = [...new Set(authors)];
  const events = await fetchEvents([{ kinds: [KIND_EMOJI_SET], authors: unique }], {
    relays,
    timeoutMs: 6000,
  });
  return dedupeReplaceable(events)
    .map(parsePack)
    .filter((p) => p.emojis.length > 0);
}

// Browse recent emoji sets across relays.
export async function fetchRecentPacks(relays: string[], limit = 100): Promise<EmojiPack[]> {
  const events = await fetchEvents([{ kinds: [KIND_EMOJI_SET], limit }], {
    relays,
    timeoutMs: 6000,
  });
  return dedupeReplaceable(events)
    .map(parsePack)
    .filter((p) => p.emojis.length > 0)
    .sort((a, b) => b.created_at - a.created_at);
}

// Full-text search on relays that support NIP-50 (e.g. relay.nostr.band).
export async function searchPacks(
  query: string,
  relays: string[],
  limit = 100,
): Promise<EmojiPack[]> {
  const events = await fetchEvents([{ kinds: [KIND_EMOJI_SET], search: query, limit }], {
    relays,
    timeoutMs: 6000,
  });
  return dedupeReplaceable(events)
    .map(parsePack)
    .filter((p) => p.emojis.length > 0);
}

// Keep only the newest event per (pubkey, d) for parameterized-replaceable kinds.
function dedupeReplaceable(events: NostrEvent[]): NostrEvent[] {
  const byCoord = new Map<string, NostrEvent>();
  for (const ev of events) {
    const d = ev.tags.find((t) => t[0] === 'd')?.[1] ?? '';
    const key = `${ev.pubkey}:${d}`;
    const cur = byCoord.get(key);
    if (!cur || ev.created_at > cur.created_at) byCoord.set(key, ev);
  }
  return [...byCoord.values()];
}

// --- event builders (tags only; signing/publishing happens in core) ---

export function buildPackTags(pack: { identifier: string; title: string; emojis: Emoji[] }): string[][] {
  const tags: string[][] = [['d', pack.identifier]];
  if (pack.title) tags.push(['title', pack.title]);
  for (const e of pack.emojis) {
    if (e.shortcode && e.url) tags.push(['emoji', e.shortcode, e.url]);
  }
  return tags;
}

export function buildListTags(list: { emojis: Emoji[]; packRefs: PackRef[] }): string[][] {
  const tags: string[][] = [];
  for (const e of list.emojis) {
    if (e.shortcode && e.url) tags.push(['emoji', e.shortcode, e.url]);
  }
  for (const ref of list.packRefs) {
    tags.push(['a', packCoordinate(ref)]);
  }
  return tags;
}
