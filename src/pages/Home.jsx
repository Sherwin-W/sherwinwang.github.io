import projects from '../data/projects';
import profile from '../data/profile';
import BentoGrid from '../components/bento/BentoGrid';
import SpotifyLastPlayed from '../components/spotify/SpotifyLastPlayed';
import ThemeToggle from '../components/ThemeToggle';
import '../styles/tokens.css';
import './Home.css';

const profileTiles = [
  { id: 'identity', area: 'identity', title: profile.name, summary: profile.intro, headingLevel: 'h1', links: profile.contact.links, interests: profile.interests },
];

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
// The music tile needs the API; without one configured it is left out rather than faked.
const spotifyTile = apiBaseUrl ? [{ id: 'spotify', area: 'spotify', render: () => <SpotifyLastPlayed apiBaseUrl={apiBaseUrl} /> }] : [];

export default function Home() {
  // Keep DOM order equal to visual order: the music tile sits left of the MBTI Test on the last row.
  const mbtiAt = projects.findIndex((project) => project.id === 'mbti');
  const items = [profileTiles[0], ...projects.slice(0, mbtiAt), ...spotifyTile, ...projects.slice(mbtiAt)];
  return <main className="home-page"><div className="home-page__toolbar"><ThemeToggle /></div><BentoGrid items={items} /></main>;
}
