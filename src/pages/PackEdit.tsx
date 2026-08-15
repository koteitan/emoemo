import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
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

  // When forking another set, /set/new is opened with prefilled fork data.
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

  // --- "save me" sparkle nudge -------------------------------------------
  const [nudgeKey, setNudgeKey] = useState(0);
  const [nudging, setNudging] = useState(false);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nudgeSave = useCallback(() => {
    setNudgeKey((k) => k + 1); // remount the sparkles so the animation replays
    setNudging(true);
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    nudgeTimer.current = setTimeout(() => setNudging(false), 2600);
  }, []);

  useEffect(
    () => () => {
      if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    },
    [],
  );

  // Trigger 2: fire whenever the count of "complete" rows (shortcode + url both
  // filled) changes -- i.e. the "both fields filled" proposition flips somewhere.
  const completeCount = emojis.reduce((n, e) => n + (e.shortcode && e.url ? 1 : 0), 0);
  const prevCompleteRef = useRef<number | null>(null);
  useEffect(() => {
    if (loading) return;
    if (prevCompleteRef.current === null) {
      prevCompleteRef.current = completeCount; // establish baseline after load
      return;
    }
    if (completeCount !== prevCompleteRef.current) {
      prevCompleteRef.current = completeCount;
      nudgeSave();
    }
  }, [completeCount, loading, nudgeSave]);

  // --- unsaved-changes guard ---------------------------------------------
  const currentSig = JSON.stringify({ title, identifier, emojis });
  const baselineRef = useRef<string | null>(null);
  useEffect(() => {
    if (loading) return;
    if (baselineRef.current === null) baselineRef.current = currentSig; // baseline after load
  }, [loading, currentSig]);
  const dirty = baselineRef.current !== null && currentSig !== baselineRef.current;

  // Warn on tab close / reload while there are unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // Chrome requires returnValue to be set
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Warn on in-app navigation: one delegated capture-phase listener catches any
  // <a>/<Link> click. Cancelling preventDefault()s the event, so react-router's
  // Link (which skips navigation when defaultPrevented) and the native hash
  // change are both blocked. Links opening a new tab don't leave, so skip them.
  useEffect(() => {
    if (!dirty) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest('a');
      if (!a) return;
      const target = a.getAttribute('target');
      if ((target && target !== '_self') || a.hasAttribute('download')) return;
      if (!window.confirm(t('pack.unsavedLeave'))) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [dirty, t]);

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
      navigate(`/set/${pubkey}/${encodeURIComponent(identifier)}`);
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
      <EmojiEditor emojis={emojis} onChange={setEmojis} onSaveNudge={nudgeSave} />

      <div className="save-bar">
        <span className="save-btn-wrap">
          <button
            className={`btn${nudging ? ' save-glow' : ''}`}
            disabled={saving || !identifier}
            onClick={onSave}
          >
            {t('pack.save')}
          </button>
          {nudging && <SaveSparkle key={nudgeKey} />}
        </span>
        {dirty && <span className="unsaved-hint">{t('pack.unsaved')}</span>}
        {status && <span className="status">{status}</span>}
      </div>
    </div>
  );
}

const SPARKS = [0, 1, 2, 3, 4, 5];

// Sparkles that fly into the save button and then orbit it to nag the user.
function SaveSparkle() {
  return (
    <span className="sparkle-layer" aria-hidden="true">
      {SPARKS.map((i) => (
        <span
          key={i}
          className="sparkle"
          style={{ '--a': `${(360 / SPARKS.length) * i}deg` } as CSSProperties}
        >
          ✨
        </span>
      ))}
    </span>
  );
}
