// Project fields: id, title, summary, tags, size, area, accent, links, details.
// Optional behavior fields: href (string) + newTab (boolean) make a link tile;
// expand (boolean) marks a tile for in-place expansion. A tile must never use
// both href and expand. Tiles with neither behavior field are static.
// Optional media: visual selects a registered illustration; image supplies a sanitized screenshot.
const projects = [
  {
    id: 'quest-board',
    title: 'Quest Board',
    summary: 'A personal dashboard for tracking job applications, practicing LeetCode, and preparing for interviews.',
    tags: [],
    size: 'feature',
    accent: true,
    area: 'quest',
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
    href: import.meta.env.BASE_URL + 'sketchbook/',
    newTab: true,
    visual: 'sketchbook',
  },
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
];

export default projects;
