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

test('last played track renders with a compact strip, and play brings in the official player', async ({ page }) => {
  await mock(page, 200, body());
  await page.goto('/');
  const tile = page.locator('[data-spotify-tile]');
  await expect(tile.getByRole('link', { name: /Yellow/ })).toHaveAttribute('href', `https://open.spotify.com/track/${ID}`);
  await expect(tile.getByText('Last played on Spotify')).toBeVisible();
  await expect(tile.getByText('1 hour ago')).toBeVisible();
  // At rest: no third-party iframe, and no repeated art or title in the strip.
  await expect(tile.locator('iframe')).toHaveCount(0);
  const strip = tile.getByRole('group', { name: 'Playback' });
  await expect(strip.getByText('0:00 / 4:27')).toBeVisible();
  await expect(strip.locator('img')).toHaveCount(0);
  await expect(strip.getByText('Yellow')).toHaveCount(0);
  // Keyboard: play from the strip.
  await strip.getByRole('button', { name: 'Play Yellow with Spotify' }).focus();
  await page.keyboard.press('Enter');
  await expect(tile.locator('iframe')).toHaveAttribute('src', new RegExp(`/embed/track/${ID}`));
  await expect(tile.locator('iframe')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__spotifyCalls)).toContain('play');
  await tile.getByRole('button', { name: /Hide player/ }).click();
  await expect(tile.locator('iframe')).toHaveCount(0);
  await expect(strip.getByText('0:09 / 0:30')).toBeVisible();
  await expect(strip.getByRole('button', { name: 'Play Yellow with Spotify' })).toBeFocused();
});

test('options menu works from the keyboard and only links to Spotify', async ({ page }) => {
  await mock(page, 200, body());
  await page.goto('/');
  const tile = page.locator('[data-spotify-tile]');
  await tile.getByRole('button', { name: 'More options' }).click();
  const items = tile.getByRole('menuitem');
  await expect(items).toHaveCount(4);
  await expect(items.first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(items.nth(1)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(tile.getByRole('menu')).toHaveCount(0);
  await expect(tile.getByRole('button', { name: 'More options' })).toBeFocused();
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
  await expect(page.getByRole('link', { name: /Yellow/ })).toBeVisible();
});

test('tile fits at phone width and in both themes', async ({ page }) => {
  await mock(page, 200, body());
  await page.setViewportSize({ width: 390, height: 844 });
  for (const colorScheme of ['dark', 'light']) {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    await expect(page.locator('[data-spotify-tile] .spotify__strip')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const b of await page.locator('[data-spotify-tile] .spotify__strip').locator('button, a').all()) {
      const box = await b.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.waitForTimeout(900); // let the grid entrance animation finish
    await page.locator('[data-spotify-tile]').screenshot({ path: `test-results/spotify-${colorScheme}.png` });
  }
});
