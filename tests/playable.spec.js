import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.beforeAll(() => fs.mkdirSync('docs/playable-portfolio/screenshots', { recursive: true }));

test('desktop typed spawn, drag to trash, dialog keyboard close, and screenshots', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: "Hello, I'm Sherwin" })).toBeVisible();
  await expect(page.getByRole('button', { name: /Cat, use arrow keys/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Projects' })).toBeVisible();
  await page.screenshot({ path: 'docs/playable-portfolio/screenshots/desktop.png' });

  await page.locator('.play-canvas').click({ position: { x: 740, y: 430 } });
  const input = page.getByRole('textbox', { name: 'Name an object' });
  await input.fill('kitty');
  const submitted = Date.now();
  await input.press('Enter');
  await expect(page.getByRole('button', { name: /Cat, use arrow keys/ }).last()).toBeVisible();
  const spawnMs = Date.now() - submitted;

  const cat = page.getByRole('button', { name: /Cat, use arrow keys/ }).last();
  const box = await cat.boundingBox();
  const trash = await page.locator('.canvas-trash').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(trash.x + trash.width / 2, trash.y + trash.height / 2, { steps: 8 });
  await expect(page.locator('.canvas-trash')).toHaveClass(/canvas-trash--active/);
  await page.mouse.up();
  await expect(page.locator('.play-object')).toHaveCount(1);

  const projectButton = page.getByRole('button', { name: 'Projects' }).first();
  await projectButton.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Privacy Preserving Visualization Tool')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(projectButton).toBeFocused();
  expect(errors).toEqual([]);
  return spawnMs;
});

test('unknown word is preserved, drawing uses explicit manual choice, mobile fits, and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const starterSprite = page.locator('.play-object img');
  await expect.poll(() => starterSprite.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  const svgPage = await page.context().newPage();
  await svgPage.emulateMedia({ reducedMotion: 'reduce' });
  await svgPage.goto('/objects/cat.svg');
  const catAnimation = await svgPage.locator('.tail').first().evaluate(tail => getComputedStyle(tail).animationName);
  expect(catAnimation).toBe('none');
  await svgPage.close();
  await page.locator('.play-canvas').click({ position: { x: 240, y: 390 } });
  const input = page.getByRole('textbox', { name: 'Name an object' });
  await input.fill('spaceship');
  await input.press('Enter');
  await expect(input).toHaveValue('spaceship');
  await expect(page.getByText(/No matching object/)).toBeVisible();
  await input.press('Escape');
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  const board = page.locator('.draw-board');
  const rect = await board.boundingBox();
  await page.mouse.move(rect.x + 140, rect.y + 350);
  await page.mouse.down();
  await page.mouse.move(rect.x + 160, rect.y + 365, { steps: 3 });
  await page.mouse.up();
  await expect(page.locator('.draw-stroke')).toHaveCount(1);
  const toolbarBounds = await page.locator('.draw-toolbar').boundingBox();
  expect(toolbarBounds.height).toBeLessThanOrEqual(60);
  await page.getByRole('button', { name: 'Choose object' }).click();
  const picker = page.getByRole('group', { name: 'What did you draw?' });
  await expect(picker).toBeVisible();
  await expect(picker.locator('.drawing-picker__objects button')).toHaveCount(12);
  await expect(picker.locator('.drawing-picker__objects button')).toHaveText([
    'Cat', 'Dog', 'Rabbit', 'Bird', 'Fish', 'Butterfly', 'Tree', 'Flower', 'Mushroom', 'Cactus', 'Sun', 'Moon',
  ]);
  await expect(page.getByText(/No matching/)).toHaveCount(0);
  await expect(page.locator('.draw-toolbar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Type', exact: true })).toBeVisible();
  const pickerBounds = await picker.boundingBox();
  const dockBounds = await page.locator('.portfolio-dock').boundingBox();
  expect(pickerBounds.y + pickerBounds.height).toBeLessThan(dockBounds.y);
  await page.screenshot({ path: 'docs/playable-portfolio/screenshots/mobile.png' });
  await picker.getByRole('button', { name: 'Fish' }).click();
  const fish = page.getByRole('button', { name: /Fish, use arrow keys/ });
  await expect(fish).toBeVisible();
  await expect.poll(() => fish.locator('img').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  const fishBox = await fish.boundingBox();
  expect(Math.abs(fishBox.x + fishBox.width / 2 - 150)).toBeLessThan(15);
  await fish.click();
  await expect(fish).toHaveClass(/play-object--selected/);
  await fish.focus();
  await page.keyboard.press('Delete');
  await expect(fish).toHaveCount(0);

  await page.getByRole('button', { name: 'Type', exact: true }).click();
  await page.locator('.play-canvas').click({ position: { x: 70, y: 550 } });
  const dogInput = page.getByRole('textbox', { name: 'Name an object' });
  await dogInput.fill('dog');
  await dogInput.press('Enter');
  const dog = page.getByRole('button', { name: /Dog, use arrow keys/ });
  await expect(dog).toBeVisible();
  await dog.focus();
  const beforeMove = await dog.boundingBox();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await dog.boundingBox()).x).toBe(beforeMove.x - 8);
  await dog.press('Delete');
  await expect(dog).toHaveCount(0);

  const starter = page.getByRole('button', { name: /Cat, use arrow keys/ });
  await expect(starter).toHaveCount(1);
  await starter.focus();
  await starter.press('Delete');
  await expect(starter).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.play-object')).toHaveCount(0);
  const sizes = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(sizes.width).toBe(sizes.viewport);
});

test('captures warmed typed-to-visible latency across eight spawns', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.evaluate(() => {
    window.spawnLatencySamples = [];
    let before = 0;
    document.addEventListener('keydown', event => {
      if (event.target.matches('#play-word') && event.key === 'Enter') {
        before = performance.now();
        const initialCount = document.querySelectorAll('.play-object').length;
        const observer = new MutationObserver(() => {
          if (document.querySelectorAll('.play-object').length > initialCount) {
            observer.disconnect();
            requestAnimationFrame(() => requestAnimationFrame(() => window.spawnLatencySamples.push(performance.now() - before)));
          }
        });
        observer.observe(document.querySelector('.play-object-layer'), { childList: true });
      }
    }, true);
  });
  const points = [[180,450],[310,450],[440,450],[570,450],[700,450],[830,450],[960,450],[1090,450]];
  for (let index = 0; index < points.length; index += 1) {
    await page.locator('.play-canvas').click({ position: { x: points[index][0], y: points[index][1] } });
    const input = page.getByRole('textbox', { name: 'Name an object' });
    await input.fill(index % 2 ? 'kitty' : 'cat');
    await input.press('Enter');
    await expect(page.locator('.play-object')).toHaveCount(index + 2);
  }
  await expect.poll(() => page.evaluate(() => window.spawnLatencySamples.length)).toBe(8);
  const samples = await page.evaluate(() => window.spawnLatencySamples);
  const sorted = [...samples].sort((a, b) => a - b);
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
  console.log(`Warm typed-to-visible spawn: n=${samples.length}, p95=${p95.toFixed(1)} ms, Chromium desktop`);
  expect(samples).toHaveLength(8);
});

test('pointer cancellation restores placement, outside release clamps, and Delete is accessible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('.play-canvas').click({ position: { x: 720, y: 420 } });
  const input = page.getByRole('textbox', { name: 'Name an object' });
  await input.fill('dog');
  await input.press('Enter');
  const dog = page.getByRole('button', { name: /Dog, use arrow keys/ });
  const initial = await dog.boundingBox();
  await page.mouse.move(initial.x + 40, initial.y + 40);
  await page.mouse.down();
  await page.mouse.move(initial.x + 180, initial.y + 100, { steps: 3 });
  await dog.evaluate(button => button.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 })));
  await expect.poll(async () => (await dog.boundingBox()).x).toBeCloseTo(initial.x, 0);

  await page.mouse.move(initial.x + 40, initial.y + 40);
  await page.mouse.down();
  await page.mouse.move(1600, 420, { steps: 4 });
  await page.mouse.up();
  const released = await dog.boundingBox();
  expect(released.x).toBeCloseTo(1320, 0);
  await dog.press('Delete');
  await expect(page.locator('.play-object')).toHaveCount(1);
});
