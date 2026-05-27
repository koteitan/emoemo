import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useEmojiList } from '../context/EmojiListContext';
import { fetchPacksByRefs, type EmojiPack } from '../nostr/emoji';
import EmojiEditor from '../components/EmojiEditor';
import { EmojiImg } from '../components/EmojiGrid';

export default function MyList() {
  const { t } = useTranslation();
  const { pubkey, readRelays } = useAuth();
  const list = useEmojiList();
  const [packs, setPacks] = useState<EmojiPack[]>([]);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  // standalone emoji draft mirrors context state
  const [emojis, setEmojis] = useState(list.emojis);
  useEffect(() => setEmojis(list.emojis), [list.loaded]);

  useEffect(() => {
    if (!list.loaded) return;
    fetchPacksByRefs(list.packRefs, readRelays).then(setPacks);
  }, [list.loaded, list.packRefs, readRelays]);

  if (!pubkey) return <p className="muted">{t('auth.loginRequired')}</p>;
  if (!list.loaded) return <p className="muted">{t('common.loading')}</p>;

  async function onSave() {
    setSaving(true);
    setStatus(t('common.publishing'));
    const clean = emojis.filter((e) => e.shortcode && e.url);
    try {
      const relays = await list.save({ emojis: clean });
      setStatus(t('common.publishedTo', { count: relays.length }));
    } catch (e) {
      setStatus(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1>{t('list.title')}</h1>

      <section>
        <h2>{t('list.packs')}</h2>
        {packs.length === 0 ? (
          <p className="muted">{t('list.empty')}</p>
        ) : (
          <div className="pack-grid">
            {packs.map((p) => (
              <div key={`${p.pubkey}:${p.identifier}`} className="pack-card-wrap">
                <Link
                  to={`/pack/${p.pubkey}/${encodeURIComponent(p.identifier)}`}
                  className="pack-card"
                >
                  <div className="pack-card-head">
                    <h3 className="pack-title">{p.title}</h3>
                    <span className="pack-count">
                      {t('pack.count', { count: p.emojis.length })}
                    </span>
                  </div>
                  <div className="pack-preview">
                    {p.emojis.slice(0, 12).map((e, i) => (
                      <EmojiImg key={i} emoji={e} size={28} />
                    ))}
                  </div>
                </Link>
                <button className="btn-ghost danger" onClick={() => list.removePack(p)}>
                  {t('list.removePack')}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2>{t('list.standalone')}</h2>
        <EmojiEditor emojis={emojis} onChange={setEmojis} />
      </section>

      <div className="save-bar">
        <button className="btn" disabled={saving} onClick={onSave}>
          {t('list.save')}
        </button>
        {status && <span className="status">{status}</span>}
      </div>
    </div>
  );
}
