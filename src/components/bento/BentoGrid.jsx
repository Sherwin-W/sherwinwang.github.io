/* eslint-disable react/prop-types */
import { motion, useReducedMotion } from 'framer-motion';
import Tile from './Tile';
import ProjectPanel from './ProjectPanel';
import './bento.css';
import { useState } from 'react';

export default function BentoGrid({ items }) {
  const reduceMotion = useReducedMotion();
  const [activeProject, setActiveProject] = useState(null);
  const [origin, setOrigin] = useState(null);

  return (
    <>
    <section className="bento-grid" aria-label="Portfolio" inert={activeProject ? '' : undefined}>
      {items.map((item, index) => (
        <motion.div
          key={item.id}
          className={`bento-slot bento-slot--${item.area || item.size || 'standard'}`}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.36, delay: index * 0.04, ease: 'easeOut' }}
        >
          <Tile item={item} expanded={activeProject?.id === item.id} onExpand={(project) => { setOrigin(document.activeElement); setActiveProject(project); }} />
        </motion.div>
      ))}
    </section>
    <ProjectPanel item={activeProject} onClose={() => { setActiveProject(null); requestAnimationFrame(() => origin?.focus()); }} reduceMotion={reduceMotion} />
    </>
  );
}

