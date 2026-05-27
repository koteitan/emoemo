// rx-nostr instance and low-level fetch/publish helpers.
import {
  createRxNostr,
  createRxBackwardReq,
  nip07Signer,
  type RxNostr,
  type LazyFilter,
} from 'rx-nostr';
import { verifier } from 'rx-nostr-crypto';
import { BOOTSTRAP_RELAYS, fallbackRelays } from './relays';

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface RelayEntry {
  url: string;
  read: boolean;
  write: boolean;
}

export const rxNostr: RxNostr = createRxNostr({
  verifier,
  signer: nip07Signer(),
});

interface FetchOptions {
  relays?: string[];
  timeoutMs?: number;
}

// Collect events matching the filters using rx-nostr's backward strategy.
// Resolves on EOSE-completion or after timeoutMs, de-duplicating by event id.
export function fetchEvents(
  filters: LazyFilter[],
  { relays, timeoutMs = 5000 }: FetchOptions = {},
): Promise<NostrEvent[]> {
  return new Promise((resolve) => {
    const events = new Map<string, NostrEvent>();
    const req = createRxBackwardReq();
    const useOpts = relays && relays.length > 0 ? { relays } : undefined;

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      sub.unsubscribe();
      resolve([...events.values()]);
    };

    const sub = rxNostr.use(req, useOpts).subscribe({
      next: (packet) => {
        const ev = packet.event as NostrEvent;
        events.set(ev.id, ev);
      },
      complete: finish,
      error: finish,
    });
    const timer = setTimeout(finish, timeoutMs);

    req.emit(filters);
    req.over();
  });
}

// Sign (via NIP-07) and publish an event. Resolves to the relays that accepted it.
export function publishEvent(
  params: { kind: number; content: string; tags: string[][]; created_at?: number },
  relays?: string[],
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const accepted: string[] = [];
    const sendOpts = relays && relays.length > 0 ? { relays } : undefined;
    let settled = false;
    const obs = rxNostr.send(params, sendOpts);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      accepted.length > 0 ? resolve(accepted) : reject(new Error('No relay accepted the event'));
    }, 8000);
    obs.subscribe({
      next: (packet) => {
        if (packet.ok) accepted.push(packet.from);
      },
      complete: () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        accepted.length > 0 ? resolve(accepted) : reject(new Error('No relay accepted the event'));
      },
      error: (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      },
    });
  });
}

function newest(events: NostrEvent[]): NostrEvent | undefined {
  return events.reduce<NostrEvent | undefined>(
    (best, e) => (!best || e.created_at > best.created_at ? e : best),
    undefined,
  );
}

// Resolve a user's relay list per project rules: prefer kind:10002, fall back to
// kind:3 content, then to locale fallback relays. Returns read+write entries.
export async function fetchRelayList(pubkey: string): Promise<RelayEntry[]> {
  let events = await fetchEvents([{ kinds: [10002, 3], authors: [pubkey], limit: 2 }], {
    relays: BOOTSTRAP_RELAYS,
    timeoutMs: 5000,
  });
  if (events.length === 0) {
    events = await fetchEvents([{ kinds: [10002, 3], authors: [pubkey], limit: 2 }], {
      relays: BOOTSTRAP_RELAYS,
      timeoutMs: 30000,
    });
  }

  const rl10002 = newest(events.filter((e) => e.kind === 10002));
  if (rl10002) return parseNip65(rl10002);

  const rl3 = newest(events.filter((e) => e.kind === 3));
  if (rl3) {
    const parsed = parseKind3Relays(rl3);
    if (parsed.length > 0) return parsed;
  }

  return fallbackRelays().map((url) => ({ url, read: true, write: true }));
}

function parseNip65(ev: NostrEvent): RelayEntry[] {
  const out: RelayEntry[] = [];
  for (const tag of ev.tags) {
    if (tag[0] !== 'r' || !tag[1]) continue;
    const marker = tag[2];
    out.push({
      url: tag[1],
      read: !marker || marker === 'read',
      write: !marker || marker === 'write',
    });
  }
  return out;
}

function parseKind3Relays(ev: NostrEvent): RelayEntry[] {
  try {
    const obj = JSON.parse(ev.content) as Record<string, { read?: boolean; write?: boolean }>;
    return Object.entries(obj).map(([url, v]) => ({
      url,
      read: v.read !== false,
      write: v.write !== false,
    }));
  } catch {
    return [];
  }
}

export function readRelays(entries: RelayEntry[]): string[] {
  const r = entries.filter((e) => e.read).map((e) => e.url);
  return r.length > 0 ? r : fallbackRelays();
}

export function writeRelays(entries: RelayEntry[]): string[] {
  const w = entries.filter((e) => e.write).map((e) => e.url);
  return w.length > 0 ? w : fallbackRelays();
}
