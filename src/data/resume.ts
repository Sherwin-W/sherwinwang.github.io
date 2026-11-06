// Résumé preview card and viewer. To publish a new résumé, replace the PDF at `pdf` (keep the file name)
// and update the entries below to match it, then deploy. See docs/RESUME.md.

export interface ResumeEntry { title: string; org: string; when: string }

const resume = {
  /** Stable public path, served from public/resume/. */
  pdf: `${import.meta.env.BASE_URL}resume/Sherwin_Wang.pdf`,
  /** Name the browser saves the download as. */
  downloadName: 'Sherwin_Wang_Resume.pdf',
  education: [
    { title: 'University of California, Irvine', org: 'Master of Computer Science', when: 'Expected December 2026' },
    { title: 'Arizona State University', org: 'B.S. Computer Science', when: 'May 2025' },
  ] satisfies ResumeEntry[],
  experience: [
    { title: 'Software Developer Intern', org: 'Analytichem Canada', when: 'May 2024 – September 2026' },
  ] satisfies ResumeEntry[],
  skills: {
    Languages: ['Python', 'Java', 'C++', 'C#', 'SQL', 'JavaScript'],
    Technologies: ['React', 'PyTorch', 'MLX', 'Flask', 'Docker', 'Git', 'Linux'],
  } as Record<string, string[]>,
};

export default resume;
