// NIP-07 browser-extension helpers (window.nostr).
import type { NostrEvent } from './core';

export interface Nip07 {
  getPublicKey(): Promise<string>;
  signEvent(event: {
    kind: number;
    created_at: number;
    tags: string[][];
    content: string;
  }): Promise<NostrEvent>;
  getRelays?(): Promise<Record<string, { read: boolean; write: boolean }>>;
}

declare global {
  interface Window {
    nostr?: Nip07;
  }
}

export function hasNip07(): boolean {
  return typeof window !== 'undefined' && !!window.nostr;
}

export async function loginNip07(): Promise<string> {
  if (!window.nostr) {
    throw new Error('No NIP-07 extension found');
  }
  return window.nostr.getPublicKey();
}
