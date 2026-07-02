import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { uploadToNostrBuild } from '../upload/nostrBuild';
import { removeEdgeBackground } from '../util/transparency';

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

  // Re-render the preview whenever the threshold changes (or once loaded).
  useEffect(() => {
    const orig = originalRef.current;
    const canvas = canvasRef.current;
    if (loading || error || !orig || !canvas) return;
    const processed = removeEdgeBackground(orig, threshold);
    canvas.width = processed.width;
    canvas.height = processed.height;
    canvas.getContext('2d')?.putImageData(processed, 0, 0);
  }, [threshold, loading, error]);

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
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t('transparency.title')}</h3>

        {error ? (
          <p className="error-text">{error}</p>
        ) : loading ? (
          <p className="muted">{t('common.loading')}</p>
        ) : (
          <>
            <div className="transp-preview checker">
              <canvas ref={canvasRef} />
            </div>
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
