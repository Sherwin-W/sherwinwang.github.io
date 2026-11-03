export default function SpotifySkeleton() {
  return (
    <div className="spotify__skeleton" role="status" aria-label="Loading last played track">
      <span className="spotify__art spotify__shimmer" />
      <span className="spotify__lines"><i className="spotify__shimmer" /><i className="spotify__shimmer" /></span>
    </div>
  );
}
