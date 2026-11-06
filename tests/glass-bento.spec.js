import { test, expect } from '@playwright/test';

test('theme follows the system until a choice is made, then toggles by keyboard and persists', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Switch to light theme' });
  await expect(toggle).toBeVisible();
  expect(await page.evaluate(() => [document.documentElement.dataset.theme, localStorage.getItem('theme')])).toEqual([undefined, null]);
  expect(await page.locator('.bento-tile').first().evaluate(el => getComputedStyle(el).color)).toBe('rgb(236, 238, 243)');
  const box = await toggle.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Tab');
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeFocused();
  expect(await page.evaluate(() => [document.documentElement.dataset.theme, localStorage.getItem('theme')])).toEqual(['light', 'light']);
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');
});

test('first visit follows either system color scheme without storing a theme', async ({ page }) => {
  for (const colorScheme of ['dark', 'light']) {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    const values = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, stored: localStorage.getItem('theme'), bg: getComputedStyle(document.querySelector('.bento-tile')).color }));
    expect(values.theme).toBeUndefined();
    expect(values.stored).toBeNull();
    expect(values.bg).toBe(colorScheme === 'dark' ? 'rgb(236, 238, 243)' : 'rgb(18, 21, 28)');
  }
});

test('saved light choice is applied before the portfolio module mounts', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => localStorage.setItem('theme', 'light'));
  await page.route(/\/src\/main\.jsx/, async route => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'commit' });
  await expect.poll(() => page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    bg: getComputedStyle(document.documentElement).backgroundColor,
    mounted: Boolean(document.querySelector('.home-page')),
  })), { intervals: [10, 20, 50] }).toEqual({ theme: 'light', bg: 'rgb(227, 231, 239)', mounted: false });
});

test('theme choice carries to Sketchbook and updates between open tabs', async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  const sketchPage = await context.newPage();
  await sketchPage.goto('/sketchbook/');
  await expect(sketchPage.locator('html')).toHaveAttribute('data-theme', 'light');
  await sketchPage.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(sketchPage.locator('.play-canvas')).toHaveCSS('--paper', '#1a1917');
  await expect.poll(() => page.locator('html').getAttribute('data-theme')).toBe('dark');
  const ink = await sketchPage.locator('.play-canvas').evaluate(canvas => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('draw-stroke-core');
    canvas.append(path);
    return getComputedStyle(path).stroke;
  });
  expect(ink).toBe('rgb(236, 231, 220)');
});

test('reduced transparency uses solid surfaces in both explicit themes', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
  const audit = selectors => page.evaluate(selectors => selectors.flatMap(selector => [...document.querySelectorAll(selector)].map(element => {
    const style = getComputedStyle(element);
    const background = style.backgroundColor;
    const rgba = background.match(/rgba?\(([^)]+)\)/)?.[1].split(/[ ,/]+/).filter(Boolean);
    const srgb = background.match(/color\(srgb\s+[^)]+\)/)?.[0];
    const srgbAlpha = srgb?.match(/\/\s*([\d.]+)\s*\)/);
    const alpha = rgba?.length === 4 ? Number(rgba[3]) : srgbAlpha ? Number(srgbAlpha[1]) : 1;
    return { background: style.backgroundColor, alpha, backdropFilter: style.backdropFilter, webkitBackdropFilter: style.webkitBackdropFilter };
  })), selectors);
  for (const theme of ['dark', 'light']) {
    await page.goto('/');
    await page.evaluate(value => { localStorage.setItem('theme', value); document.documentElement.dataset.theme = value; }, theme);
    await page.reload();
    await page.locator('.home-page .theme-toggle').hover();
    const portfolio = await audit(['.bento-tile--identity', '.quest-panel', '.theme-toggle']);
    expect(portfolio.every(item => item.alpha === 1 && item.backdropFilter === 'none' && [undefined, '', 'none'].includes(item.webkitBackdropFilter))).toBe(true);
    await page.getByRole('button', { name: /Learn more/ }).click();
    const viewer = await audit(['.resume-viewer', '.resume-viewer__box']);
    expect(viewer.length).toBeGreaterThan(0);
    expect(viewer[0].alpha).toBe(1);
    const backdrop = await page.locator('.resume-viewer').evaluate(el => { const s = getComputedStyle(el, '::backdrop'); return [s.backgroundColor, s.backdropFilter]; });
    expect(backdrop[1]).toBe('none');
    expect(backdrop[0]).not.toMatch(/rgba/);
    await page.getByRole('button', { name: 'Close' }).click();

    await page.goto('/sketchbook/');
    await page.evaluate(value => { localStorage.setItem('theme', value); document.documentElement.dataset.theme = value; }, theme);
    await page.reload();
    await page.locator('.sketchbook-page .theme-toggle').hover();
    const sketchbook = await audit(['.theme-toggle', '.sketchbook-page__dock button']);
    expect(sketchbook.length).toBeGreaterThan(1);
    expect(sketchbook.every(item => item.alpha === 1 && item.backdropFilter === 'none' && [undefined, '', 'none'].includes(item.webkitBackdropFilter))).toBe(true);
    await page.locator('.theme-toggle').focus();
    const focus = await page.locator('.theme-toggle').evaluate(button => getComputedStyle(button));
    expect(focus.outlineStyle).toBe('solid');
    expect(parseFloat(focus.outlineWidth)).toBeGreaterThan(0);
  }
});

test('legacy contact page keeps its cream background regardless of theme choice', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await page.goto('/contact');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(244, 239, 228)');
});

test('reduced motion keeps theme swaps instant and tile transforms independent', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  const style = await page.locator('.bento-tile').first().evaluate(el => getComputedStyle(el));
  expect(style.transitionDuration).toBe('0s');
  expect(style.transitionProperty).not.toContain('transform');
  await page.waitForTimeout(400);
  await expect(page.locator('html')).not.toHaveClass(/theme-transition/);
});

test('Sketchbook tile keeps warm paper and dark ink in both themes', async ({ page }) => {
  for (const theme of ['dark', 'light']) {
    await page.goto('/');
    await page.evaluate(value => localStorage.setItem('theme', value), theme);
    await page.reload();
    const colors = await page.locator('.bento-tile--sketchbook').evaluate(tile => ({
      background: getComputedStyle(tile).backgroundColor,
      title: getComputedStyle(tile.querySelector('h2')).color,
    }));
    expect(colors.background).toBe('rgb(244, 239, 228)');
    const [r, g, b] = colors.title.match(/\d+/g).map(Number);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    expect(luminance).toBeLessThan(0.2);
  }
});

test('sketchbook loads directly and reveals feedback only while slow', async ({ page }) => {
  await page.goto('/sketchbook/');
  await expect(page.getByRole('button', { name: 'Select', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.waitForTimeout(350);
  await expect(page.getByRole('status')).toHaveCount(0);

  await page.route(/PlayCanvas(-[\w-]+)?\.(jsx?|js)(\?.*)?$/, async route => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await route.continue();
  });
  await page.reload();
  const status = page.getByRole('status').filter({ hasText: 'Opening sketchbook' });
  await expect(status).toBeVisible({ timeout: 2000 });
  await expect(page.getByRole('button', { name: 'Select', exact: true })).toBeVisible({ timeout: 5000 });
  await expect(status).toHaveCount(0);
});

test('loading cat stays still with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(/PlayCanvas(-[\w-]+)?\.(jsx?|js)(\?.*)?$/, async route => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await route.continue();
  });
  await page.goto('/sketchbook/');
  const status = page.getByRole('status').filter({ hasText: 'Opening sketchbook' });
  await expect(status).toBeVisible();
  const cat = status.locator('img');
  await expect(cat).toHaveCSS('animation-name', 'none');
});

