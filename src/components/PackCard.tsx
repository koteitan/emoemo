import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { EmojiPack } from '../nostr/emoji';
import { EmojiImg } from './EmojiGrid';
import { shortNpub } from '../nostr/nip19';
import { useProfiles, profileName } from '../context/ProfilesContext';

export default function PackCard({ pack }: { pack: EmojiPack }) {
  const { t } = useTranslation();
  const { get, ensure } = useProfiles();
  const to = `/pack/${pack.pubkey}/${encodeURIComponent(pack.identifier)}`;

  useEffect(() => {
    ensure([pack.pubkey]);
  }, [pack.pubkey, ensure]);

  const author = profileName(get(pack.pubkey), shortNpub(pack.pubkey));

  return (
    <Link to={to} className="pack-card">
      <div className="pack-card-head">
        <h3 className="pack-title">{pack.title}</h3>
        <span className="pack-count">{t('pack.count', { count: pack.emojis.length })}</span>
      </div>
      <div className="pack-preview">
        {pack.emojis.slice(0, 12).map((e, i) => (
          <EmojiImg key={`${e.shortcode}-${i}`} emoji={e} size={28} />
        ))}
      </div>
      <div className="pack-by">
        {t('pack.by')} {author}
      </div>
    </Link>
  );
}
