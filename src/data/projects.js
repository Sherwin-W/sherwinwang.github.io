// Project fields: id, title, summary, tags, size, area, accent, links, details.
// Optional behavior fields: href (string) + newTab (boolean) make a link tile;
// expand (boolean) marks a tile for in-place expansion. A tile must never use
// both href and expand. Tiles with neither behavior field are static.
// Optional media: visual selects a registered illustration; image supplies a sanitized screenshot.
// section places a tile on the homepage ('professional' or 'after-hours'); without one it is not shown there.
const projects = [
  {
    id: 'quest-board',
    title: 'QuestBoard',
    summary: 'A personal dashboard for tracking job applications, practicing LeetCode, and preparing for interviews.',
    tags: [],
    size: 'standard',
    area: 'quest',
    section: 'professional',
    href: 'https://tracker.sherwinwang.dev',
    newTab: true,
    visual: 'quest',
  },
  {
    id: 'sketchbook',
    title: 'Sketchbook',
    summary: 'An interactive drawing canvas that turns sketches into small objects.',
    tags: [],
    size: 'wide',
    area: 'sketchbook',
    section: 'after-hours',
    href: import.meta.env.BASE_URL + 'sketchbook/',
    newTab: true,
    visual: 'sketchbook',
  },
  // Earlier projects, no longer on the homepage. Kept here (with their illustration) for reference.
  {
    id: 'privacy-visualization',
    title: 'Privacy Preserving Visualization Tool',
    summary: 'A tool to visualize data while preserving privacy using differential privacy techniques.',
    tags: ['Differential privacy'],
    size: 'standard',
    area: 'privacy',
    visual: 'privacy',
    expand: true,
  },
  {
    id: 'html-transformer',
    title: 'HTML Transformer',
    summary: 'A utility to transform and manipulate HTML documents efficiently.',
    tags: ['HTML'],
    size: 'wide',
    area: 'html',
    expand: true,
  },
  {
    id: 'flutter-events',
    title: 'Flutter Event Planning App',
    summary: 'A mobile application built with Flutter to help users plan and organize events.',
    tags: ['Flutter'],
    size: 'wide',
    area: 'flutter',
    expand: true,
  },
  {
    id: 'mbti',
    title: 'MBTI-Inspired Test',
    summary: 'Answer questions out loud, then video-call seven pixel characters.',
    tags: ['Voice', 'Pixel scenes', 'Runs in browser'],
    size: 'standard',
    area: 'mbti',
    section: 'after-hours',
    href: import.meta.env.BASE_URL + 'mbti/',
    newTab: true,
    visual: 'mbti',
  },
  {
    id: 'blackjack',
    title: 'Blackjack Trainer',
    summary: 'Practice basic strategy and Hi-Lo counting against a real finite shoe. Virtual units only.',
    tags: ['Practice Blackjack'],
    size: 'standard',
    area: 'blackjack',
    section: 'after-hours',
    href: import.meta.env.BASE_URL + 'blackjack/',
    newTab: true,
    visual: 'blackjack',
  },
];

export default projects;
