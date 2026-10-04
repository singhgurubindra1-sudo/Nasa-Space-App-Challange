export default function Stars({ n, size = '2.4rem' }) {
  return (
    <div className="stars" style={{ fontSize: size }} aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < n ? 'star-on' : 'star-off'}>★</span>
      ))}
    </div>
  );
}
