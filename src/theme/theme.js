import { useSyncExternalStore } from 'react';

const KEY = 'theme';
const listeners = new Set();
const media = window.matchMedia('(prefers-color-scheme: light)');
let memoryTheme = null;

function updateThemeColor(theme) {
  const isSketchbook = location.pathname.startsWith('/sketchbook');
  const color = isSketchbook ? (theme === 'dark' ? '#1a1917' : '#f4efe4') : (theme === 'dark' ? '#0b0d12' : '#e3e7ef');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}

export function getStoredTheme() {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export function getEffectiveTheme() {
  return getStoredTheme() || memoryTheme || (media.matches ? 'light' : 'dark');
}

function syncTheme(theme, transition = false) {
  document.documentElement.dataset.theme = theme;
  updateThemeColor(theme);
  if (transition) {
    const root = document.documentElement;
    root.classList.add('theme-transition');
    window.setTimeout(() => root.classList.remove('theme-transition'), 260);
  }
  listeners.forEach(listener => listener());
}

export function setTheme(theme) {
  if (theme !== 'light' && theme !== 'dark') return;
  memoryTheme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Theme remains active in memory when storage is unavailable.
  }
  syncTheme(theme, true);
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

window.addEventListener('storage', event => {
  if (event.key === KEY || event.key === null) {
    const theme = getStoredTheme();
    if (theme) { memoryTheme = theme; syncTheme(theme, true); }
    else {
      memoryTheme = null;
      delete document.documentElement.dataset.theme;
      updateThemeColor(getEffectiveTheme());
      listeners.forEach(listener => listener());
    }
  }
});

media.addEventListener('change', () => {
  if (!getStoredTheme()) {
    updateThemeColor(media.matches ? 'light' : 'dark');
    listeners.forEach(listener => listener());
  }
});

export function useTheme() {
  return useSyncExternalStore(subscribe, getEffectiveTheme, getEffectiveTheme);
}

updateThemeColor(getEffectiveTheme());
