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
    await page.getByRole('button', { name: /Privacy Preserving Visualization Tool/ }).click();
    await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
    const panel = await audit(['.project-panel', '.project-panel__scrim']);
    expect(panel).toHaveLength(2);
    expect(panel.every(item => item.alpha === 1 && item.backdropFilter === 'none' && [undefined, '', 'none'].includes(item.webkitBackdropFilter))).toBe(true);
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

test('destination tiles open safe new tabs and preserve the portfolio tab', async ({ page, context }) => {
  await page.goto('/');
  const quest = page.getByRole('link', { name: /Quest Board.*opens in a new tab/ });
  const sketchbook = page.getByRole('link', { name: /Sketchbook.*opens in a new tab/ });
  const github = page.getByRole('link', { name: /GitHub/ });
  for (const link of [quest, sketchbook]) {
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  }
  const tabStops = [];
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  for (let index = 0; index < 3; index += 1) {
    tabStops.push(await page.evaluate(() => ({ text: document.activeElement.textContent, href: document.activeElement.getAttribute('href') })));
    if (index < 2) await page.keyboard.press('Tab');
  }
  expect(tabStops.map(item => item.href)).toEqual(['https://github.com/sherwin-w', 'https://tracker.sherwinwang.dev', '/sketchbook/']);
  expect(tabStops.filter(item => item.href?.includes('github.com'))).toHaveLength(1);
  expect(tabStops.filter(item => item.href === 'https://tracker.sherwinwang.dev')).toHaveLength(1);
  expect(tabStops.filter(item => item.href === '/sketchbook/')).toHaveLength(1);
  await expect(github).toBeAttached();

  const newPagePromise = context.waitForEvent('page');
  await sketchbook.click();
  const sketchPage = await newPagePromise;
  await expect(sketchPage).toHaveURL(/\/sketchbook\/$/);
  await expect(sketchPage.getByRole('button', { name: 'Select', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
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

test('expanding project panels trap focus, lock scroll, and return focus', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: /Privacy Preserving Visualization Tool/ });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAttribute('aria-labelledby', /project-panel-title/);
  await expect(dialog.getByRole('heading', { name: 'Privacy Preserving Visualization Tool' })).toBeVisible();
  await expect(dialog.getByText('A tool to visualize data while preserving privacy using differential privacy techniques.', { exact: true })).toHaveCount(1);
  await expect(dialog.getByText('Illustration')).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await expect(trigger).toBeFocused();
});

test('project panel makes the portfolio inert without console errors', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.goto('/');
  const grid = page.locator('.bento-grid');
  const trigger = page.getByRole('button', { name: /HTML Transformer/ });
  await trigger.click();
  await expect(grid).toHaveAttribute('inert', '');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(grid).not.toHaveAttribute('inert');
  expect(consoleErrors).toEqual([]);
});

test('expanding projects have one tab stop each and close by button or scrim', async ({ page }) => {
  await page.goto('/');
  const active = [];
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  for (let index = 0; index < 6; index += 1) {
    active.push(await page.evaluate(() => {
      const element = document.activeElement;
      const href = element.getAttribute('href');
      if (href?.includes('github.com')) return 'GitHub';
      if (href?.includes('tracker.sherwinwang.dev')) return 'Quest Board';
      if (href?.endsWith('/sketchbook/')) return 'Sketchbook';
      return element.textContent.trim();
    }));
    if (index < 5) await page.keyboard.press('Tab');
  }
  expect(active).toEqual(['GitHub', 'Quest Board', 'Sketchbook', 'Privacy Preserving Visualization Tool', 'HTML Transformer', 'Flutter Event Planning App']);
  await page.getByRole('button', { name: /HTML Transformer/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'HTML Transformer' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: /Flutter Event Planning App/ }).click();
  await page.locator('.project-panel__scrim').click({ position: { x: 8, y: 8 } });
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('reduced motion opens the project panel without a transform animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: /HTML Transformer/ }).click();
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  await expect.poll(() => panel.evaluate(element => element.getAnimations().filter(animation => animation.playState === 'running' && animation.effect.getKeyframes().some(frame => 'transform' in frame)).length)).toBe(0);
});

test('tile spacing and text fit at standard and zoom-equivalent widths', async ({ page }) => {
  for (const [width, height] of [[1440, 900], [820, 1100], [390, 844], [720, 450], [195, 420]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const result = await page.evaluate(width => {
      const tiles = [...document.querySelectorAll('.bento-tile')];
      const failures = [];
      for (const tile of tiles) {
        const tileRect = tile.getBoundingClientRect();
        for (const text of tile.querySelectorAll('h1,h2,p')) {
          const rect = text.getBoundingClientRect();
          if (text.scrollWidth > text.clientWidth + 1) failures.push('text overflow');
          if (rect.left - tileRect.left < 20 || tileRect.right - rect.right < 20) failures.push('text edge padding');
        }
        const tags = tile.querySelector('.bento-tags,.bento-chips');
        const paragraph = tile.querySelector('p');
        if (tags && paragraph) {
          const p = paragraph.getBoundingClientRect();
          const t = tags.getBoundingClientRect();
          const beside = p.right <= t.left || t.right <= p.left;
          const distance = beside ? Math.max(t.left - p.right, p.left - t.right) : Math.max(t.top - p.bottom, p.top - t.bottom);
          if (distance < 16) failures.push('paragraph to tags gap');
        }
        if (tile.querySelector('[style*="text-overflow: ellipsis"], [style*="-webkit-line-clamp"]')) failures.push('truncation');
        if ([...tile.querySelectorAll('*')].some(element => {
          const style = getComputedStyle(element);
          return style.textOverflow === 'ellipsis' || style.webkitLineClamp !== 'none';
        })) failures.push('truncation');
      }
      const quest = document.querySelector('.bento-slot--quest');
      const questTile = quest.querySelector('.bento-tile');
      const media = quest.querySelector('.bento-quest__media');
      const mediaRect = media.getBoundingClientRect();
      const questRect = questTile.getBoundingClientRect();
      if (width === 1440 && media.querySelector('.quest-preview').getBoundingClientRect().height <= 200) failures.push('desktop quest preview collapsed');
      if (width === 1440 && questRect.height >= 700) failures.push('desktop quest tile too tall');
      if (width === 390 && questRect.height >= 560) failures.push('mobile quest tile too tall');
      if (width === 820 && questRect.height > 620) failures.push('tablet quest tile too tall');
      if (width === 390 && (questRect.height < 480 || questRect.height > 510)) failures.push('mobile quest tile height');
      if (width === 820 || width === 1440) {
        for (const panel of media.querySelectorAll('.quest-panel')) {
          const rect = panel.getBoundingClientRect();
          if (rect.left < mediaRect.left || rect.top < mediaRect.top || rect.right > mediaRect.right || rect.bottom > mediaRect.bottom) failures.push('quest panel outside media');
        }
        const caption = media.querySelector('.visual-caption');
        if (!caption || getComputedStyle(caption).visibility === 'hidden' || getComputedStyle(caption).display === 'none') failures.push('quest illustration caption hidden');
        else {
        const c = caption.getBoundingClientRect();
        for (const panel of media.querySelectorAll('.quest-panel')) {
          const p = panel.getBoundingClientRect();
          if (c.left < p.right && c.right > p.left && c.top < p.bottom && c.bottom > p.top) failures.push('quest caption intersects panel');
        }
        }
      }
      const sketch = document.querySelector('.bento-slot--sketchbook .bento-tile');
      const sketchRect = sketch.getBoundingClientRect();
      const sketchText = sketch.querySelector('.bento-tile__scrim').getBoundingClientRect();
      const stageRect = sketch.querySelector('.sketchbook-stage').getBoundingClientRect();
      const sketchObjects = [...sketch.querySelectorAll('.sketch-object')];
      if (sketchObjects.length !== 7) failures.push('sketch object count');
      if (sketchText.left < sketchRect.left || sketchText.top < sketchRect.top || sketchText.right > sketchRect.right || sketchText.bottom > sketchRect.bottom) failures.push('sketchbook text outside tile');
      for (const object of sketchObjects) {
        const rect = object.getBoundingClientRect();
        if (rect.width < 36 || rect.height < 36) failures.push('sketch object too small');
        if (rect.left < stageRect.left - 1 || rect.right > stageRect.right + 1 || rect.top < stageRect.top - 1 || rect.bottom > stageRect.bottom + 1) failures.push('sketch object outside stage');
        if (rect.left < sketchRect.left || rect.right > sketchRect.right || rect.top < sketchRect.top || rect.bottom > sketchRect.bottom) failures.push('sketch object outside tile');
        if (rect.left < sketchText.right && rect.right > sketchText.left && rect.top < sketchText.bottom && rect.bottom > sketchText.top) failures.push('sketch object intersects text');
      }
      if (width === 1440) {
        for (const selector of ['.bento-slot--identity .bento-tile', '.bento-slot--sketchbook .bento-tile', '.bento-slot--privacy .bento-tile']) {
          if (Math.abs(document.querySelector(selector).getBoundingClientRect().height - 296) > 4) failures.push(`desktop tile height ${selector}`);
        }
        for (const selector of ['.bento-slot--html', '.bento-slot--flutter']) {
          const tile = document.querySelector(selector);
          const tileHeight = tile.querySelector('.bento-tile').getBoundingClientRect().height;
          const p = tile.querySelector('p').getBoundingClientRect();
          const tag = tile.querySelector('.bento-tags').getBoundingClientRect();
          if (Math.abs(tileHeight - 140) > 2) failures.push(`desktop compact tile height ${selector}`);
          if (tag.left < p.right || tag.left - p.right < 16) failures.push(`desktop description/tag gap ${selector}`);
        }
      }
      if (width === 390) {
        for (const selector of ['.bento-slot--html', '.bento-slot--flutter']) {
          const tile = document.querySelector(`${selector} .bento-tile`);
          if (tile.getBoundingClientRect().height > 180) failures.push(`mobile compact tile too tall ${selector}`);
        }
      }
      for (const selector of ['.bento-slot--html', '.bento-slot--flutter']) {
        const tile = document.querySelector(`${selector} .bento-tile`);
        const titleRect = tile.querySelector('h2').getBoundingClientRect();
        const descriptionRect = tile.querySelector('p').getBoundingClientRect();
        if (Math.abs(titleRect.left - descriptionRect.left) > 1) failures.push(`compact title/description alignment ${selector}`);
        if (width < 640) {
          const tagRect = tile.querySelector('.bento-tags').getBoundingClientRect();
          if (Math.abs(titleRect.left - tagRect.left) > 1) failures.push(`compact tag alignment ${selector}`);
        }
      }
      if (document.documentElement.scrollWidth > document.documentElement.clientWidth) failures.push('page horizontal overflow');
      return failures;
    }, width);
    expect(result, `viewport ${width}x${height}`).toEqual([]);
  }
});

test('Privacy panel preserves content spacing and edge padding on desktop and mobile', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: /Privacy Preserving Visualization Tool/ }).click();
    await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
    await page.waitForTimeout(100);
    const result = await page.getByRole('dialog').evaluate(panel => {
      const title = panel.querySelector('h2').getBoundingClientRect();
      const summary = panel.querySelector('.project-panel__content p').getBoundingClientRect();
      const tags = panel.querySelector('.bento-tags').getBoundingClientRect();
      const artwork = panel.querySelector('.project-panel__visual').getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const edges = [...panel.querySelectorAll('h2,p')].every(element => {
        const rect = element.getBoundingClientRect();
        return rect.left - panelRect.left >= 20 && panelRect.right - rect.right >= 20;
      });
      return {
        titleSummary: summary.top - title.bottom,
        summaryTags: tags.top - summary.bottom,
        tagsArtwork: artwork.top - tags.bottom,
        edges,
      };
    });
    expect(result.titleSummary).toBeGreaterThanOrEqual(10);
    expect(result.summaryTags).toBeGreaterThanOrEqual(12);
    expect(result.tagsArtwork).toBeGreaterThanOrEqual(16);
    expect(result.edges).toBe(true);
  }
});
