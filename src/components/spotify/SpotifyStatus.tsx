import { relativeTime } from './api';

interface Props { playing: boolean; playedAt: string | null; stale: boolean }

export default function SpotifyStatus({ playing, playedAt, stale }: Props) {
  return (
    <p className="spotify__status" role="status">
      {playing ? (
        <>
          <span className="spotify__bars" aria-hidden="true"><i /><i /><i /><i /></span>
          <span className="spotify__eyebrow">Now listening</span>
        </>
      ) : (
        <>
          <span className="spotify__eyebrow">Last played on Spotify</span>
          {playedAt && <span className="spotify__when">{relativeTime(playedAt)}</span>}
        </>
      )}
      {stale && <span className="spotify__when">Showing saved track</span>}
    </p>
  );
}
