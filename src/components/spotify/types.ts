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
}
