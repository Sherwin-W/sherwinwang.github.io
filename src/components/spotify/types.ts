export interface Track {
  id: string;
  title: string;
  artists: string[];
  album: string;
  albumArt: string | null;
  spotifyUrl: string;
  embedUrl: string;
}

export interface LastPlayedData {
  track: Track;
  isCurrentlyPlaying: boolean;
  playedAt: string | null;
  updatedAt: string;
  stale?: boolean;
  /** Seconds the server asked us to wait before polling again (rate limit). */
  retryAfter?: number | null;
}
