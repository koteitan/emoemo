// Upload an image to nostr.build via NIP-96, authorized with a NIP-98 event.
import type { Nip07 } from '../nostr/nip07';

const NIP96_UPLOAD_URL = 'https://nostr.build/api/v2/nip96/upload';
const KIND_HTTP_AUTH = 27235;

function base64Utf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function nip98Header(nostr: Nip07, url: string, method: string, payloadHash?: string): Promise<string> {
  const tags: string[][] = [
    ['u', url],
    ['method', method],
  ];
  if (payloadHash) tags.push(['payload', payloadHash]);
  const signed = await nostr.signEvent({
    kind: KIND_HTTP_AUTH,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: '',
  });
  return 'Nostr ' + base64Utf8(JSON.stringify(signed));
}

function extractUrl(json: unknown): string | null {
  const obj = json as {
    nip94_event?: { tags?: string[][] };
    data?: { url?: string }[] | { url?: string };
  };
  const tags = obj?.nip94_event?.tags;
  if (Array.isArray(tags)) {
    const urlTag = tags.find((t) => t[0] === 'url');
    if (urlTag?.[1]) return urlTag[1];
  }
  if (Array.isArray(obj?.data) && obj.data[0]?.url) return obj.data[0].url;
  if (!Array.isArray(obj?.data) && obj?.data?.url) return obj.data.url;
  return null;
}

export async function uploadToNostrBuild(file: File): Promise<string> {
  if (!window.nostr) throw new Error('No NIP-07 extension found');

  const payloadHash = await sha256Hex(await file.arrayBuffer());
  const auth = await nip98Header(window.nostr, NIP96_UPLOAD_URL, 'POST', payloadHash);

  const form = new FormData();
  form.append('file', file);

  const res = await fetch(NIP96_UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: auth },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  const url = extractUrl(json);
  if (!url) {
    throw new Error('Upload succeeded but no URL was returned');
  }
  return url;
}
