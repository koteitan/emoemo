export default function Loading({ text }: { text?: string }) {
  return (
    <div className="loading">
      <span className="spinner" aria-hidden="true" />
      {text && <span className="muted">{text}</span>}
    </div>
  );
}
