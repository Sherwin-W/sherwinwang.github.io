import { useState, type FocusEvent, type PointerEvent } from 'react';
import { useReducedMotion } from 'framer-motion';
import { tileVariants } from './motion';

const still = { rest: { transition: { duration: 0.22 } }, hover: { transition: { duration: 0.22 } }, press: { transition: { duration: 0.22 } } };

/**
 * Props for a `motion.article` so an interactive tile lifts on hover or keyboard focus and settles on press,
 * like every other clickable tile. Reduced motion keeps it still.
 */
export function useTileMotion() {
  const reduceMotion = useReducedMotion();
  const [focusVisible, setFocusVisible] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const finePointer = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;
  return {
    initial: 'rest',
    animate: pressed && !reduceMotion ? 'press' : (hovered || focusVisible) && !reduceMotion ? 'hover' : 'rest',
    variants: reduceMotion ? still : tileVariants,
    onHoverStart: () => { if (finePointer && !reduceMotion) setHovered(true); },
    onHoverEnd: () => setHovered(false),
    onPointerDown: (event: PointerEvent) => { if (event.isPrimary && event.button === 0 && !reduceMotion) setPressed(true); },
    onPointerUp: () => setPressed(false),
    onPointerCancel: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    onFocus: (event: FocusEvent) => setFocusVisible((event.target as HTMLElement).matches(':focus-visible')),
    onBlur: (event: FocusEvent) => {
      setPressed(false);
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusVisible(false);
    },
  };
}
