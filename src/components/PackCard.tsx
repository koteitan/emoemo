import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { EmojiPack } from '../nostr/emoji';
import { EmojiImg } from './EmojiGrid';
import { shortNpub } from '../nostr/nip19';
import { useProfiles, profileName } from '../context/ProfilesContext';
import { useAuth } from '../context/AuthContext';
import { useEmojiList } from '../context/EmojiListContext';

export default function PackCard({ pack }: { pack: EmojiPack }) {
  const { t } = useTranslation();
  const { get, ensure } = useProfiles();
  const { pubkey: me, login } = useAuth();
  const list = useEmojiList();
  const [saving, setSaving] = useState(false);
  const to = `/set/${pack.pubkey}/${encodeURIComponent(pack.identifier)}`;

  useEffect(() => {
    ensure([pack.pubkey]);
  }, [pack.pubkey, ensure]);

  const author = profileName(get(pack.pubkey), shortNpub(pack.pubkey));
  const ref = { pubkey: pack.pubkey, identifier: pack.identifier };
  const inList = list.isPackInList(ref);

  async function toggleList(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!me) {
      login();
      return;
    }
    const nextRefs = inList
      ? list.packRefs.filter(
          (r) => !(r.pubkey === ref.pubkey && r.identifier === ref.identifier),
        )
      : [...list.packRefs, ref];
    inList ? list.removePack(ref) : list.addPack(ref);
    setSaving(true);
    try {
      await list.save({ packRefs: nextRefs });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pack-card-rel">
      <Link to={to} className="pack-card">
        <div className="pack-card-head">
          <h3 className="pack-title">{pack.title}</h3>
        </div>
        <div className="pack-preview">
          {pack.emojis.slice(0, 12).map((e, i) => (
            <EmojiImg key={`${e.shortcode}-${i}`} emoji={e} size={28} />
          ))}
        </div>
        <div className="pack-footer">
          <span className="pack-by">
            {t('pack.by')} {author}
          </span>
          <span className="pack-count">{t('pack.count', { count: pack.emojis.length })}</span>
        </div>
      </Link>
      <button
        className={`pack-add${inList ? ' in-list' : ''}`}
        onClick={toggleList}
        disabled={saving}
        title={inList ? t('list.removePack') : t('list.addToList')}
        aria-label={inList ? t('list.removePack') : t('list.addToList')}
      >
        {saving ? <span className="spinner small" aria-hidden="true" /> : inList ? '✓' : '+'}
      </button>
    </div>
  );
}
