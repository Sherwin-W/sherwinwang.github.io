import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

// theme.js reads matchMedia as it loads, before any hook could stub it.
vi.hoisted(() => {
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
});

import Home from './Home';
import profile from '../data/profile';
import resume from '../data/resume';

beforeAll(() => {
  // jsdom has no modal dialogs; these stand in for the browser's.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const section = (name: string) => screen.getByRole('region', { name });
const headings = (el: HTMLElement) => within(el).getAllByRole('heading', { level: 2 }).map((h) => h.textContent?.trim());

describe('homepage', () => {
  it('puts Professional before After Hours, each with its own cards', () => {
    render(<Home />);
    const regions = screen.getAllByRole('region').map((r) => r.getAttribute('aria-labelledby'));
    expect(regions.slice(0, 2)).toEqual(['home-professional', 'home-after-hours']);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sherwin Wang');
    expect(headings(section('Professional'))).toEqual(['Who am I?', 'Road to Diamond on OP.GG, DippoBippo#cccc (opens in a new tab)', 'Résumé', 'QuestBoard  (opens in a new tab)']);
    expect(headings(section('After Hours'))).toEqual(['Sketchbook  (opens in a new tab)', 'MBTI-Inspired Test  (opens in a new tab)', 'Blackjack Trainer  (opens in a new tab)']);
  });

  it('no longer shows the three old project cards', () => {
    render(<Home />);
    for (const title of ['Privacy Preserving Visualization Tool', 'HTML Transformer', 'Flutter Event Planning App']) expect(screen.queryByText(title)).toBeNull();
    expect(screen.queryByRole('button', { name: /HTML Transformer|Flutter|Privacy/ })).toBeNull();
  });

  it('shows the new summary, the configured city, and three contact icons', () => {
    render(<Home />);
    expect(screen.getByText('Computer science graduate student building software, ML systems, and products people actually use.')).toBeTruthy();
    expect(screen.getByText('Costa Mesa, CA')).toBeTruthy();
    expect(profile.location).toBe('Costa Mesa, CA');
    const contact = screen.getByRole('list', { name: 'Contact' });
    const links = within(contact).getAllByRole('link');
    expect(links.map((a) => [a.getAttribute('aria-label'), a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel')])).toEqual([
      ['Email Sherwin', 'mailto:sherwinnw22@gmail.com', null, null],
      ['GitHub (opens in a new tab)', 'https://github.com/Sherwin-W', '_blank', 'noopener noreferrer'],
      ['LinkedIn (opens in a new tab)', 'https://www.linkedin.com/in/sherwinnw/', '_blank', 'noopener noreferrer'],
    ]);
    // Nothing on the page asks for the visitor's location.
    const geo = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition: geo, watchPosition: geo } });
    cleanup();
    render(<Home />);
    expect(geo).not.toHaveBeenCalled();
  });

  it('shows “Who am I?” exactly as written, ending on the side quest', () => {
    render(<Home />);
    const card = screen.getByRole('heading', { name: 'Who am I?' }).closest('article')!;
    const text = [...card.querySelectorAll('p')].map((p) => p.textContent);
    expect(text).toEqual([
      'Hey, I’m Sherwin. I’m wrapping up my Master’s in CS at UC Irvine, and I like building things people actually want to use.',
      'If I’ve learned one thing, it’s that going deep beats going wide. My capstone only clicked once we stopped trying to do everything and picked one hard problem to obsess over. Turns out that works everywhere. It’s how I finally started seeing results at the gym, and how I started climbing in League as a jungler.',
      'Current side quest: Diamond.',
    ]);
    expect(card.querySelector('.about__quest strong')?.textContent).toBe('Diamond.');
  });

  it('keeps QuestBoard as a compact link to the tracker', () => {
    render(<Home />);
    const link = screen.getByRole('link', { name: /QuestBoard/ });
    expect(link.getAttribute('href')).toBe('https://tracker.sherwinwang.dev');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.closest('.bento-slot')?.className).toContain('bento-slot--quest');
  });

  it('previews the résumé and opens the full PDF in a viewer with open and download options', () => {
    render(<Home />);
    const card = screen.getByRole('heading', { name: 'Résumé' }).closest('article')!;
    for (const text of ['University of California, Irvine', 'Master of Computer Science', 'Expected December 2026', 'Arizona State University', 'B.S. Computer Science', 'May 2025', 'Software Developer Intern', 'Analytichem Canada', 'May 2024 – September 2026', 'Python, Java, C++, C#, SQL, JavaScript', 'React, PyTorch, MLX, Flask, Docker, Git, Linux']) {
      expect(within(card).getByText(text)).toBeTruthy();
    }
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: 'Learn more: open the full résumé' }));
    const dialog = screen.getByRole('dialog', { name: 'Résumé' });
    expect(within(dialog).getByRole('link', { name: /Open PDF/ }).getAttribute('href')).toBe('/resume/Sherwin_Wang.pdf');
    const download = within(dialog).getByRole('link', { name: 'Download' });
    expect(download.getAttribute('href')).toBe('/resume/Sherwin_Wang.pdf');
    expect(download.getAttribute('download')).toBe('Sherwin_Wang_Resume.pdf');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('falls back to open and download links where the browser cannot show a PDF inline', () => {
    vi.stubGlobal('navigator', { ...navigator, pdfViewerEnabled: false });
    render(<Home />);
    fireEvent.click(screen.getByRole('button', { name: /Learn more/ }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('iframe')).toBeNull();
    expect(within(dialog).getByText(/can’t show the PDF on the page/)).toBeTruthy();
    cleanup();
    vi.stubGlobal('navigator', { ...navigator, pdfViewerEnabled: true });
    render(<Home />);
    fireEvent.click(screen.getByRole('button', { name: /Learn more/ }));
    expect(screen.getByTitle('Sherwin Wang résumé (PDF)').getAttribute('src')).toBe('/resume/Sherwin_Wang.pdf#view=FitH');
  });
});

describe('résumé updates stay owner-only', () => {
  it('serves the PDF from one stable path in the repository, with no upload code anywhere', () => {
    expect(resume.pdf).toBe('/resume/Sherwin_Wang.pdf');
    expect(readFileSync('public/resume/Sherwin_Wang.pdf').subarray(0, 5).toString('latin1')).toBe('%PDF-');
    const guide = readFileSync('docs/RESUME.md', 'utf8');
    expect(guide).toMatch(/public\/resume\/Sherwin_Wang\.pdf/);
    expect(guide).toMatch(/src\/data\/resume\.ts/);
    // No form, file input or upload endpoint for visitors.
    for (const f of ['src/components/home/ResumeCard.tsx', 'src/components/home/ResumeViewer.tsx', 'src/pages/Home.jsx']) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/type="file"|<form|method:\s*'(POST|PUT)'|upload/i);
    }
  });
});
