import { useLastPlayed } from './useLastPlayed';
import SpotifyPlayer from './SpotifyPlayer';
import SpotifySkeleton from './SpotifySkeleton';
import SpotifyStatus from './SpotifyStatus';
import SpotifyTrackInfo from './SpotifyTrackInfo';
import './spotify.css';

export default function SpotifyLastPlayed({ apiBaseUrl }: { apiBaseUrl: string }) {
  const { data, state, error, waitUntil, retry } = useLastPlayed(apiBaseUrl);
  const waiting = waitUntil > Date.now();
  const heading = <h2 className="spotify__heading">Music</h2>;

  return (
    <section className="bento-tile spotify" data-spotify-tile aria-label="Spotify last played" aria-busy={state === 'loading'}>
      {heading}
      {state === 'loading' && <SpotifySkeleton />}
      {state === 'error' && !data && (
        <div className="spotify__fallback" role="status">
          <p>{error === 404 ? 'Nothing played recently.' : error === 429 ? 'Spotify asked for a short break. Back soon.' : 'Spotify is unavailable right now.'}</p>
          {!waiting && <button type="button" className="bento-link" onClick={() => void retry()}>Try again</button>}
        </div>
      )}
      {data && (
        <div className="spotify__body" key={data.track.id}>
          <SpotifyStatus playing={data.isCurrentlyPlaying} playedAt={data.playedAt} stale={Boolean(data.stale)} />
          <SpotifyTrackInfo track={data.track} />
          <SpotifyPlayer track={data.track} />
        </div>
      )}
    </section>
  );
}
