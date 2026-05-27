// Only allow http(s) image URLs to be rendered as <img src>.
// (Blocks data:, blob:, javascript:, etc. — defense-in-depth for untrusted URLs.)
export function isSafeImageUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url, window.location.href);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
