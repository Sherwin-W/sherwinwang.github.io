import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.beforeAll(() => fs.mkdirSync('docs/playable-portfolio/screenshots', { recursive: true }));

test('starts in Select mode, offers the accessible catalog, supports dragging and portfolio access', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: "Hello, I'm Sherwin" })).toBeVisible();
  await expect(page.getByRole('button', { name: /Cat, use arrow keys/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Brush', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: /Cat, use arrow keys/ })).toHaveCSS('cursor', 'grab');
  await expect(page.getByRole('button', { name: 'Objects' })).toHaveCSS('cursor', 'pointer');
  await expect(page.getByRole('button', { name: 'Projects' })).toBeVisible();
  await page.locator('.play-canvas').click({ position: { x: 740, y: 430 } });
  await expect(page.locator('.play-object')).toHaveCount(1);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await page.screenshot({ path: 'docs/playable-portfolio/screenshots/desktop.png' });

  await page.getByRole('button', { name: 'Objects', exact: true }).click();
  const picker = page.getByRole('group', { name: 'Choose an object' });
  await expect(picker).toBeVisible();
  await expect(picker.locator('.drawing-picker__objects button')).toHaveCount(24);
  await picker.getByRole('button', { name: 'Dog' }).click();
  await expect(page.locator('.play-object')).toHaveCount(2);
  const dog = page.getByRole('button', { name: /Dog, use arrow keys/ });
  const box = await dog.boundingBox();
  const trash = await page.locator('.canvas-trash').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(trash.x + trash.width / 2, trash.y + trash.height / 2, { steps: 8 });
  await expect(page.locator('.canvas-trash')).toHaveClass(/canvas-trash--active/);
  await page.mouse.up();
  await expect(dog).toHaveCount(0);

  const projectButton = page.getByRole('button', { name: 'Projects' }).first();
  await projectButton.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Privacy Preserving Visualization Tool')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(projectButton).toBeFocused();
  expect(errors).toEqual([]);
});

test('mobile Brush draws with glow, manual picker replaces a sketch, and reduced motion is respected', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const modelRequests = [];
  page.on('request', request => { if (request.url().includes('/models/drawing-recognizer-24-candidate/')) modelRequests.push(request.url()); });
  await page.goto('/');
  const starterSprite = page.locator('.play-object img');
  await expect.poll(() => starterSprite.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  const svgPage = await page.context().newPage();
  await svgPage.emulateMedia({ reducedMotion: 'reduce' });
  await svgPage.goto('/objects/cat.svg');
  const catAnimation = await svgPage.locator('.tail').first().evaluate(tail => getComputedStyle(tail).animationName);
  expect(catAnimation).toBe('none');
  await svgPage.close();

  await page.getByRole('button', { name: 'Brush', exact: true }).click();
  const board = page.locator('.draw-board');
  expect(await board.evaluate(element => getComputedStyle(element).cursor)).toContain('2 28');
  const rect = await board.boundingBox();
  await page.mouse.move(rect.x + 140, rect.y + 350);
  await page.mouse.down();
  await page.mouse.move(rect.x + 160, rect.y + 365, { steps: 3 });
  await page.mouse.up();
  await expect(page.locator('.draw-stroke-core')).toHaveCount(1);
  await expect(page.locator('.draw-stroke-glow')).toHaveCount(1);
  const toolbarBounds = await page.locator('.draw-toolbar').boundingBox();
  expect(toolbarBounds.height).toBeLessThanOrEqual(60);
  expect(modelRequests).toEqual([]);
  await page.getByRole('button', { name: 'Choose object' }).click();
  const picker = page.getByRole('group', { name: 'Choose an object' });
  await expect(picker).toBeVisible();
  await expect(picker.locator('.drawing-picker__objects button')).toHaveText([
    'Cat', 'Dog', 'Rabbit', 'Bird', 'Fish', 'Butterfly', 'Tree', 'Flower', 'Mushroom', 'Cactus', 'Sun', 'Moon',
    'Cow', 'Duck', 'Elephant', 'Frog', 'Leaf', 'Potted plant', 'Apple', 'Banana', 'Pizza', 'Chair', 'Airplane', 'Bicycle',
  ]);
  await expect(page.locator('.draw-toolbar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Type', exact: true })).toHaveCount(0);
  const pickerBounds = await picker.boundingBox();
  const dockBounds = await page.locator('.portfolio-dock').boundingBox();
  expect(pickerBounds.y + pickerBounds.height).toBeLessThan(dockBounds.y);
  await page.screenshot({ path: 'docs/playable-portfolio/screenshots/mobile.png' });
  await picker.getByRole('button', { name: 'Bicycle' }).click();
  await expect(page.locator('.play-object img[src$="/bicycle.svg"]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Undo transformation/ })).toBeVisible();
  await page.getByRole('button', { name: 'Undo transformation' }).last().click();
  await expect(page.locator('.play-object img[src$="/bicycle.svg"]')).toHaveCount(0);
  await expect(page.locator('.draw-stroke-core')).toHaveCount(1);
  await expect(page.getByRole('status')).toContainText('will not be checked again');
});

test('touch pointer input draws without depending on the custom cursor', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/');
  const brush = await page.getByRole('button', { name: 'Brush', exact: true }).boundingBox();
  await page.touchscreen.tap(brush.x + brush.width / 2, brush.y + brush.height / 2);
  const board = await page.locator('.draw-board').boundingBox();
  const cdp = await context.newCDPSession(page);
  const x = Math.round(board.x + 120);
  const y = Math.round(board.y + 320);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1, radiusX: 2, radiusY: 2, force: 0.7 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 20, y: y + 18, id: 1, radiusX: 2, radiusY: 2, force: 0.7 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.draw-stroke-core')).toHaveCount(1);
  await context.close();
});

test('pointer cancellation restores placement, outside release clamps, and Delete is accessible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Objects', exact: true }).click();
  await page.getByRole('group', { name: 'Choose an object' }).getByRole('button', { name: 'Dog' }).click();
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
  await expect(dog).toHaveCount(0);
});
