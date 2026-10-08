import { Briefcase, Code, ChatCircleDots } from '@phosphor-icons/react';

const panels = [
  { title: 'Applications', Icon: Briefcase, className: 'quest-panel--applications' },
  { title: 'Practice', Icon: Code, className: 'quest-panel--practice' },
  { title: 'Interviews', Icon: ChatCircleDots, className: 'quest-panel--interviews' },
];

export default function QuestPreview() {
  return <div className="quest-preview" aria-hidden="true">
    {panels.map(({ title, Icon, className }) => <div className={`quest-panel ${className}`} key={title}>
      <div className="quest-panel__heading"><Icon size={17} weight="regular" /><span>{title}</span></div>
      <span className="quest-skeleton quest-skeleton--long" /><span className="quest-skeleton quest-skeleton--short" />
      <span className="quest-skeleton quest-skeleton--bar" />
    </div>)}
    <span className="visual-caption">Illustration</span>
  </div>;
}
