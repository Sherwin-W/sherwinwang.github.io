import { Moon, Sun } from '@phosphor-icons/react';
import { setTheme, useTheme } from '../theme/theme';
import './theme-toggle.css';

export default function ThemeToggle() {
  const theme = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  const label = `Switch to ${next} theme`;
  const Icon = theme === 'light' ? Moon : Sun;
  return <button className="theme-toggle" type="button" aria-label={label} title={label} onClick={() => setTheme(next)}><Icon aria-hidden="true" size={20} weight="regular" /></button>;
}
