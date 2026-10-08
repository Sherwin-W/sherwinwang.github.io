import projects from '../data/projects';
import profile from '../data/profile';
import BentoGrid from '../components/bento/BentoGrid';
import ThemeToggle from '../components/ThemeToggle';
import '../styles/tokens.css';
import './Home.css';

const profileTiles = [
  { id: 'identity', area: 'identity', title: profile.name, summary: profile.intro, headingLevel: 'h1', links: profile.contact.links, interests: profile.interests },
];

export default function Home() {
  const items = [profileTiles[0], ...projects];
  return <main className="home-page"><div className="home-page__toolbar"><ThemeToggle /></div><BentoGrid items={items} /></main>;
}
