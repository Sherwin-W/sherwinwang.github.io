import { CaretRight, FilePdf } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { useTileMotion } from '../bento/useTileMotion';
import resume, { type ResumeEntry } from '../../data/resume';

function Entries({ items }: { items: ResumeEntry[] }) {
  return (
    <ul className="resume__entries">
      {items.map((e) => (
        <li key={e.title + e.when}>
          <span className="resume__row"><strong>{e.title}</strong><span className="resume__when">{e.when}</span></span>
          <span className="resume__org">{e.org}</span>
        </li>
      ))}
    </ul>
  );
}

/** A short, purpose-built preview of the résumé. The card (or its button) opens the full PDF. */
export default function ResumeCard({ onOpen }: { onOpen: () => void }) {
  return (
    <motion.article {...useTileMotion()} className="bento-tile bento-tile--interactive resume">
      <div className="resume__sheet">
        <div className="resume__head">
          <h2>Résumé</h2>
          <span className="resume__kind"><FilePdf aria-hidden="true" weight="regular" /> PDF</span>
        </div>
        <div className="resume__body">
          <div className="resume__section">
            <h3>Education</h3>
            <Entries items={resume.education} />
          </div>
          <div className="resume__section">
            <h3>Experience</h3>
            <Entries items={resume.experience} />
          </div>
          <div className="resume__section resume__section--skills">
            <h3>Technical skills</h3>
            <dl className="resume__skills">
              {Object.entries(resume.skills).map(([group, list]) => (
                <div key={group}><dt>{group}</dt><dd>{list.join(', ')}</dd></div>
              ))}
            </dl>
          </div>
        </div>
      </div>
      <button type="button" className="resume__more" aria-haspopup="dialog" aria-label="Learn more: open the full résumé" onClick={onOpen}>
        Learn more <CaretRight aria-hidden="true" weight="bold" />
      </button>
    </motion.article>
  );
}
