import { useEffect, useRef } from 'react';
import { ArrowUpRight, DownloadSimple, X } from '@phosphor-icons/react';
import resume from '../../data/resume';

/** Browsers that cannot show a PDF inline (most phones, some locked-down desktops) say so here. */
export const canShowPdfInline = () => typeof navigator === 'undefined' || navigator.pdfViewerEnabled !== false;

/**
 * The full résumé in a modal. Uses the native <dialog>, which keeps focus inside, closes on Escape and
 * makes the page behind it inert. Focus returns to whatever opened it.
 */
export default function ResumeViewer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return undefined;
    if (open && !el.open) {
      opener.current = document.activeElement as HTMLElement | null;
      el.showModal();
      closeButton.current?.focus();
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = previous; };
    }
    if (!open && el.open) el.close();
    return undefined;
  }, [open]);

  const close = () => {
    onClose();
    requestAnimationFrame(() => opener.current?.focus());
  };

  const inline = canShowPdfInline();

  return (
    <dialog
      ref={dialog}
      className="resume-viewer"
      aria-labelledby="resume-viewer-title"
      onCancel={(e) => { e.preventDefault(); close(); }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      {open && (
        <div className="resume-viewer__box">
          <div className="resume-viewer__bar">
            <h2 id="resume-viewer-title">Résumé</h2>
            <div className="resume-viewer__actions">
              <a className="resume-viewer__btn" href={resume.pdf} target="_blank" rel="noopener noreferrer">
                Open PDF <ArrowUpRight aria-hidden="true" /><span className="visually-hidden"> (opens in a new tab)</span>
              </a>
              <a className="resume-viewer__btn" href={resume.pdf} download={resume.downloadName}>
                <DownloadSimple aria-hidden="true" /> Download
              </a>
              <button ref={closeButton} type="button" className="resume-viewer__btn resume-viewer__close" onClick={close}>
                <X aria-hidden="true" /> Close
              </button>
            </div>
          </div>
          {inline ? (
            <iframe className="resume-viewer__pdf" src={`${resume.pdf}#view=FitH`} title="Sherwin Wang résumé (PDF)" />
          ) : (
            <div className="resume-viewer__fallback">
              <p>This browser can’t show the PDF on the page. Open it in a new tab or download it.</p>
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
