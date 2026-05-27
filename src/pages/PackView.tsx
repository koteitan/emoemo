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

export default function PackView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const pubkey = params.pubkey!;
  const identifier = decodeURIComponent(params.identifier!);
  const { pubkey: me, readRelays, login } = useAuth();
  const list = useEmojiList();
  const { get, ensure } = useProfiles();
  const [pack, setPack] = useState<EmojiPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchPack({ pubkey, identifier }, readRelays).then((p) => {
      setPack(p);
      setLoading(false);
    });
  }, [pubkey, identifier, readRelays]);

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
        </div>
      </div>
      {status && <p className="status">{status}</p>}

      {pack.emojis.length === 0 ? (
        <p className="muted">{t('pack.empty')}</p>
      ) : (
        <EmojiGrid emojis={pack.emojis} />
      )}
    </div>
  );
}
