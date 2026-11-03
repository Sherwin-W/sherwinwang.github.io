import { useCallback, useEffect, useState } from 'react';
import { clearProgress, emptyProgress, loadProgress, saveProgress, type Progress } from '../engine/stats';

export function useProgress() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  useEffect(() => { saveProgress(progress); }, [progress]);
  const update = useCallback((fn: (p: Progress) => Progress) => setProgress(fn), []);
  const reset = useCallback(() => { clearProgress(); setProgress(emptyProgress()); }, []);
  return { progress, update, reset };
}
export type ProgressApi = ReturnType<typeof useProgress>;
