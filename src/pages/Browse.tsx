import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchRecentPacks, searchPacks, type EmojiPack } from '../nostr/emoji';
import { browseRelays } from '../nostr/relays';
import { useAuth } from '../context/AuthContext';
import PackCard from '../components/PackCard';

export default function Browse() {
  const { t } = useTranslation();
  const { readRelays } = useAuth();
  const [packs, setPacks] = useState<EmojiPack[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  const relays = [...new Set([...browseRelays(), ...readRelays])];

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchRecentPacks(relays, 100).then((p) => {
      if (alive) {
        setPacks(p);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    setSearching(true);
    setLoading(true);
    const result = q
      ? await searchPacks(q, relays, 100)
      : await fetchRecentPacks(relays, 100);
    setPacks(result);
    setLoading(false);
    setSearching(false);
  }

  return (
    <div>
      <h1>{t('browse.title')}</h1>
      <form className="search-bar" onSubmit={onSearch}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('browse.searchPlaceholder')}
        />
        <button className="btn" type="submit" disabled={searching}>
          {t('browse.search')}
        </button>
      </form>

      {loading ? (
        <p className="muted">{t('browse.loading')}</p>
      ) : packs.length === 0 ? (
        <p className="muted">{t('browse.noResults')}</p>
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
