import type { Emoji } from '../nostr/emoji';
import { isSafeImageUrl } from '../util/url';

export function EmojiImg({ emoji, size = 36 }: { emoji: Emoji; size?: number }) {
  if (!isSafeImageUrl(emoji.url)) {
    return (
      <span
        className="emoji-img emoji-broken"
        title={`:${emoji.shortcode}:`}
        style={{ width: size, height: size }}
      >
        ?
      </span>
    );
  }
  return (
    <img
      className="emoji-img"
      src={emoji.url}
      alt={`:${emoji.shortcode}:`}
      title={`:${emoji.shortcode}:`}
      loading="lazy"
      width={size}
      height={size}
    />
  );
}

export default function EmojiGrid({ emojis, max }: { emojis: Emoji[]; max?: number }) {
  const shown = max ? emojis.slice(0, max) : emojis;
  return (
    <div className="emoji-grid">
      {shown.map((e, i) => (
        <div className="emoji-cell" key={`${e.shortcode}-${i}`}>
          <EmojiImg emoji={e} />
          <span className="emoji-code">{e.shortcode}</span>
        </div>
      ))}
    </div>
  );
}
