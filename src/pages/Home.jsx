import { useState } from 'react';
import projects from '../data/projects';
import BentoGrid from '../components/bento/BentoGrid';
import IdentityCard from '../components/home/IdentityCard';
import AboutCard from '../components/home/AboutCard';
import ResumeCard from '../components/home/ResumeCard';
import ResumeViewer from '../components/home/ResumeViewer';
import RoadToDiamond from '../components/league/RoadToDiamond';
import SpotifyLastPlayed from '../components/spotify/SpotifyLastPlayed';
import ThemeToggle from '../components/ThemeToggle';
import '../styles/tokens.css';
import './Home.css';
import '../components/home/home.css';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const inSection = (name) => projects.filter((project) => project.section === name);

export default function Home() {
  const [resumeOpen, setResumeOpen] = useState(false);

  // DOM order follows the visual order: identity, about, the rank rail, then résumé and projects.
  const professional = [
    { id: 'identity', area: 'identity', render: () => <IdentityCard /> },
    { id: 'about', area: 'about', render: () => <AboutCard /> },
    { id: 'league', area: 'league', render: () => <RoadToDiamond apiBaseUrl={apiBaseUrl} /> },
    { id: 'resume', area: 'resume', render: () => <ResumeCard onOpen={() => setResumeOpen(true)} /> },
    ...inSection('professional'),
  ];
  // The music tile needs the API; without one configured it is left out rather than faked.
  const afterHours = [
    ...(apiBaseUrl ? [{ id: 'spotify', area: 'spotify', render: () => <SpotifyLastPlayed apiBaseUrl={apiBaseUrl} /> }] : []),
    ...inSection('after-hours'),
  ];

  return (
    <main className="home-page">
      <div className="home-page__toolbar"><ThemeToggle /></div>
      <section className="home-section" aria-labelledby="home-professional">
        <p className="home-section__label" id="home-professional">Professional</p>
        <BentoGrid items={professional} className="bento-grid--professional" />
      </section>
      <section className="home-section" aria-labelledby="home-after-hours">
        <p className="home-section__label" id="home-after-hours">After Hours</p>
        <BentoGrid items={afterHours} className="bento-grid--after-hours" delayOffset={professional.length} />
      </section>
      <footer className="home-page__footer">
        <p>Road to Diamond uses data from Riot Games. sherwinwang.dev isn’t endorsed by Riot Games and doesn’t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p>
      </footer>
      <ResumeViewer open={resumeOpen} onClose={() => setResumeOpen(false)} />
    </main>
  );
}
