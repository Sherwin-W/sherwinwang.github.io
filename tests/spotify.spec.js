import { test, expect } from '@playwright/test';

const ID = '3AJwUDP919kvQ9QcozQPxg';
const body = (over = {}) => ({
  track: { id: ID, title: 'Gravity', artists: ['John Mayer'], album: 'Continuum', albumArt: 'https://i.scdn.co/image/none', spotifyUrl: '', embedUrl: '' },
  isCurrentlyPlaying: false, playedAt: new Date(Date.now() - 3600_000).toISOString(), updatedAt: new Date().toISOString(), ...over,
});
const mock = (page, status, json) => page.route('**/api/spotify/last-played', route => route.fulfill({ status, json, headers: { 'access-control-allow-origin': '*' } }));
// Stub third-party hosts so tests never touch Spotify.
test.beforeEach(async ({ page }) => {
  await page.route('https://open.spotify.com/**', route => route.fulfill({ contentType: 'text/html', body: '<p>embed</p>' }));
  await page.route('https://i.scdn.co/**', route => route.fulfill({ status: 404 }));
});

test('last played track renders with a matching embed and Spotify link', async ({ page }) => {
  await mock(page, 200, body());
  await page.goto('/');
  const tile = page.locator('[data-spotify-tile]');
  await expect(tile.getByRole('link', { name: /Gravity/ })).toHaveAttribute('href', `https://open.spotify.com/track/${ID}`);
  await expect(tile.getByText('Last played on Spotify')).toBeVisible();
  await expect(tile.locator('iframe')).toHaveAttribute('src', new RegExp(`/embed/track/${ID}`));
  await expect(tile.getByText('1 hour ago')).toBeVisible();
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
  await expect(page.getByRole('link', { name: /Gravity/ })).toBeVisible();
});

test('tile fits at phone width and in both themes', async ({ page }) => {
  await mock(page, 200, body());
  await page.setViewportSize({ width: 390, height: 844 });
  for (const colorScheme of ['dark', 'light']) {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    await expect(page.locator('[data-spotify-tile] iframe')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.waitForTimeout(900); // let the grid entrance animation finish
    await page.locator('[data-spotify-tile]').screenshot({ path: `test-results/spotify-${colorScheme}.png` });
  }
});
