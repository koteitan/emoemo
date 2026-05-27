import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { fetchUserPacks, type EmojiPack } from '../nostr/emoji';
import PackCard from '../components/PackCard';

export default function MyPacks() {
  const { t } = useTranslation();
  const { pubkey, readRelays } = useAuth();
  const [packs, setPacks] = useState<EmojiPack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pubkey) return;
    setLoading(true);
    fetchUserPacks(pubkey, readRelays).then((p) => {
      setPacks(p.sort((a, b) => b.created_at - a.created_at));
      setLoading(false);
    });
  }, [pubkey, readRelays]);

  if (!pubkey) return <p className="muted">{t('auth.loginRequired')}</p>;

  return (
    <div>
      <div className="page-head">
        <h1>{t('nav.myPacks')}</h1>
        <Link to="/pack/new" className="btn">
          + {t('nav.newPack')}
        </Link>
      </div>
      {loading ? (
        <p className="muted">{t('common.loading')}</p>
      ) : packs.length === 0 ? (
        <p className="muted">{t('pack.noPacks')}</p>
      ) : (
        <div className="pack-grid">
          {packs.map((p) => (
            <PackCard key={`${p.pubkey}:${p.identifier}`} pack={p} />
          ))}
        </div>
      )}
    </div>
  );
}
