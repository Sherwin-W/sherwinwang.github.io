import { useRef, useState } from 'react';
import PlayCanvas from '../playable/PlayCanvas';
import './Home.css';

// These short descriptions are retained from the existing repository.
const projects = [
  { title: 'Privacy Preserving Visualization Tool', description: 'A tool to visualize data while preserving privacy using differential privacy techniques.', technology: 'Differential privacy' },
  { title: 'HTML Transformer', description: 'A utility to transform and manipulate HTML documents efficiently.', technology: 'HTML' },
  { title: 'Flutter Event Planning App', description: 'A mobile application built with Flutter to help users plan and organize events.', technology: 'Flutter' },
];

export default function Home() {
  const dialog = useRef(null);
  const opener = useRef(null);
  const [sheet, setSheet] = useState('Projects');
  const [project, setProject] = useState(null);
  const openSheet = (name, event) => {
    opener.current = event.currentTarget;
    setSheet(name);
    setProject(null);
    dialog.current.showModal();
  };
  const closeSheet = () => {
    dialog.current.close();
    opener.current?.focus();
  };
  return (
    <main className="sketchbook">
      <PlayCanvas />
      <header className="sketchbook-title">
        <span className="folio-number">01 / a little room for ideas</span>
        <h1>Hello, I&apos;m Sherwin</h1>
        <p>Computer science student with interests in<br className="desktop-break" /> cybersecurity and artificial intelligence.</p>
        <p className="sketchbook-hint">Click anywhere to name something.</p>
      </header>
      <nav className="portfolio-dock" aria-label="Portfolio">
        {['Projects', 'About', 'Contact'].map(name => <button key={name} onClick={event => openSheet(name, event)}>{name}</button>)}
        <button onClick={event => openSheet('Resume', event)}>Resume</button>
      </nav>
      <dialog ref={dialog} className="portfolio-sheet" onCancel={closeSheet}>
        <button className="sheet-close" onClick={closeSheet} autoFocus>Close <span aria-hidden="true">×</span></button>
        <span className="sheet-eyebrow">Sherwin Wang / {sheet}</span>
        <h2>{project ? project.title : sheet}</h2>
        {sheet === 'Projects' && !project && <div className="project-index">{projects.map((item, i) => <button key={item.title} onClick={() => setProject(item)}><span className="project-number">0{i + 1}</span><span><strong>{item.title}</strong><small>{item.description}</small></span><span aria-hidden="true">↗</span></button>)}</div>}
        {project && <><p>{project.description}</p><div className="tech-chips"><span>{project.technology}</span></div><button onClick={() => setProject(null)}>All projects</button></>}
        {sheet === 'About' && <><p>I&apos;m Sherwin, a computer science student with interests in cybersecurity and artificial intelligence.</p><h3>Things I work with</h3><p>Cybersecurity · Artificial Intelligence · Web Development · Mobile App Development</p></>}
        {sheet === 'Contact' && <><p>You can find my public work on GitHub.</p><a href="https://github.com/sherwin-w" target="_blank" rel="noopener noreferrer">GitHub / sherwin-w ↗</a></>}
        {sheet === 'Resume' && <p>A resume is not currently linked on this site. You can explore my projects and background using the tabs below.</p>}
        <footer className="sheet-footer">{['Projects', 'About', 'Contact'].filter(name => name !== sheet).map(name => <button key={name} onClick={() => { setSheet(name); setProject(null); }}>{name}</button>)}</footer>
      </dialog>
    </main>
  );
}
