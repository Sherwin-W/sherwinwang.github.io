import type { ReactNode } from 'react';

interface Props { title: string; icon?: ReactNode; accent?: 'violet' | 'coral' | 'mint'; className?: string; children: ReactNode; labelledBy?: string }

/** A retro desktop window. The title bar dots are decoration only. */
export default function Window({ title, icon, accent = 'violet', className = '', children, labelledBy }: Props) {
  return (
    <section className={`mb-win mb-win--${accent} ${className}`} aria-labelledby={labelledBy}>
      <div className="mb-win__bar">
        <span className="mb-win__icon" aria-hidden="true">{icon ?? '◆'}</span>
        <span className="mb-win__title">{title}</span>
        <span className="mb-win__dots" aria-hidden="true"><i /><i /><i /></span>
      </div>
      <div className="mb-win__body">{children}</div>
    </section>
  );
}
