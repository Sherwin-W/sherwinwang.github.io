import type { Track } from './types';

export default function SpotifyTrackInfo({ track }: { track: Track }) {
  return (
    <div className="spotify__track">
      {track.albumArt ? (
        <img className="spotify__art" src={track.albumArt} alt={`Album art for ${track.album || track.title}`} width="96" height="96" />
      ) : (
        <span className="spotify__art spotify__art--empty" aria-hidden="true" />
      )}
      <div className="spotify__meta">
        <h3 className="spotify__title" title={track.title}>{track.title}</h3>
        <p className="spotify__artist" title={track.artists.join(', ')}>{track.artists.join(', ')}</p>
      </div>
    </div>
  );
}
