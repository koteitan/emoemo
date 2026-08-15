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
import { useAuth } from '../context/AuthContext';
import { useProfiles } from '../context/ProfilesContext';
import PackCard from '../components/PackCard';
import Loading from '../components/Loading';

const PAGE_SIZE = 15;

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
  const [visible, setVisible] = useState(PAGE_SIZE); // how many cards to render
  const [loadingMore, setLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false); // relay feed exhausted
  const searchSeq = useRef(0);

  // Search/browse on the user's relay list (or fallback relays when logged out).
  const relays = readRelays;

  // Initial page of recent sets (small, to keep transfer down).
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchRecentPacks(relays, PAGE_SIZE).then((p) => {
      if (!alive) return;
      setPool((prev) => mergePacks(prev, p));
      setReachedEnd(p.length < PAGE_SIZE);
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

  // Reset how many cards are shown whenever the query changes.
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [query]);

  // Debounced network expansion: search sets (NIP-50) and authors by name.
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

  // Reveal the next page; when browsing (no query) and the pool runs out, fetch
  // the next page of older sets from the relays.
  async function loadMore() {
    const next = visible + PAGE_SIZE;
    setVisible(next);
    if (query.trim() || loadingMore || reachedEnd) return;
    if (next < pool.length) return; // still have buffered items to reveal
    setLoadingMore(true);
    const until = pool.reduce((m, p) => Math.min(m, p.created_at), Infinity);
    const older = await fetchRecentPacks(
      relays,
      PAGE_SIZE,
      Number.isFinite(until) ? until : undefined,
    );
    const known = new Set(pool.map(packCoordinate));
    const fresh = older.filter((p) => !known.has(packCoordinate(p)));
    if (fresh.length === 0) setReachedEnd(true);
    else setPool((prev) => mergePacks(prev, fresh));
    setLoadingMore(false);
  }

  const canLoadMore = !loading && (visible < shown.length || (!query.trim() && !reachedEnd));

  return (
    <div>
      <h1>
        {t('browse.title')}
        <small className="title-note">{t('browse.searchTargets')}</small>
      </h1>
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
        <>
          <div className="pack-grid">
            {shown.slice(0, visible).map((p) => (
              <PackCard key={packCoordinate(p)} pack={p} />
            ))}
          </div>
          {canLoadMore && (
            <div className="load-more">
              <button className="btn-ghost" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? t('common.loading') : t('browse.loadMore')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
