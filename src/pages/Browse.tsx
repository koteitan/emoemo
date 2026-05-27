import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchRecentPacks,
  fetchPacksByAuthors,
  searchPacks,
  packCoordinate,
  type EmojiPack,
} from '../nostr/emoji';
import { searchProfiles } from '../nostr/profile';
import { browseRelays } from '../nostr/relays';
import { useAuth } from '../context/AuthContext';
import { useProfiles } from '../context/ProfilesContext';
import PackCard from '../components/PackCard';
import Loading from '../components/Loading';

function mergePacks(base: EmojiPack[], add: EmojiPack[]): EmojiPack[] {
  const map = new Map<string, EmojiPack>();
  for (const p of [...base, ...add]) {
    const key = packCoordinate(p);
    const cur = map.get(key);
    if (!cur || p.created_at > cur.created_at) map.set(key, p);
  }
  return [...map.values()];
}

export default function Browse() {
  const { t } = useTranslation();
  const { readRelays } = useAuth();
  const { get, ensure, merge } = useProfiles();
  const [pool, setPool] = useState<EmojiPack[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const searchSeq = useRef(0);

  const relays = useMemo(
    () => [...new Set([...browseRelays(), ...readRelays])],
    [readRelays],
  );

  // Initial recent packs.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchRecentPacks(relays, 100).then((p) => {
      if (!alive) return;
      setPool((prev) => mergePacks(prev, p));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [relays]);

  // Keep author profiles loaded for everything in the pool (for author-name search).
  useEffect(() => {
    ensure(pool.map((p) => p.pubkey));
  }, [pool, ensure]);

  // Debounced network expansion: search packs (NIP-50) and authors by name.
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const seq = ++searchSeq.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      const [byText, profiles] = await Promise.all([
        searchPacks(q, relays, 100),
        searchProfiles(q, relays, 50),
      ]);
      if (profiles.length) merge(profiles);
      const byAuthor = await fetchPacksByAuthors(
        profiles.map((p) => p.pubkey),
        relays,
      );
      if (seq !== searchSeq.current) return; // a newer keystroke superseded us
      setPool((prev) => mergePacks(prev, mergePacks(byText, byAuthor)));
      setSearching(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [query, relays, merge]);

  // Client-side filter over the accumulated pool (instant on every keystroke).
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? pool.filter((p) => {
          if (p.title.toLowerCase().includes(q)) return true;
          if (p.emojis.some((e) => e.shortcode.toLowerCase().includes(q))) return true;
          const prof = get(p.pubkey);
          const name = `${prof?.display_name ?? ''} ${prof?.name ?? ''}`.toLowerCase();
          return name.includes(q);
        })
      : pool;
    return [...list].sort((a, b) => b.created_at - a.created_at);
  }, [pool, query, get]);

  return (
    <div>
      <h1>{t('browse.title')}</h1>
      <div className="search-bar">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('browse.searchPlaceholder')}
        />
        {searching && <span className="spinner small" aria-hidden="true" />}
      </div>

      {loading ? (
        <Loading text={t('browse.loading')} />
      ) : shown.length === 0 ? (
        <p className="muted">{t('browse.noResults')}</p>
      ) : (
        <div className="pack-grid">
          {shown.map((p) => (
            <PackCard key={packCoordinate(p)} pack={p} />
          ))}
        </div>
      )}
    </div>
  );
}
