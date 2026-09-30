import { test, expect } from '@playwright/test';

const drawStrokes = async (page, strokes) => {
  const board = page.locator('.draw-board');
  const rect = await board.boundingBox();
  for (const points of strokes) {
    const first = points[0];
    await page.mouse.move(rect.x + first[0], rect.y + first[1]);
    await page.mouse.down();
    for (const point of points.slice(1)) await page.mouse.move(rect.x + point[0], rect.y + point[1], { steps: 1 });
    await page.mouse.up();
  }
};

const circle = (cx, cy, radius, count = 28) => Array.from({ length: count + 1 }, (_, index) => {
  const angle = (Math.PI * 2 * index) / count;
  return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
});

const awaitSuggestions = async (page) => {
  const panel = page.locator('.recognition-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('group', { name: 'Ranked drawing suggestions' })).toBeVisible({ timeout: 15000 });
  await expect(panel.locator('.recognition-suggestions button')).toHaveCount(3);
  return panel;
};

test('browser-drawn supported, unsupported and scribbled examples use the local recognizer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const modelRequests = [];
  page.on('request', request => { if (request.url().includes('/models/drawing-recognizer/')) modelRequests.push(request.url()); });
  await page.goto('/');

  await page.locator('.play-canvas').click({ position: { x: 60, y: 250 } });
  const input = page.getByRole('textbox', { name: 'Name an object' });
  await input.fill('cat');
  await input.press('Enter');
  await expect(page.locator('.play-object')).toHaveCount(2);
  expect(modelRequests).toEqual([]); // typing never initializes or downloads the recognizer
  const typedCat = page.getByRole('button', { name: /Cat, use arrow keys/ }).last();
  await typedCat.focus();
  await typedCat.press('Delete');
  await expect(page.locator('.play-object')).toHaveCount(1);

  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  await page.getByRole('button', { name: 'Recognize', exact: true }).click();
  await expect(page.locator('.recognition-panel')).toContainText('no visible strokes');
  await page.locator('.recognition-panel').getByRole('button', { name: 'Clear and redraw' }).click();

  // Independently authored sun doodle: a circle with radial rays, drawn through real pointer events.
  const sunRays = [];
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
    sunRays.push([[180 + Math.cos(angle) * 48, 330 + Math.sin(angle) * 48], [180 + Math.cos(angle) * 62, 330 + Math.sin(angle) * 62]]);
  }
  await drawStrokes(page, [circle(180, 330, 34), ...sunRays]);
  await page.getByRole('button', { name: 'Recognize', exact: true }).click();
  const sunPanel = await awaitSuggestions(page);
  const sunRankings = await sunPanel.locator('.recognition-suggestions').innerText();
  console.log(`Independent browser sun: ${sunRankings.replaceAll('\n', '; ')}`);
  const coldMetrics = await sunPanel.evaluate(element => ({
    totalInitializationAndInferenceMs: Number(element.dataset.coldStartMs),
    inferenceMs: Number(element.dataset.inferenceMs),
    modelBytes: Number(element.dataset.modelBytes),
  }));
  console.log(`Recognition cold metrics: ${JSON.stringify(coldMetrics)}`);
  expect(coldMetrics.modelBytes).toBe(306484);
  await page.screenshot({ path: 'docs/playable-portfolio/screenshots/recognition-mobile.png' });
  await sunPanel.locator('.recognition-suggestions button').first().click();
  await expect(page.locator('.play-object')).toHaveCount(2);

  // Unsupported house example tests the explicit Other/rejection path and nearest supported choices.
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  await drawStrokes(page, [
    [[85, 270], [180, 190], [275, 270], [85, 270]],
    [[105, 270], [105, 390], [255, 390], [255, 270]],
    [[160, 390], [160, 320], [190, 320], [190, 390]],
  ]);
  await page.getByRole('button', { name: 'Recognize', exact: true }).click();
  const housePanel = await awaitSuggestions(page);
  const houseState = await housePanel.innerText();
  console.log(`Independent browser house: ${houseState.replaceAll('\n', '; ')}`);
  const warmInferenceMs = Number(await housePanel.getAttribute('data-inference-ms'));
  console.log(`Recognition warm inference: ${warmInferenceMs.toFixed(3)} ms`);
  await expect(housePanel.getByRole('button', { name: /Choose object/ })).toBeVisible();
  await housePanel.getByRole('button', { name: 'Clear and redraw' }).click();

  // A deliberately unsupported scribble must still produce ranked suggestions and manual fallback.
  const scribble = [[80, 200], [270, 370], [100, 370], [250, 205], [120, 280], [260, 305], [90, 240]];
  await drawStrokes(page, [scribble]);
  await page.getByRole('button', { name: 'Recognize', exact: true }).click();
  const scribblePanel = await awaitSuggestions(page);
  console.log(`Independent browser scribble: ${ (await scribblePanel.locator('.recognition-suggestions').innerText()).replaceAll('\n', '; ')}`);
  await expect(scribblePanel.getByRole('status')).toContainText('may be outside the supported set');
  await expect(scribblePanel.getByRole('button', { name: 'Choose object' })).toBeVisible();
  expect(modelRequests.some(url => url.endsWith('/manifest.json'))).toBe(true);
  expect(modelRequests.some(url => url.endsWith('/weights.f32'))).toBe(true);
});

test('cancel, clear, and a new stroke invalidate stale work; model failure keeps manual choice', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  let weightRequests = 0;
  await page.route('**/models/drawing-recognizer/weights.f32', async route => {
    weightRequests += 1;
    if (weightRequests === 1) await new Promise(resolve => setTimeout(resolve, 1800));
    await route.continue();
  });
  await drawStrokes(page, [[[80, 200], [160, 240], [250, 300]]]);
  await page.getByRole('button', { name: 'Recognize', exact: true }).click();
  let panel = page.locator('.recognition-panel');
  await expect(panel).toContainText('Loading the local recognizer');
  await panel.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('.recognition-panel')).toHaveCount(0);

  // A second result is pending; a fresh stroke invalidates it and returns the toolbar.
  await drawStrokes(page, [[[110, 250], [180, 250], [180, 320]]]);
  await page.getByRole('button', { name: 'Recognize', exact: true }).click();
  panel = page.locator('.recognition-panel');
  await expect(panel).toContainText('Loading the local recognizer');
  await drawStrokes(page, [[[120, 215], [210, 225], [250, 330]]]);
  await expect(page.locator('.recognition-panel')).toHaveCount(0);

  // Clear a third in-flight request, start a distinct drawing, and accept only its result.
  await page.getByRole('button', { name: 'Recognize', exact: true }).click();
  panel = page.locator('.recognition-panel');
  await expect(panel).toContainText('Loading the local recognizer');
  await panel.getByRole('button', { name: 'Clear and redraw' }).click();
  await expect(page.locator('.recognition-panel')).toHaveCount(0);
  await drawStrokes(page, [[[90, 220], [180, 330], [270, 220], [180, 270]]]);
  await page.getByRole('button', { name: 'Recognize', exact: true }).click();
  panel = await awaitSuggestions(page);
  await expect(panel).toContainText(/Best guess|outside the supported set/);
  await expect(page.locator('.recognition-panel')).toHaveCount(1);

  await page.unroute('**/models/drawing-recognizer/weights.f32');
  await page.route('**/models/drawing-recognizer/weights.f32', route => route.fulfill({ status: 503, body: 'offline fixture' }));
  await page.reload();
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  await drawStrokes(page, [[[90, 220], [210, 330], [280, 260]]]);
  await page.getByRole('button', { name: 'Recognize', exact: true }).click();
  panel = page.locator('.recognition-panel');
  await expect(panel.getByRole('alert')).toContainText('Automatic recognition is unavailable');
  await panel.getByRole('button', { name: 'Choose object' }).click();
  const picker = page.getByRole('group', { name: 'What did you draw?' });
  await expect(picker.locator('.drawing-picker__objects button')).toHaveCount(12);
});
