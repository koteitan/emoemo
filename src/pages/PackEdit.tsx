import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  buildPackTags,
  fetchPack,
  KIND_EMOJI_SET,
  type Emoji,
} from '../nostr/emoji';
import { publishEvent } from '../nostr/core';
import EmojiEditor from '../components/EmojiEditor';
import Loading from '../components/Loading';

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function PackEdit({ mode }: { mode: 'new' | 'edit' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const { pubkey, readRelays, writeRelays } = useAuth();

  // When forking another pack, /pack/new is opened with prefilled fork data.
  const fork =
    mode === 'new'
      ? (location.state as { fork?: { title: string; emojis: Emoji[] } } | null)?.fork
      : undefined;

  const [identifier, setIdentifier] = useState(mode === 'new' ? randomId() : '');
  const [title, setTitle] = useState(fork?.title ?? '');
  const [emojis, setEmojis] = useState<Emoji[]>(
    fork?.emojis?.length ? fork.emojis : [{ shortcode: '', url: '' }],
  );
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (mode !== 'edit' || !params.pubkey || !params.identifier) return;
    const id = decodeURIComponent(params.identifier);
    setLoading(true);
    fetchPack({ pubkey: params.pubkey, identifier: id }, readRelays).then((p) => {
      if (p) {
        setIdentifier(p.identifier);
        setTitle(p.title);
        setEmojis(p.emojis.length ? p.emojis : [{ shortcode: '', url: '' }]);
      }
      setLoading(false);
    });
  }, [mode, params.pubkey, params.identifier, readRelays]);

  if (!pubkey) return <p className="muted">{t('auth.loginRequired')}</p>;
  if (loading) return <Loading text={t('common.loading')} />;

  async function onSave() {
    const clean = emojis.filter((e) => e.shortcode && e.url);
    setSaving(true);
    setStatus(t('common.publishing'));
    try {
      const tags = buildPackTags({ identifier, title, emojis: clean });
      const relays = await publishEvent({ kind: KIND_EMOJI_SET, content: '', tags }, writeRelays);
      setStatus(t('common.publishedTo', { count: relays.length }));
      navigate(`/pack/${pubkey}/${encodeURIComponent(identifier)}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1>{mode === 'new' ? t('pack.newTitle') : t('pack.editTitle')}</h1>

      <label className="field">
        <span>{t('pack.title')}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label className="field">
        <span>{t('pack.identifier')}</span>
        <input
          value={identifier}
          disabled={mode === 'edit'}
          onChange={(e) => setIdentifier(e.target.value.replace(/\s/g, '-'))}
        />
        <small className="hint">{t('pack.identifierHint')}</small>
      </label>

      <h2>{t('pack.emojis')}</h2>
      <EmojiEditor emojis={emojis} onChange={setEmojis} />

      <div className="save-bar">
        <button className="btn" disabled={saving || !identifier} onClick={onSave}>
          {t('pack.save')}
        </button>
        {status && <span className="status">{status}</span>}
      </div>
    </div>
  );
}
