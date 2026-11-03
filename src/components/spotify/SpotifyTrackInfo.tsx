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
        <h3 className="spotify__title">
          <a href={track.spotifyUrl} target="_blank" rel="noopener noreferrer">
            {track.title}<span className="visually-hidden"> (opens in Spotify, new tab)</span>
          </a>
        </h3>
        <p className="spotify__artist">{track.artists.join(', ')}</p>
      </div>
    </div>
  );
}
