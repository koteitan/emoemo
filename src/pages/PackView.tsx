import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchPack, type EmojiPack } from '../nostr/emoji';
import { useAuth } from '../context/AuthContext';
import { useEmojiList } from '../context/EmojiListContext';
import { useProfiles, profileName } from '../context/ProfilesContext';
import EmojiGrid from '../components/EmojiGrid';
import Loading from '../components/Loading';
import { shortNpub } from '../nostr/nip19';

interface PackViewProps {
  // When rendered from an naddr link the source coordinate and relay hints are
  // passed in directly; otherwise they come from the /pack/:pubkey/:identifier route.
  pubkey?: string;
  identifier?: string;
  relayHints?: string[];
}

export default function PackView({
  pubkey: pubkeyProp,
  identifier: identifierProp,
  relayHints,
}: PackViewProps = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const pubkey = pubkeyProp ?? params.pubkey!;
  const identifier = identifierProp ?? decodeURIComponent(params.identifier!);
  const { pubkey: me, readRelays, login } = useAuth();
  const list = useEmojiList();
  const { get, ensure } = useProfiles();
  const [pack, setPack] = useState<EmojiPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [emojiQuery, setEmojiQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    // Seed the fetch with the naddr's relay hints so sets that live on relays
    // the user doesn't normally read still resolve.
    const relays =
      relayHints && relayHints.length
        ? [...new Set([...readRelays, ...relayHints])]
        : readRelays;
    fetchPack({ pubkey, identifier }, relays).then((p) => {
      setPack(p);
      setLoading(false);
    });
  }, [pubkey, identifier, readRelays, relayHints]);

  useEffect(() => {
    ensure([pubkey]);
  }, [pubkey, ensure]);

  if (loading) return <Loading text={t('common.loading')} />;
  if (!pack) return <p className="muted">{t('pack.notFound')}</p>;

  const ref = { pubkey, identifier };
  const inList = list.isPackInList(ref);
  const isOwner = me === pubkey;
  const author = profileName(get(pubkey), shortNpub(pubkey));

  function duplicate() {
    if (!pack) return;
    navigate('/pack/new', {
      state: { fork: { title: pack.title + t('pack.copySuffix'), emojis: pack.emojis } },
    });
  }

  function copyItem() {
    if (!pack) return;
    // Source pubkey/identifier live in the URL so the page survives a reload;
    // the pack data is also passed via state to render instantly when arriving here.
    navigate(`/pack/copyitem/${pubkey}/${encodeURIComponent(identifier)}`, {
      state: { source: { pubkey, identifier, title: pack.title, emojis: pack.emojis } },
    });
  }

  // Incremental, display-only filter over this pack's emoji by shortcode.
  const q = emojiQuery.trim().toLowerCase();
  const filteredEmojis = q
    ? pack.emojis.filter((e) => e.shortcode.toLowerCase().includes(q))
    : pack.emojis;

  async function toggleList() {
    if (!me) return;
    const nextRefs = inList
      ? list.packRefs.filter((r) => !(r.pubkey === pubkey && r.identifier === identifier))
      : [...list.packRefs, ref];
    inList ? list.removePack(ref) : list.addPack(ref);
    setStatus(t('common.publishing'));
    try {
      const relays = await list.save({ packRefs: nextRefs });
      setStatus(t('common.publishedTo', { count: relays.length }));
    } catch (e) {
      setStatus(e instanceof Error ? e.message : t('common.error'));
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{pack.title}</h1>
          <div className="pack-by">
            {t('pack.by')} {author} · {t('pack.count', { count: pack.emojis.length })}
          </div>
        </div>
        <div className="pack-actions">
          {inList && <span className="badge">✓ {t('list.inList')}</span>}
          {me ? (
            <button className={inList ? 'btn-ghost' : 'btn'} onClick={toggleList}>
              {inList ? t('list.removePack') : t('list.addToList')}
            </button>
          ) : (
            <button className="btn" onClick={login}>
              {t('list.addToList')}
            </button>
          )}
          {isOwner && (
            <Link
              className="btn-ghost"
              to={`/pack/${pubkey}/${encodeURIComponent(identifier)}/edit`}
            >
              {t('common.edit')}
            </Link>
          )}
          {me && (
            <button className="btn-ghost" onClick={duplicate}>
              {t('pack.duplicate')}
            </button>
          )}
          {me && (
            <button className="btn-ghost" onClick={copyItem}>
              {t('pack.copyItem')}
            </button>
          )}
        </div>
      </div>
      {status && <p className="status">{status}</p>}

      {pack.emojis.length === 0 ? (
        <p className="muted">{t('pack.empty')}</p>
      ) : (
        <>
          <div className="search-bar">
            <input
              type="text"
              value={emojiQuery}
              onChange={(e) => setEmojiQuery(e.target.value)}
              placeholder={t('pack.filterPlaceholder')}
            />
          </div>
          {filteredEmojis.length === 0 ? (
            <p className="muted">{t('browse.noResults')}</p>
          ) : (
            <EmojiGrid emojis={filteredEmojis} />
          )}
        </>
      )}
    </div>
  );
}
