import { lazy, Suspense } from 'react';
import Loading from './Loading';
import ThemeToggle from '../components/ThemeToggle';

const PlayCanvas = lazy(() => import('../playable/PlayCanvas'));

export default function Sketchbook() {
  return (
    <main className="sketchbook-page">
      <div className="sketchbook-page__theme"><ThemeToggle /></div>
      <header className="sketchbook-page__header">
        <h1>Sketchbook</h1>
        <p className="sketchbook-page__hint"><span className="hint-initial">Choose Brush, draw a shape, and pause to make an object. Use Objects for the picker.</span><span className="hint-after-spawn">Drag objects to the bin to remove them.</span></p>
        <a className="sketchbook-page__back" href={import.meta.env.BASE_URL}>Back to portfolio</a>
      </header>
      <nav className="sketchbook-page__dock" aria-label="Canvas controls">
        <div id="play-dock-controls" />
      </nav>
      <Suspense fallback={<Loading />}>
        <div className="sketchbook-page__canvas"><PlayCanvas /></div>
      </Suspense>
    </main>
  );
}
