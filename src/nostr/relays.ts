// Relay configuration and relay-list resolution (per project nostr rules).
//
// Flow: fetch the user's kind:10002 relay list from the bootstrap relays, then
// use that list for searching packs, reading the user's emoji, and all writes.
// If there is no kind:10002 (and no kind:3) event, fall back to FALLBACK_RELAYS.

export const BOOTSTRAP_RELAYS = [
  'wss://directory.yabu.me',
  'wss://purplepag.es',
  'wss://relay.nostr.band',
  'wss://indexer.coracle.social',
];

const FALLBACK_RELAYS = [
  'wss://r.kojira.io',
  'wss://relay.damus.io',
  'wss://yabu.me',
  'wss://nostr.compile-error.net',
  'wss://nostr.bitcoiner.social',
  'wss://nrelay-jp.c-stellar.net',
  'wss://relay.westernbtc.com',
  'wss://nostream.ocha.one',
  'wss://relay-jp.nostr.wirednet.jp',
  'wss://snowflare.cc',
  'wss://relay.primal.net',
];

export function fallbackRelays(): string[] {
  return [...FALLBACK_RELAYS];
}
