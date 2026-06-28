import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  buildPackTags,
  fetchPack,
  fetchUserPacks,
  KIND_EMOJI_SET,
  type Emoji,
  type EmojiPack,
} from '../nostr/emoji';
import { publishEvent } from '../nostr/core';
import { EmojiImg } from '../components/EmojiGrid';
import Loading from '../components/Loading';

// Source pack handed over from PackView via router state (same pattern as fork).
interface Source {
  pubkey: string;
  identifier: string;
  title: string;
  emojis: Emoji[];
}

function sameEmoji(a: Emoji, b: Emoji): boolean {
  return a.shortcode === b.shortcode && a.url === b.url;
}

export default function CopyItem() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const srcPubkey = params.pubkey!;
  const srcIdentifier = decodeURIComponent(params.identifier!);
  const { pubkey: me, readRelays, writeRelays } = useAuth();

  // Fast path: PackView hands the pack over via router state. On a fresh load
  // (reload / shared link) there is no state, so fetch it from the URL params.
  const stateSource = (location.state as { source?: Source } | null)?.source;

  const [source, setSource] = useState<Source | null>(stateSource ?? null);
  const [sourceLoading, setSourceLoading] = useState(!stateSource);
  const [packs, setPacks] = useState<EmojiPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Emoji staged to add to the currently selected destination pack.
  const [added, setAdded] = useState<Emoji[]>([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (stateSource) return; // already have the pack from PackView
    setSourceLoading(true);
    fetchPack({ pubkey: srcPubkey, identifier: srcIdentifier }, readRelays).then((p) => {
      if (p) {
        setSource({ pubkey: p.pubkey, identifier: p.identifier, title: p.title, emojis: p.emojis });
      }
      setSourceLoading(false);
    });
    // stateSource is stable for a given history entry; fetch only on real loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcPubkey, srcIdentifier, readRelays]);

  useEffect(() => {
    if (!me) return;
    setLoading(true);
    fetchUserPacks(me, readRelays).then((p) => {
      const sorted = p.sort((a, b) => b.created_at - a.created_at);
      setPacks(sorted);
      // Default selection: the newest pack (highest created_at).
      setSelectedId((cur) => cur ?? sorted[0]?.identifier ?? null);
      setLoading(false);
    });
  }, [me, readRelays]);

  const selected = useMemo(
    () => packs.find((p) => p.identifier === selectedId) ?? null,
    [packs, selectedId],
  );

  // Resulting emoji of the selected destination pack: original + staged adds.
  const mergedEmojis = useMemo(
    () => (selected ? [...selected.emojis, ...added] : []),
    [selected, added],
  );

  if (!me) return <p className="muted">{t('auth.loginRequired')}</p>;
  if (sourceLoading) return <Loading text={t('common.loading')} />;
  if (!source) return <p className="muted">{t('pack.notFound')}</p>;

  function selectPack(id: string) {
    if (id === selectedId) return;
    setSelectedId(id);
    setAdded([]); // staging belongs to one destination; reset on switch
    setStatus('');
  }

  function inPack(e: Emoji): boolean {
    return !!selected?.emojis.some((x) => x.shortcode === e.shortcode);
  }
  function isStaged(e: Emoji): boolean {
    return added.some((x) => sameEmoji(x, e));
  }

  function toggleEmoji(e: Emoji) {
    if (inPack(e)) return; // already part of the destination pack
    setAdded((prev) =>
      prev.some((x) => sameEmoji(x, e))
        ? prev.filter((x) => !sameEmoji(x, e))
        : [...prev, e],
    );
  }

  async function onSave() {
    if (!selected || added.length === 0) return;
    setSaving(true);
    setStatus(t('common.publishing'));
    try {
      const tags = buildPackTags({
        identifier: selected.identifier,
        title: selected.title,
        emojis: mergedEmojis,
      });
      const relays = await publishEvent(
        { kind: KIND_EMOJI_SET, content: '', tags },
        writeRelays,
      );
      setStatus(t('common.publishedTo', { count: relays.length }));
      navigate(`/pack/${me}/${encodeURIComponent(selected.identifier)}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="copyitem">
      <h1>{t('copyitem.title')}</h1>

      {/* Destination pack (top) */}
      <section className="copy-dest">
        <h2>{t('copyitem.dest')}</h2>
        <p className="muted">{t('copyitem.chooseDest')}</p>
        {loading ? (
          <Loading text={t('common.loading')} />
        ) : packs.length === 0 ? (
          <p className="muted">{t('copyitem.noPacks')}</p>
        ) : (
          <div className="copy-pack-list">
            {packs.map((p) => {
              const isSel = p.identifier === selectedId;
              const emojis = isSel ? mergedEmojis : p.emojis;
              return (
                <button
                  type="button"
                  key={p.identifier}
                  className={`pack-card copy-pack-card${isSel ? ' selected' : ''}`}
                  onClick={() => selectPack(p.identifier)}
                  aria-pressed={isSel}
                >
                  <div className="pack-card-head">
                    <h3 className="pack-title">{p.title}</h3>
                    {isSel && added.length > 0 && (
                      <span className="copy-added-badge">+{added.length}</span>
                    )}
                  </div>
                  <div className="pack-preview">
                    {emojis.slice(0, 12).map((e, i) => (
                      <EmojiImg key={`${e.shortcode}-${i}`} emoji={e} size={28} />
                    ))}
                  </div>
                  <div className="pack-footer">
                    <span className="pack-count">
                      {t('pack.count', { count: emojis.length })}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Big arrow: copies flow from source (bottom) up into destination (top) */}
      <div className="copy-arrow" aria-hidden="true">⇧</div>

      {/* Source pack (bottom) */}
      <section className="copy-source">
        <h2>
          {t('copyitem.source')}: {source.title}
        </h2>
        <p className="muted">{t('copyitem.clickToAdd')}</p>
        {source.emojis.length === 0 ? (
          <p className="muted">{t('pack.empty')}</p>
        ) : (
          <div className="emoji-grid">
            {source.emojis.map((e, i) => {
              const done = inPack(e);
              const staged = isStaged(e);
              return (
                <button
                  type="button"
                  key={`${e.shortcode}-${i}`}
                  className={`emoji-cell copy-emoji${staged ? ' staged' : ''}${done ? ' done' : ''}`}
                  onClick={() => toggleEmoji(e)}
                  disabled={done}
                  title={done ? t('copyitem.already') : `:${e.shortcode}:`}
                >
                  <EmojiImg emoji={e} />
                  <span className="emoji-code">{e.shortcode}</span>
                  {(staged || done) && <span className="copy-check">✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className="save-bar">
        <button className="btn" disabled={saving || added.length === 0} onClick={onSave}>
          {t('copyitem.save')}
        </button>
        {status && <span className="status">{status}</span>}
      </div>
    </div>
  );
}
