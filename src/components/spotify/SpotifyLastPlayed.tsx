import { useLastPlayed } from './useLastPlayed';
import SpotifyEmbed from './SpotifyEmbed';
import SpotifySkeleton from './SpotifySkeleton';
import SpotifyStatus from './SpotifyStatus';
import SpotifyTrackInfo from './SpotifyTrackInfo';
import './spotify.css';

export default function SpotifyLastPlayed({ apiBaseUrl }: { apiBaseUrl: string }) {
  const { data, state, error, fromBrowserCache, retry } = useLastPlayed(apiBaseUrl);
  const heading = <h2 className="spotify__heading">Music</h2>;

  return (
    <section className="bento-tile spotify" data-spotify-tile aria-label="Spotify last played" aria-busy={state === 'loading'}>
      {heading}
      {state === 'loading' && <SpotifySkeleton />}
      {state === 'error' && !data && (
        <div className="spotify__fallback" role="status">
          <p>{error === 404 ? 'Nothing played recently.' : 'Spotify is unavailable right now.'}</p>
          <button type="button" className="bento-link" onClick={() => void retry()}>Try again</button>
        </div>
      )}
      {data && (
        <div className="spotify__body" key={data.track.id}>
          <SpotifyStatus playing={data.isCurrentlyPlaying} playedAt={data.playedAt} stale={Boolean(data.stale) || (fromBrowserCache && state === 'error')} />
          <SpotifyTrackInfo track={data.track} />
          <SpotifyEmbed trackId={data.track.id} title={data.track.title} />
        </div>
      )}
    </section>
  );
}
