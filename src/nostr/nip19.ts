// Minimal DIY bech32 + NIP-19 codec (no external deps).
// Encode and decode are kept symmetric over the same primitives.
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= GEN[i];
  }
  return chk;
}

function hrpExpand(hrp: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) >> 5);
  out.push(0);
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) & 31);
  return out;
}

function createChecksum(hrp: string, data: number[]): number[] {
  const values = hrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0]);
  const mod = polymod(values) ^ 1;
  const out: number[] = [];
  for (let i = 0; i < 6; i++) out.push((mod >> (5 * (5 - i))) & 31);
  return out;
}

// Regroup bits between bases (8<->5). pad=true for encode, false for decode.
function convertBits(data: number[], from: number, to: number, pad: boolean): number[] {
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  const maxv = (1 << to) - 1;
  for (const value of data) {
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      out.push((acc >> bits) & maxv);
    }
  }
  if (pad && bits > 0) out.push((acc << (to - bits)) & maxv);
  return out;
}

function hexToBytes(hex: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
}

function bytesToHex(bytes: number[]): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

// bech32 <-> 5-bit words: a symmetric encode/decode pair over the shared checksum.
function bech32Encode(hrp: string, words: number[]): string {
  let out = hrp + '1';
  for (const w of words.concat(createChecksum(hrp, words))) out += CHARSET[w];
  return out;
}

function bech32Decode(bech: string): { hrp: string; words: number[] } | null {
  const lower = bech.toLowerCase();
  const pos = lower.lastIndexOf('1');
  if (pos < 1 || pos + 7 > lower.length) return null;
  const hrp = lower.slice(0, pos);
  const words: number[] = [];
  for (let i = pos + 1; i < lower.length; i++) {
    const v = CHARSET.indexOf(lower[i]);
    if (v === -1) return null;
    words.push(v);
  }
  if (polymod(hrpExpand(hrp).concat(words)) !== 1) return null;
  return { hrp, words: words.slice(0, -6) };
}

// npub: hex pubkey <-> bech32 (encode side used for display/links).
export function npubEncode(pubkeyHex: string): string {
  return bech32Encode('npub', convertBits(hexToBytes(pubkeyHex), 8, 5, true));
}

export function shortNpub(pubkeyHex: string): string {
  try {
    const npub = npubEncode(pubkeyHex);
    return `${npub.slice(0, 12)}…${npub.slice(-6)}`;
  } catch {
    return pubkeyHex.slice(0, 10) + '…';
  }
}

// naddr: addressable event pointer. Decode side only — nostter produces these.
export interface AddrPointer {
  identifier: string;
  pubkey: string;
  kind: number;
  relays: string[];
}

export function naddrDecode(naddr: string): AddrPointer | null {
  const decoded = bech32Decode(naddr.trim());
  if (!decoded || decoded.hrp !== 'naddr') return null;
  const bytes = convertBits(decoded.words, 5, 8, false);
  const utf8 = new TextDecoder();
  let identifier = '';
  let pubkey = '';
  let kind = 0;
  const relays: string[] = [];
  for (let i = 0; i + 2 <= bytes.length; ) {
    const type = bytes[i];
    const len = bytes[i + 1];
    const value = bytes.slice(i + 2, i + 2 + len);
    if (value.length !== len) break;
    i += 2 + len;
    switch (type) {
      case 0: // special: the `d` identifier
        identifier = utf8.decode(new Uint8Array(value));
        break;
      case 1: // relay hint
        relays.push(utf8.decode(new Uint8Array(value)));
        break;
      case 2: // author pubkey (32 bytes)
        pubkey = bytesToHex(value);
        break;
      case 3: // kind (uint32, big-endian)
        kind = ((value[0] << 24) | (value[1] << 16) | (value[2] << 8) | value[3]) >>> 0;
        break;
    }
  }
  if (pubkey.length !== 64) return null;
  return { identifier, pubkey, kind, relays };
}
