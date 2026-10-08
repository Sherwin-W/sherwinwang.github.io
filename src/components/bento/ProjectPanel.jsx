/* eslint-disable react/prop-types */
import { useEffect, useRef } from 'react';
import { ArrowUpRight, X } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { visualRegistry } from './visuals';
import './panel.css';

const panelSpring = { type: 'spring', stiffness: 260, damping: 30 };

export default function ProjectPanel({ item, onClose, reduceMotion }) {
  const closeRef = useRef(null);
  const panelRef = useRef(null);
  useEffect(() => {
    if (!item) return undefined;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const width = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (width > 0) body.style.paddingRight = `${width}px`;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const focusables = [...panelRef.current.querySelectorAll('button:not([disabled]),a[href]')];
      const first = focusables[0]; const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); body.style.overflow = previousOverflow; body.style.paddingRight = previousPadding; };
  }, [item, onClose]);

  return <AnimatePresence>
    {item && <motion.div className="project-panel__scrim" key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0.15 : 0.22 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.section ref={panelRef} className="project-panel" role="dialog" aria-modal="true" aria-labelledby={`project-panel-title-${item.id}`} layoutId={reduceMotion ? undefined : `project-surface-${item.id}`} initial={reduceMotion ? { opacity: 0 } : undefined} animate={{ opacity: 1 }} exit={reduceMotion ? { opacity: 0 } : undefined} transition={reduceMotion ? { duration: 0.15 } : panelSpring}>
        <button ref={closeRef} className="project-panel__close" type="button" onClick={onClose}><X aria-hidden="true" weight="regular" />Close</button>
        <div className="project-panel__content" style={{ transitionDelay: reduceMotion ? '0ms' : '100ms' }}>
          <h2 id={`project-panel-title-${item.id}`}>{item.title}</h2><p>{item.summary}</p>
          {item.tags?.length > 0 && <ul className="bento-tags" aria-label="Technologies">{item.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>}
          {item.visual && item.area === 'privacy' && (() => { const Visual = visualRegistry[item.visual]; return Visual ? <div className="project-panel__visual"><Visual /></div> : null; })()}
          {item.details?.length > 0 && <ul className="project-panel__details">{item.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>}
          {item.links?.length > 0 && <div className="project-panel__links">{item.links.map((link) => <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">{link.label}<ArrowUpRight aria-hidden="true" /> <span className="visually-hidden">(opens in a new tab)</span></a>)}</div>}
        </div>
      </motion.section>
    </motion.div>}
  </AnimatePresence>;
}
