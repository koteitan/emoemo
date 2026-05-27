import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { uploadToNostrBuild } from '../upload/nostrBuild';

export default function UploadButton({ onUploaded }: { onUploaded: (url: string) => void }) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const url = await uploadToNostrBuild(file);
      onUploaded(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('upload.failed'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <span className="upload">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onChange}
      />
      <button
        type="button"
        className="btn-ghost"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? t('upload.uploading') : t('upload.button')}
      </button>
      {error && <span className="error-text">{error}</span>}
    </span>
  );
}
