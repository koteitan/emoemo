import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { uploadToNostrBuild } from '../upload/nostrBuild';
import { buildTransparent } from '../util/transparency';

const DEFAULT_THRESHOLD = 40;
const MAX_THRESHOLD = 150;

// "周辺透明化": clear the edge-connected background of an emoji image, preview
// the result with an adjustable threshold, then re-upload and swap the URL.
export default function TransparencyButton({
  url,
  onProcessed,
}: {
  url: string;
  onProcessed: (url: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn-ghost" disabled={!url} onClick={() => setOpen(true)}>
        {t('transparency.button')}
      </button>
      {open && (
        <TransparencyModal
          url={url}
          onClose={() => setOpen(false)}
          onProcessed={(u) => {
            onProcessed(u);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function TransparencyModal({
  url,
  onClose,
  onProcessed,
}: {
  url: string;
  onClose: () => void;
  onProcessed: (url: string) => void;
}) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalRef = useRef<ImageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [sameColor, setSameColor] = useState(false);
  const [clicks, setClicks] = useState<{ x: number; y: number }[]>([]);
  const [uploading, setUploading] = useState(false);

  // Load the source image once into an offscreen ImageData.
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!alive) return;
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      if (!ctx) {
        setError(t('transparency.loadFailed'));
        setLoading(false);
        return;
      }
      ctx.drawImage(img, 0, 0);
      try {
        // Throws if the image is cross-origin without CORS (tainted canvas).
        originalRef.current = ctx.getImageData(0, 0, c.width, c.height);
        setLoading(false);
      } catch {
        setError(t('transparency.tainted'));
        setLoading(false);
      }
    };
    img.onerror = () => {
      if (alive) {
        setError(t('transparency.tainted'));
        setLoading(false);
      }
    };
    img.src = url;
    return () => {
      alive = false;
    };
  }, [url, t]);

  // Re-render the preview whenever any option changes (or once loaded).
  useEffect(() => {
    const orig = originalRef.current;
    const canvas = canvasRef.current;
    if (loading || error || !orig || !canvas) return;
    const processed = buildTransparent(orig, { threshold, globalSameColor: sameColor, clicks });
    canvas.width = processed.width;
    canvas.height = processed.height;
    canvas.getContext('2d')?.putImageData(processed, 0, 0);
  }, [threshold, sameColor, clicks, loading, error]);

  // Map a click on the (CSS-scaled) canvas to an original-image pixel and add it
  // as a flood-fill seed, so the pointed island gets cleared too.
  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const orig = originalRef.current;
    if (!canvas || !orig || uploading) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (orig.width / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (orig.height / rect.height));
    if (x < 0 || y < 0 || x >= orig.width || y >= orig.height) return;
    setClicks((prev) => [...prev, { x, y }]);
  }

  async function confirm() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setUploading(true);
    setError('');
    try {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
      );
      const file = new File([blob], 'emoji.png', { type: 'image/png' });
      const newUrl = await uploadToNostrBuild(file);
      onProcessed(newUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('upload.failed'));
      setUploading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal transp-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t('transparency.title')}</h3>

        {error ? (
          <p className="error-text">{error}</p>
        ) : loading ? (
          <p className="muted">{t('common.loading')}</p>
        ) : (
          <>
            <div className="transp-preview checker">
              <canvas ref={canvasRef} onClick={onCanvasClick} />
            </div>
            <p className="transp-hint">
              {t('transparency.clickHint')}
              {clicks.length > 0 && (
                <>
                  {' · '}
                  <button
                    type="button"
                    className="transp-reset"
                    disabled={uploading}
                    onClick={() => setClicks([])}
                  >
                    {t('transparency.resetClicks', { count: clicks.length })}
                  </button>
                </>
              )}
            </p>
            <label className="transp-option">
              <input
                type="checkbox"
                checked={sameColor}
                disabled={uploading}
                onChange={(e) => setSameColor(e.target.checked)}
              />
              <span>{t('transparency.sameColor')}</span>
            </label>
            <label className="transp-threshold">
              <span>
                {t('transparency.threshold')}: {threshold}
              </span>
              <input
                type="range"
                min={0}
                max={MAX_THRESHOLD}
                value={threshold}
                disabled={uploading}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
            </label>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={uploading}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn"
            onClick={confirm}
            disabled={loading || !!error || uploading}
          >
            {uploading ? t('upload.uploading') : t('transparency.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
