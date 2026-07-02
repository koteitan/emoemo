import { useTranslation } from 'react-i18next';
import type { Emoji } from '../nostr/emoji';
import UploadButton from './UploadButton';
import TransparencyButton from './TransparencyButton';
import { EmojiImg } from './EmojiGrid';

interface Props {
  emojis: Emoji[];
  onChange: (emojis: Emoji[]) => void;
  // Called after an action that produces a fresh save-worthy change (e.g. the
  // "周辺透明化" result) so the parent can nudge the user toward saving.
  onSaveNudge?: () => void;
}

// Editable list of emoji rows (shortcode + url + upload + preview).
export default function EmojiEditor({ emojis, onChange, onSaveNudge }: Props) {
  const { t } = useTranslation();

  const update = (i: number, patch: Partial<Emoji>) =>
    onChange(emojis.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const remove = (i: number) => onChange(emojis.filter((_, idx) => idx !== i));
  const add = () => onChange([...emojis, { shortcode: '', url: '' }]);

  return (
    <div className="emoji-editor">
      {emojis.map((e, i) => (
        <div className="emoji-row" key={i}>
          <div className="emoji-row-preview">
            {e.url ? <EmojiImg emoji={e} /> : <span className="emoji-placeholder">?</span>}
          </div>
          <input
            className="shortcode-input"
            placeholder={t('pack.shortcode')}
            value={e.shortcode}
            onChange={(ev) =>
              update(i, { shortcode: ev.target.value.replace(/[^a-zA-Z0-9_]/g, '_') })
            }
          />
          <input
            className="url-input"
            placeholder={t('pack.url')}
            value={e.url}
            onChange={(ev) => update(i, { url: ev.target.value })}
          />
          <UploadButton onUploaded={(url) => update(i, { url })} />
          <TransparencyButton
            url={e.url}
            onProcessed={(url) => {
              update(i, { url });
              onSaveNudge?.();
            }}
          />
          <button type="button" className="btn-ghost danger" onClick={() => remove(i)}>
            {t('pack.remove')}
          </button>
        </div>
      ))}
      <button type="button" className="btn-ghost" onClick={add}>
        + {t('pack.addEmoji')}
      </button>
    </div>
  );
}
