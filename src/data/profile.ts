// Homepage identity and introduction. Edit the text, location or links here; the cards read only this file.
const profile = {
  name: 'Sherwin Wang',
  intro: 'Computer science graduate student building software, ML systems, and products people actually use.',
  // Shown as written, city level only. Nothing on the site looks up or tracks a location.
  location: 'Costa Mesa, CA',
  contact: {
    links: [
      { id: 'email', label: 'Email Sherwin', href: 'mailto:sherwinnw22@gmail.com' },
      { id: 'github', label: 'GitHub', href: 'https://github.com/Sherwin-W', newTab: true },
      { id: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/in/sherwinnw/', newTab: true },
    ],
  },
  about: {
    title: 'Who am I?',
    // The owner's own words. Keep them as written.
    paragraphs: [
      'Hey, I’m Sherwin. I’m wrapping up my Master’s in CS at UC Irvine, and I like building things people actually want to use.',
      'If I’ve learned one thing, it’s that going deep beats going wide. My capstone only clicked once we stopped trying to do everything and picked one hard problem to obsess over. Turns out that works everywhere. It’s how I finally started seeing results at the gym, and how I started climbing in League as a jungler.',
    ],
    sideQuest: { label: 'Current side quest:', goal: 'Diamond' },
  },
};

export default profile;
