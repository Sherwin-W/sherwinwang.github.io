import { useEffect, useState } from 'react';

function currentTheme(): 'light' | 'dark' {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** Official Spotify track embed. The src is always built from the validated track id. */
export default function SpotifyEmbed({ trackId, title }: { trackId: string; title: string }) {
  const [theme, setTheme] = useState(currentTheme);
  useEffect(() => {
    const update = () => setTheme(currentTheme());
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener('change', update);
    return () => { mo.disconnect(); mq.removeEventListener('change', update); };
  }, []);
  const src = `https://open.spotify.com/embed/track/${trackId}?utm_source=sherwinwang.dev${theme === 'dark' ? '&theme=0' : ''}`;
  return (
    <iframe
      key={`${trackId}-${theme}`}
      className="spotify__embed"
      title={`Spotify player: ${title}`}
      src={src}
      width="100%"
      height="80"
      loading="lazy"
      allow="encrypted-media"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
