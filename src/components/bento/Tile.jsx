/* eslint-disable react/prop-types */
import { ArrowUpRight, CaretRight } from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTileMotion } from './useTileMotion';
import { visualRegistry } from './visuals';

function NewTabText() {
  return <span className="visually-hidden"> (opens in a new tab)</span>;
}

export default function Tile({ item, onExpand, expanded = false }) {
  const Visual = item.visual ? visualRegistry[item.visual] : null;
  const isSketchbook = item.area === 'sketchbook';
  const isLinkTile = Boolean(item.href);
  const reduceMotion = useReducedMotion();
  const motionProps = useTileMotion();
  const isExpandable = Boolean(item.expand);
  const isInteractive = isLinkTile || isExpandable;
  const tileClass = `bento-tile${item.area ? ` bento-tile--${item.area}` : ''}${isInteractive ? ' bento-tile--interactive' : ''}${isExpandable ? ' bento-tile--expandable' : ''}`;
  const articleProps = isInteractive ? motionProps : {};
  const TileTag = isInteractive ? motion.article : 'article';
  const trigger = <button className="bento-tile__trigger" type="button" aria-haspopup="dialog" aria-expanded={expanded} onClick={() => onExpand(item)}>
    {item.title}<CaretRight aria-hidden="true" weight="regular" />
  </button>;
  const link = <a className="bento-tile__link" href={item.href} target={item.newTab ? '_blank' : undefined} rel={item.newTab ? 'noopener noreferrer' : undefined}>
    {item.title} <ArrowUpRight aria-hidden="true" weight="regular" />{item.newTab && <NewTabText />}
  </a>;

  if (isSketchbook) {
    return <TileTag className={tileClass} {...articleProps}>
      {item.image ? <img className="bento-image" src={item.image.src} alt={item.image.alt} /> : Visual && <Visual />}
      <div className="bento-tile__scrim"><h2>{link}</h2><p>{item.summary}</p></div>
    </TileTag>;
  }

  if (isLinkTile) {
    return <TileTag className={tileClass} {...articleProps}>
      {Visual && <Visual />}
      <div className="bento-tile__content">
        <h2>{link}</h2><p>{item.summary}</p>
        {item.tags?.length > 0 && <ul className="bento-tags" aria-label="Technologies">{item.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>}
      </div>
    </TileTag>;
  }

  if (isExpandable) {
    return <TileTag className={tileClass} layoutId={reduceMotion ? undefined : `project-surface-${item.id}`} {...articleProps}>
      {item.area === 'privacy' && (item.image ? <img className="bento-image" src={item.image.src} alt={item.image.alt} /> : Visual && <Visual />)}
      <div className="bento-tile__content">
      <h2>{trigger}</h2><p>{item.summary}</p>
        {item.tags?.length > 0 && <ul className="bento-tags" aria-label="Technologies">{item.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>}
      </div>
    </TileTag>;
  }

  return <article className={tileClass}>
    {item.area === 'privacy' && (item.image ? <img className="bento-image" src={item.image.src} alt={item.image.alt} /> : Visual && <Visual />)}
    <div className="bento-tile__content">
      {item.headingLevel === 'h1' ? <h1>{item.title}</h1> : <h2>{item.title}</h2>}
      <p>{item.summary}</p>
      {item.tags?.length > 0 && <ul className="bento-tags" aria-label="Technologies">{item.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>}
      {item.links?.map((entry) => <a className="bento-link" key={entry.href} href={entry.href} target="_blank" rel="noopener noreferrer">{entry.label}<ArrowUpRight aria-hidden="true" weight="regular" /><NewTabText /></a>)}
      {item.interests?.length > 0 && <ul className="bento-chips" aria-label="Interests">{item.interests.map((interest) => <li key={interest}>{interest}</li>)}</ul>}
    </div>
  </article>;
}
