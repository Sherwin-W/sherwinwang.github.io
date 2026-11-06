import { test, expect } from '@playwright/test';

// Homepage: Professional and After Hours sections, contact links, résumé viewer, Road to Diamond.
const TRACK = { track: { id: '3AJwUDP919kvQ9QcozQPxg', title: 'Yellow', artists: ['Coldplay'], album: 'Parachutes', albumArt: null, durationMs: 266773 }, isCurrentlyPlaying: false, playedAt: null, updatedAt: '' };
const RANK = { riotId: 'DippoBippo#cccc', queue: 'RANKED_SOLO_5x5', ranked: true, tier: 'PLATINUM', division: 'III', lp: 41, stale: false };
const cors = { 'access-control-allow-origin': '*' };

async function mockApis(page, rank = { status: 200, json: { ...RANK, fetchedAt: new Date().toISOString() } }) {
  await page.route('**/api/spotify/last-played', (r) => r.fulfill({ status: 200, json: TRACK, headers: cors }));
  await page.route('**/api/league/rank', (r) => r.fulfill({ ...rank, headers: cors }));
  await page.route('https://open.spotify.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '' }));
}
const box = (page, sel) => page.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, w: r.width, h: r.height, right: r.right, bottom: r.bottom + scrollY }; });

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); await mockApis(page); });

test('Professional comes before After Hours, with the cards in reading order', async ({ page }) => {
  await page.goto('/');
  const pro = page.getByRole('region', { name: 'Professional' });
  const after = page.getByRole('region', { name: 'After Hours' });
  await expect(pro.getByText('Professional', { exact: true })).toBeVisible();
  await expect(after.getByText('After Hours', { exact: true })).toBeVisible();
  expect((await box(page, '.bento-grid--professional')).bottom).toBeLessThan((await box(page, '.bento-grid--after-hours')).y);
  const order = (region) => region.locator('.bento-slot').evaluateAll((els) => els.map((e) => e.className.match(/bento-slot--(\S+)/)[1]));
  expect(await order(pro)).toEqual(['identity', 'about', 'league', 'resume', 'quest']);
  expect(await order(after)).toEqual(['spotify', 'sketchbook', 'mbti', 'blackjack']);
  for (const gone of ['Privacy Preserving Visualization Tool', 'HTML Transformer', 'Flutter Event Planning App']) await expect(page.getByText(gone)).toHaveCount(0);
});

test('contact icons are labelled, keyboard reachable, and open mail or a safe new tab', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/');
  const contact = page.getByRole('list', { name: 'Contact' });
  await expect(contact.getByRole('link', { name: 'Email Sherwin' })).toHaveAttribute('href', 'mailto:sherwinnw22@gmail.com');
  for (const [name, href] of [['GitHub', 'https://github.com/Sherwin-W'], ['LinkedIn', 'https://www.linkedin.com/in/sherwinnw/']]) {
    const link = contact.getByRole('link', { name: `${name} (opens in a new tab)` });
    await expect(link).toHaveAttribute('href', href);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  await expect(page.getByText('Costa Mesa, CA')).toBeVisible();
  // Tab order: theme toggle, the three icons, the rank card, the résumé, QuestBoard.
  const stops = [];
  for (let i = 0; i < 7; i += 1) {
    await page.keyboard.press('Tab');
    stops.push(await page.evaluate(() => document.activeElement.getAttribute('aria-label') || document.activeElement.textContent.trim()));
  }
  expect(stops).toEqual(['Switch to light theme', 'Email Sherwin', 'GitHub (opens in a new tab)', 'LinkedIn (opens in a new tab)', 'Road to Diamond on OP.GG, DippoBippo#cccc (opens in a new tab)', 'Learn more: open the full résumé', 'QuestBoard  (opens in a new tab)']);
  for (const a of await contact.getByRole('link').all()) {
    const b = await a.boundingBox();
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('link', { name: 'GitHub (opens in a new tab)' }).focus();
  const ring = await page.getByRole('link', { name: 'GitHub (opens in a new tab)' }).evaluate((e) => getComputedStyle(e).outlineStyle);
  expect(ring).toBe('solid');
});

test('the résumé opens in an accessible viewer from the card or its button, and closes cleanly', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'pdfViewerEnabled', { get: () => true }));
  await page.goto('/');
  const learn = page.getByRole('button', { name: 'Learn more: open the full résumé' });
  await learn.click();
  const dialog = page.getByRole('dialog', { name: 'Résumé' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  await expect(dialog.locator('iframe')).toHaveAttribute('src', '/resume/Sherwin_Wang.pdf#view=FitH');
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(learn).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  // While open, keyboard focus never reaches the page behind it.
  await learn.click();
  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => !document.activeElement.closest('.home-section'))).toBe(true);
  }
  await dialog.getByRole('button', { name: 'Close' }).click();

  // Clicking anywhere on the card opens it too; the Close button and the backdrop close it.
  const sheet = await page.locator('.resume__sheet').boundingBox();
  await page.mouse.click(sheet.x + 40, sheet.y + 120);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  await learn.click();
  await page.mouse.click(4, 4);
  await expect(dialog).toBeHidden();
});

test('the résumé downloads, opens in a new tab, and has a fallback where PDFs cannot show inline', async ({ page, request }) => {
  const pdf = await request.get('/resume/Sherwin_Wang.pdf');
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toContain('application/pdf');
  await page.addInitScript(() => Object.defineProperty(navigator, 'pdfViewerEnabled', { get: () => false }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /Learn more/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Résumé' });
  await expect(dialog.getByText(/can’t show the PDF on the page/)).toBeVisible();
  await expect(dialog.locator('iframe')).toHaveCount(0);
  const open = dialog.getByRole('link', { name: /Open PDF/ });
  await expect(open).toHaveAttribute('target', '_blank');
  await expect(open).toHaveAttribute('rel', 'noopener noreferrer');
  const download = page.waitForEvent('download');
  await dialog.getByRole('link', { name: 'Download' }).click();
  expect((await download).suggestedFilename()).toBe('Sherwin_Wang_Resume.pdf');
  // Full screen on a phone, buttons reachable.
  const d = await dialog.boundingBox();
  expect(d.width).toBe(390);
  for (const b of await dialog.locator('.resume-viewer__btn').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
});

test.describe('Road to Diamond', () => {
  test('shows the live rank on a tall, narrow rail that opens OP.GG', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const rail = page.locator('.rank-rail');
    await expect(rail.getByText('Platinum III')).toBeVisible();
    await expect(rail.getByText('41 LP')).toBeVisible();
    await expect(rail.getByText(/^Live from Riot/)).toBeVisible();
    await expect(rail).toHaveAttribute('data-source', 'live');
    const link = page.getByRole('link', { name: /Road to Diamond/ });
    await expect(link).toHaveAttribute('href', 'https://op.gg/lol/summoners/na/DippoBippo-cccc');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    const r = await box(page, '.bento-slot--league');
    expect(r.w).toBeLessThan(240);
    expect(r.h).toBeGreaterThan(r.w * 3);
    // It spans both professional rows, beside the about card.
    expect(Math.abs(r.y - (await box(page, '.bento-slot--about')).y)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.bottom - (await box(page, '.bento-slot--resume')).bottom)).toBeLessThanOrEqual(1);
    // Marker height matches progress: Platinum III 41 LP is (4*4 + 1 + .41) / 24 of the way up.
    const [track, marker] = await Promise.all([box(page, '.rank-rail__track'), box(page, '.rank-rail__marker')]);
    const expected = (17.41 / 24);
    expect(Math.abs((track.bottom - (marker.y + marker.h / 2)) / track.h - expected)).toBeLessThan(0.03);
    // Riot's own emblems, loaded and not blurry placeholders.
    for (const img of await rail.locator('img').all()) expect(await img.evaluate((e) => e.complete && e.naturalWidth >= 96)).toBe(true);
  });

  test('falls back to the labelled manual rank when the API is unavailable', async ({ page }) => {
    await page.unroute('**/api/league/rank');
    await page.route('**/api/league/rank', (r) => r.fulfill({ status: 503, json: { error: 'not-configured' }, headers: cors }));
    await page.goto('/');
    await expect(page.locator('.rank-rail')).toHaveAttribute('data-source', 'manual');
    await expect(page.locator('.rank-rail').getByText(/^Updated by hand · /)).toBeVisible();
  });

  test('shows unranked without a marker, and a saved rank as saved', async ({ page }) => {
    await page.unroute('**/api/league/rank');
    await page.route('**/api/league/rank', (r) => r.fulfill({ status: 200, json: { riotId: 'DippoBippo#cccc', queue: 'RANKED_SOLO_5x5', ranked: false, fetchedAt: new Date().toISOString(), stale: false }, headers: cors }));
    await page.goto('/');
    await expect(page.locator('.rank-rail').getByText('Unranked')).toBeVisible();
    await expect(page.locator('.rank-rail__marker')).toHaveCount(0);
    await page.unroute('**/api/league/rank');
    await page.route('**/api/league/rank', (r) => r.fulfill({ status: 200, json: { ...RANK, fetchedAt: new Date(Date.now() - 3 * 3600e3).toISOString(), stale: true }, headers: cors }));
    await page.reload();
    await expect(page.locator('.rank-rail').getByText('Saved rank · Riot last answered 3 hours ago')).toBeVisible();
  });

  test('becomes a compact horizontal bar on phones', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const track = await box(page, '.rank-rail__track');
    expect(track.w).toBeGreaterThan(track.h * 15);
    const rail = await box(page, '.bento-slot--league');
    expect(rail.h).toBeLessThan(260);
    // It follows the "Who am I?" card that ends on the side quest.
    expect(rail.y).toBeGreaterThan((await box(page, '.bento-slot--about')).bottom);
    const label = await box(page, '.rank-rail__now');
    expect(label.x).toBeGreaterThanOrEqual(rail.x);
    expect(label.right).toBeLessThanOrEqual(rail.right);
  });
});

test('After Hours: Spotify first, then three apps with equal height and aligned titles; Blackjack is green in both themes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const scheme of ['dark', 'light']) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto('/');
    const spotify = await box(page, '.bento-slot--spotify');
    const tiles = await Promise.all(['sketchbook', 'mbti', 'blackjack'].map((s) => box(page, `.bento-slot--${s}`)));
    const titles = await Promise.all(['sketchbook', 'mbti', 'blackjack'].map((s) => box(page, `.bento-slot--${s} h2`)));
    expect(spotify.bottom).toBeLessThan(tiles[0].y);
    expect(Math.abs(spotify.w - (tiles[2].right - tiles[0].x))).toBeLessThanOrEqual(1);
    for (const t of tiles) { expect(Math.abs(t.h - tiles[0].h)).toBeLessThanOrEqual(1); expect(Math.abs(t.y - tiles[0].y)).toBeLessThanOrEqual(1); expect(Math.abs(t.w - tiles[0].w)).toBeLessThanOrEqual(1); }
    for (const t of titles) expect(Math.abs(t.y - titles[0].y)).toBeLessThanOrEqual(2);
    const bj = await page.locator('.bento-tile--blackjack').evaluate((e) => [getComputedStyle(e).backgroundImage, getComputedStyle(e.querySelector('h2')).color]);
    expect(bj[0]).toContain('rgb(31, 92, 66)');
    expect(bj[1]).toBe('rgb(238, 247, 241)');
    const rail = await page.locator('.rank-rail').evaluate((e) => getComputedStyle(e).backgroundImage);
    expect(rail).toContain('rgb(18, 26, 50)');
    await expect(page.getByRole('link', { name: /Blackjack Trainer/ })).toHaveAttribute('href', '/blackjack/');
  }
});

test('QuestBoard is a standard-size card beside the larger résumé, still linking to the tracker', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const [quest, resume] = await Promise.all([box(page, '.bento-slot--quest'), box(page, '.bento-slot--resume')]);
  expect(quest.w).toBeLessThan(resume.w * 0.8);
  expect(Math.abs(quest.h - resume.h)).toBeLessThanOrEqual(1);
  expect(quest.h).toBeLessThan(460);
  await expect(page.getByRole('link', { name: /QuestBoard/ })).toHaveAttribute('href', 'https://tracker.sherwinwang.dev');
  await expect(page.locator('.bento-slot--quest .visual-caption')).toHaveText('Illustration');
  for (const panel of await page.locator('.bento-slot--quest .quest-panel').all()) {
    const p = await panel.boundingBox(); const m = await page.locator('.bento-slot--quest .quest-preview').boundingBox();
    expect(p.x >= m.x - 1 && p.y >= m.y - 1 && p.x + p.width <= m.x + m.width + 1 && p.y + p.height <= m.y + m.height + 1).toBe(true);
  }
});

for (const [width, height] of [[1440, 900], [1024, 768], [768, 1024], [390, 844], [320, 640]]) {
  test(`layout holds at ${width}px: no overflow, overlap, clipping or tiny targets`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.waitForTimeout(300);
    const failures = await page.evaluate(() => {
      const out = [];
      if (document.documentElement.scrollWidth > innerWidth) out.push('page horizontal overflow');
      const slots = [...document.querySelectorAll('.bento-slot')].map((e) => [e.className, e.getBoundingClientRect()]);
      for (let i = 0; i < slots.length; i += 1) for (let j = i + 1; j < slots.length; j += 1) {
        const [, a] = slots[i]; const [, b] = slots[j];
        if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push(`overlap ${slots[i][0]} / ${slots[j][0]}`);
      }
      for (const tile of document.querySelectorAll('.bento-tile')) {
        const t = tile.getBoundingClientRect();
        for (const el of tile.querySelectorAll('h1,h2,h3,p,dt,dd,strong,.rank-rail__now,.rank-rail__cap,.rank-rail__id')) {
          if (getComputedStyle(el).display === 'none' || el.closest('.visually-hidden')) continue;
          const r = el.getBoundingClientRect();
          if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== 'inline') out.push(`clipped text: ${el.textContent.slice(0, 30)}`);
          if (r.left < t.left + 12 || r.right > t.right - 12) out.push(`text too close to edge: ${el.textContent.slice(0, 30)}`);
        }
      }
      for (const el of document.querySelectorAll('.identity__icon,.resume__more,.theme-toggle,.spotify__play')) {
        const r = el.getBoundingClientRect();
        if (r.width < 44 || r.height < 44) out.push(`small target ${el.className}`);
      }
      return out;
    });
    expect(failures).toEqual([]);
  });
}
