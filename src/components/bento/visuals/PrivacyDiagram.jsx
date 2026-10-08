const dots = [[10, 60], [17, 39], [22, 71], [27, 51], [33, 30], [38, 63], [44, 44], [49, 76], [54, 54], [60, 33], [65, 66], [71, 47], [77, 25], [82, 58], [89, 39], [94, 72]];

export default function PrivacyDiagram() {
  return <div className="privacy-visual" aria-hidden="true">
    <svg viewBox="0 0 600 220" preserveAspectRatio="none">
      <defs><linearGradient id="privacy-band" x1="0" x2="1"><stop stopColor="var(--accent)" stopOpacity="0" /><stop offset=".5" stopColor="var(--accent)" stopOpacity=".18" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
      <path className="privacy-band" d="M0 125C90 88 117 150 201 115S326 82 394 116s129 23 206-5v67H0z" fill="url(#privacy-band)" />
      <path className="privacy-curve" d="M0 130C80 116 129 104 198 113s109 5 167-3 134 1 235-19" fill="none" stroke="var(--accent)" strokeWidth="2.5" />
      {dots.map(([x, y], index) => <circle key={index} cx={x * 6} cy={y * 2.2} r={index % 3 === 0 ? 3 : 2} />)}
    </svg><span className="visual-caption">Illustration</span>
  </div>;
}
