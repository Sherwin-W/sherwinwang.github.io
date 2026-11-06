import { test, expect } from '@playwright/test';

const ID = '3AJwUDP919kvQ9QcozQPxg';
const body = (over = {}) => ({
  track: { id: ID, title: 'Yellow', artists: ['Coldplay'], album: 'Parachutes', albumArt: 'https://i.scdn.co/image/none', spotifyUrl: '', embedUrl: '', durationMs: 266773 },
  isCurrentlyPlaying: false, playedAt: new Date(Date.now() - 3600_000).toISOString(), updatedAt: new Date().toISOString(), ...over,
});
const mock = (page, status, json) => page.route('**/api/spotify/last-played', route => route.fulfill({ status, json, headers: { 'access-control-allow-origin': '*' } }));
// Stub third-party hosts so tests never touch Spotify.
// A stand-in for Spotify's IFrame API: creates a visible embed iframe and reports playback.
const FAKE_IFRAME_API = `
  window.__spotifyCalls = [];
  window.onSpotifyIframeApiReady && window.onSpotifyIframeApiReady({
    createController(el, opts, cb) {
      const f = document.createElement('iframe');
      f.src = 'https://open.spotify.com/embed/track/' + opts.uri.split(':')[2];
      f.title = 'Spotify Embed'; f.height = opts.height; f.style.width = '100%';
      el.replaceWith(f);
      const ls = {};
      const c = { play(){ window.__spotifyCalls.push('play'); (ls.playback_update||[]).forEach(fn => fn({ data: { isPaused:false, isBuffering:false, duration:30000, position:9000 } })); },
        pause(){}, togglePlay(){}, destroy(){ window.__spotifyCalls.push('destroy'); f.remove(); },
        addListener(ev, fn){ (ls[ev] = ls[ev] || []).push(fn); if (ev === 'ready') setTimeout(fn, 50); } };
      cb(c);
    },
  });`;
test.beforeEach(async ({ page }) => {
  await page.route('https://open.spotify.com/embed/iframe-api/v1', route => route.fulfill({ contentType: 'text/javascript', body: FAKE_IFRAME_API }));
  await page.route('https://open.spotify.com/embed/track/**', route => route.fulfill({ contentType: 'text/html', body: '<p>embed</p>' }));
  await page.route('https://i.scdn.co/**', route => route.fulfill({ status: 404 }));
});

test('compact card: art, status, title, artist, play and a Spotify link; play brings in the official player', async ({ page }) => {
  await mock(page, 200, body());
  await page.goto('/');
  await expect(page.locator('[data-spotify-tile]')).toHaveCount(1);
  const tile = page.locator('[data-spotify-tile]');
  await expect(tile.getByText('Last played on Spotify')).toBeVisible();
  await expect(tile.getByText('1 hour ago')).toBeVisible();
  await expect(tile.getByRole('heading', { name: 'Yellow' })).toBeVisible();
  await expect(tile.getByText('Coldplay')).toBeVisible();
  await expect(tile.getByRole('link', { name: 'Open Yellow in Spotify (new tab)' })).toHaveAttribute('href', `https://open.spotify.com/track/${ID}`);
  // Only two controls, no progress bar, time or menu, and no third-party iframe until play.
  await expect(tile.locator('button, a')).toHaveCount(2);
  await expect(tile.getByRole('progressbar')).toHaveCount(0);
  await expect(tile.locator('iframe')).toHaveCount(0);
  // Keyboard: play.
  await tile.getByRole('button', { name: 'Play Yellow with Spotify' }).focus();
  await page.keyboard.press('Enter');
  await expect(tile.locator('iframe')).toHaveAttribute('src', new RegExp(`/embed/track/${ID}`));
  await expect(tile.locator('iframe')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__spotifyCalls)).toContain('play');
  // The official player replaces our details instead of repeating them, and fits inside the card.
  await expect(tile.getByRole('heading', { name: 'Yellow' })).toHaveCount(0);
  const [frame, card] = await Promise.all([tile.locator('iframe').boundingBox(), tile.boundingBox()]);
  expect(frame.height).toBeGreaterThanOrEqual(80);
  expect(frame.x >= card.x && frame.x + frame.width <= card.x + card.width && frame.y + frame.height <= card.y + card.height).toBe(true);
  await tile.getByRole('button', { name: /Close player/ }).click();
  await expect(tile.locator('iframe')).toHaveCount(0);
  await expect(tile.getByRole('button', { name: 'Play Yellow with Spotify' })).toBeFocused();
});

test('a very long title wraps to two lines and the artist truncates, inside the compact card', async ({ page }) => {
  const title = 'Supercalifragilisticexpialidocious (Remastered 2024) - From the Original Motion Picture Soundtrack';
  await mock(page, 200, body({ track: { ...body().track, title, artists: ['Julie Andrews', 'Dick Van Dyke', 'The Pearlies', 'Orchestra and Chorus'] } }));
  for (const [width, height] of [[1440, 900], [1024, 768], [390, 844], [320, 640]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const tile = page.locator('[data-spotify-tile]');
    await expect(tile.getByRole('heading', { name: title })).toBeVisible();
    const fit = await tile.evaluate((t) => {
      const c = t.getBoundingClientRect();
      const inside = (s) => { const r = t.querySelector(s).getBoundingClientRect(); return r.left >= c.left && r.right <= c.right && r.bottom <= c.bottom; };
      const h = t.querySelector('.spotify__title');
      return { lines: Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight)), parts: ['.spotify__title', '.spotify__artist', '.spotify__play', '.spotify__brand'].every(inside), page: document.documentElement.scrollWidth <= innerWidth };
    });
    expect(fit).toEqual({ lines: 2, parts: true, page: true });
  }
});

test('now listening state', async ({ page }) => {
  await mock(page, 200, body({ isCurrentlyPlaying: true, playedAt: null }));
  await page.goto('/');
  await expect(page.getByText('Now listening')).toBeVisible();
});

test('API failure shows a retry that recovers', async ({ page }) => {
  let fail = true;
  await page.route('**/api/spotify/last-played', route => fail
    ? route.fulfill({ status: 502, json: { error: 'unavailable' }, headers: { 'access-control-allow-origin': '*' } })
    : route.fulfill({ status: 200, json: body(), headers: { 'access-control-allow-origin': '*' } }));
  await page.goto('/');
  await expect(page.getByText('Spotify is unavailable right now.')).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Yellow' })).toBeVisible();
});

test('tile fits at phone width and in both themes', async ({ page }) => {
  await mock(page, 200, body());
  await page.setViewportSize({ width: 390, height: 844 });
  for (const colorScheme of ['dark', 'light']) {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    await expect(page.locator('[data-spotify-tile] .spotify__controls')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const b of await page.locator('[data-spotify-tile] .spotify__controls').locator('button, a').all()) {
      const box = await b.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.waitForTimeout(900); // let the grid entrance animation finish
    await page.locator('[data-spotify-tile]').screenshot({ path: `test-results/spotify-${colorScheme}.png` });
  }
});
