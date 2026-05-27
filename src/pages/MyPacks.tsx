import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { fetchUserPacks, packMatchesQuery, type EmojiPack } from '../nostr/emoji';
import PackCard from '../components/PackCard';
import Loading from '../components/Loading';

export default function MyPacks() {
  const { t } = useTranslation();
  const { pubkey, readRelays } = useAuth();
  const [packs, setPacks] = useState<EmojiPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!pubkey) return;
    setLoading(true);
    fetchUserPacks(pubkey, readRelays).then((p) => {
      setPacks(p.sort((a, b) => b.created_at - a.created_at));
      setLoading(false);
    });
  }, [pubkey, readRelays]);

  const shown = useMemo(() => packs.filter((p) => packMatchesQuery(p, query)), [packs, query]);

  if (!pubkey) return <p className="muted">{t('auth.loginRequired')}</p>;

  return (
    <div>
      <h1>{t('nav.myPacks')}</h1>
      {packs.length > 0 && (
        <div className="search-bar">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('browse.searchPlaceholder')}
          />
        </div>
      )}
      {loading ? (
        <Loading text={t('common.loading')} />
      ) : packs.length === 0 ? (
        <p className="muted">{t('pack.noPacks')}</p>
      ) : shown.length === 0 ? (
        <p className="muted">{t('browse.noResults')}</p>
      ) : (
        <div className="pack-grid">
          {shown.map((p) => (
            <PackCard key={`${p.pubkey}:${p.identifier}`} pack={p} />
          ))}
        </div>
      )}
    </div>
  );
}
