const objects = [
  { id: 'cat', className: 'sketch-object--cat', width: 112, height: 112 },
  { id: 'sun', className: 'sketch-object--sun', width: 74, height: 74 },
  { id: 'fish', className: 'sketch-object--fish', width: 96, height: 96 },
  { id: 'flower', className: 'sketch-object--flower', width: 83, height: 83 },
  { id: 'bird', className: 'sketch-object--bird', width: 88, height: 88 },
  { id: 'butterfly', className: 'sketch-object--butterfly', width: 68, height: 68 },
  { id: 'moon', className: 'sketch-object--moon', width: 64, height: 64 },
];

export default function SketchbookStage() {
  return <div className="sketchbook-stage" aria-hidden="true">
    <svg className="sketch-stroke" viewBox="0 0 600 300" fill="none"><path d="M54 189C123 55 223 269 303 153S450 84 548 183" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="8 11" /></svg>
    {objects.map(({ id, className, width, height }) => <img key={id} className={`sketch-object ${className}`} src={`/objects/${id}.svg`} alt="" loading="lazy" width={width} height={height} />)}
  </div>;
}
