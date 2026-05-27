// Relay configuration and relay-list resolution (per project nostr rules).

export const BOOTSTRAP_RELAYS = [
  'wss://directory.yabu.me',
  'wss://purplepag.es',
  'wss://relay.nostr.band',
  'wss://indexer.coracle.social',
];

const FALLBACK_RELAYS_JA = [
  'wss://yabu.me',
  'wss://nostr.compile-error.net',
  'wss://r.kojira.io',
  'wss://relay-jp.nostr.wirednet.jp',
  'wss://nrelay-jp.c-stellar.net',
  'wss://nostream.ocha.one',
  'wss://snowflare.cc',
];

const FALLBACK_RELAYS_EN = [
  'wss://relay.damus.io',
  'wss://nostr-pub.wellorder.net',
  'wss://offchain.pub',
  'wss://relay.snort.social',
];

export function fallbackRelays(): string[] {
  const locale = navigator.language || 'en';
  return locale.startsWith('ja') ? FALLBACK_RELAYS_JA : FALLBACK_RELAYS_EN;
}

// Relays used for browsing/searching packs when the user is not logged in.
// relay.nostr.band supports NIP-50 full-text search.
export function browseRelays(): string[] {
  return [...new Set(['wss://relay.nostr.band', ...fallbackRelays()])];
}
