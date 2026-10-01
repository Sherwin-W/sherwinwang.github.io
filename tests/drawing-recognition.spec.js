import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const drawStrokes = async (page, strokes) => {
  const rect = await page.locator('.draw-board').boundingBox();
  for (const points of strokes) {
    const [first, ...rest] = points;
    await page.mouse.move(rect.x + first[0], rect.y + first[1]);
    await page.mouse.down();
    for (const point of rest) await page.mouse.move(rect.x + point[0], rect.y + point[1], { steps: 1 });
    await page.mouse.up();
  }
};

const circle = (cx, cy, radius, count = 28) => Array.from({ length: count + 1 }, (_, index) => {
  const angle = (Math.PI * 2 * index) / count;
  return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
});

const sun = () => {
  const rays = [];
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
    rays.push([[180 + Math.cos(angle) * 48, 330 + Math.sin(angle) * 48], [180 + Math.cos(angle) * 62, 330 + Math.sin(angle) * 62]]);
  }
  return [circle(180, 330, 34), ...rays];
};

const waitForRecognition = async (page) => {
  const panel = page.locator('.recognition-panel');
  await expect(panel).toBeVisible({ timeout: 10000 });
  await expect(panel.getByRole('status').or(panel.getByRole('alert'))).toBeVisible();
  return panel;
};

test('a multi-stroke pause restarts 1,500 ms debounce; accepted sun transforms and can be undone safely', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const modelRequests = [];
  page.on('request', request => { if (request.url().includes('/models/drawing-recognizer-24-candidate/')) modelRequests.push(request.url()); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Brush', exact: true }).click();
  await page.locator('.draw-board').evaluate(board => board.addEventListener('pointerup', () => performance.mark('last-stroke-pointerup'), { capture: true }));
  const sunStrokes = sun();
  await drawStrokes(page, [sunStrokes[0]]);
  await page.waitForTimeout(900);
  await drawStrokes(page, sunStrokes.slice(1));
  await page.waitForTimeout(800);
  expect(modelRequests).toEqual([]); // The second stroke reset the full pause interval.
  await expect(page.locator('.recognition-panel')).toHaveCount(0);
  const panel = await waitForRecognition(page);
  await expect(panel.getByRole('status')).toContainText('Sun added at the center');
  await expect(panel.locator('.recognition-suggestions')).toHaveCount(0);
  await expect(page.locator('.play-object img[src$="/sun.svg"]')).toHaveCount(1);
  const automaticTiming = await page.evaluate(() => Number((performance.now() - performance.getEntriesByName('last-stroke-pointerup').at(-1).startTime).toFixed(1)));
  const workerTiming = await panel.evaluate(element => ({ requestToResultMs: Number(element.dataset.workerRoundtripMs), inferenceMs: Number(element.dataset.inferenceMs), modelBytes: Number(element.dataset.modelBytes) }));
  console.log(`Automatic sketch-to-object timing: ${JSON.stringify({ pointerUpToSpawnVisibleMs: automaticTiming, worker: workerTiming, debounceMs: 1500 })}`);
  await page.screenshot({ path: 'docs/playable-portfolio/screenshots/recognition-auto-mobile.png' });
  await expect(page.locator('.draw-stroke-group--transforming')).toHaveCount(9);
  await expect(page.locator('.draw-stroke-core')).toHaveCount(9);
  await page.waitForTimeout(500);
  await expect(page.locator('.draw-stroke-core')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Undo transformation' }).click();
  await expect(page.locator('.play-object img[src$="/sun.svg"]')).toHaveCount(0);
  await expect(page.locator('.draw-stroke-core')).toHaveCount(9);
  await expect(panel.getByRole('status')).toContainText('will not be checked again');
  const requestsAfterUndo = modelRequests.length;
  await page.waitForTimeout(1650);
  expect(modelRequests).toHaveLength(requestsAfterUndo);
  await panel.getByRole('button', { name: 'Retry recognition' }).click();
  await expect(page.locator('.play-object img[src$="/sun.svg"]')).toHaveCount(1);
});

test('a slow uninterrupted pointer gesture is never recognized until pointer-up', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const modelRequests = [];
  page.on('request', request => { if (request.url().includes('/models/drawing-recognizer-24-candidate/')) modelRequests.push(request.url()); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Brush', exact: true }).click();
  const board = page.locator('.draw-board');
  const rect = await board.boundingBox();
  await page.mouse.move(rect.x + 100, rect.y + 300);
  await page.mouse.down();
  for (let index = 0; index < 5; index += 1) {
    await page.mouse.move(rect.x + 110 + index * 20, rect.y + 310 + index * 15);
    await page.waitForTimeout(350);
  }
  expect(modelRequests).toEqual([]);
  await expect(page.locator('.recognition-panel')).toHaveCount(0);
  await page.mouse.up();
  await waitForRecognition(page);
  expect(modelRequests.some(url => url.endsWith('/manifest.json'))).toBe(true);
});

test('uncertain and unsupported drawings stay visible and provide three suggestions plus the manual picker', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Brush', exact: true }).click();
  const house = [
    [[85, 270], [180, 190], [275, 270], [85, 270]],
    [[105, 270], [105, 390], [255, 390], [255, 270]],
    [[160, 390], [160, 320], [190, 320], [190, 390]],
  ];
  await drawStrokes(page, house);
  const panel = await waitForRecognition(page);
  await expect(panel.getByRole('status')).toContainText('outside the supported set');
  await expect(panel.getByRole('group', { name: 'Ranked drawing suggestions' }).locator('button')).toHaveCount(3);
  await expect(page.locator('.draw-stroke-core')).toHaveCount(3);
  await expect(page.locator('.play-object')).toHaveCount(1);
  await panel.getByRole('button', { name: 'Choose object' }).click();
  const picker = page.getByRole('group', { name: 'Choose an object' });
  await expect(picker.locator('.drawing-picker__objects button')).toHaveCount(24);
  await picker.getByRole('button', { name: 'Moon' }).click();
  await expect(page.locator('.play-object img[src$="/moon.svg"]')).toHaveCount(1);
});

test('new strokes, clear, mode changes, portfolio sheets and unmount cancel stale or scheduled creation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const modelRequests = [];
  page.on('request', request => { if (request.url().includes('/models/drawing-recognizer-24-candidate/')) modelRequests.push(request.url()); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Brush', exact: true }).click();
  await drawStrokes(page, [[[80, 250], [180, 300], [260, 350]]]);
  await page.waitForTimeout(900);
  await drawStrokes(page, [[[90, 370], [180, 400], [270, 370]]]);
  await page.waitForTimeout(900);
  expect(modelRequests).toEqual([]);
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.waitForTimeout(1600);
  expect(modelRequests).toEqual([]);

  await drawStrokes(page, [[[80, 250], [180, 300], [260, 350]]]);
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Undo stroke', exact: true }).click();
  await page.waitForTimeout(1600);
  expect(modelRequests).toEqual([]);

  await drawStrokes(page, [[[80, 250], [180, 300], [260, 350]]]);
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.waitForTimeout(1600);
  expect(modelRequests).toEqual([]);

  await page.getByRole('button', { name: 'Brush', exact: true }).click();
  await drawStrokes(page, [[[80, 250], [180, 300], [260, 350]]]);
  await page.getByRole('button', { name: 'About', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForTimeout(1600);
  expect(modelRequests).toEqual([]);
  await page.keyboard.press('Escape');

  await page.route('**/models/drawing-recognizer-24-candidate/weights.f32', async route => {
    await new Promise(resolve => setTimeout(resolve, 2200));
    await route.continue();
  });
  await page.getByRole('button', { name: 'Brush', exact: true }).click();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await drawStrokes(page, [circle(180, 330, 34)]);
  let pending = page.locator('.recognition-panel');
  await expect(pending).toContainText('Recognizing it on this device', { timeout: 5000 });
  await drawStrokes(page, sun().slice(1)); // New rays invalidate the result for the earlier circle-only sketch.
  await expect(page.locator('.recognition-panel')).toHaveCount(0);
  pending = await waitForRecognition(page);
  await expect(pending.getByRole('status')).toContainText('Sun added at the center', { timeout: 10000 });

  await page.getByRole('button', { name: 'Brush', exact: true }).click();
  await drawStrokes(page, [[[80, 250], [180, 300], [260, 350]]]);
  await page.reload(); // Unmount before the pause elapses.
  const requestCountAtUnmount = modelRequests.length;
  await page.waitForTimeout(1600);
  expect(modelRequests).toHaveLength(requestCountAtUnmount);
});

test('model-load failure preserves the sketch and accessible manual picker', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/models/drawing-recognizer-24-candidate/manifest.json', route => route.fulfill({ status: 503, body: 'offline fixture' }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Brush', exact: true }).click();
  await drawStrokes(page, [[[90, 220], [210, 330], [280, 260]]]);
  const panel = await waitForRecognition(page);
  await expect(panel.getByRole('alert')).toContainText('Automatic recognition is unavailable');
  await expect(page.locator('.draw-stroke-core')).toHaveCount(1);
  await panel.getByRole('button', { name: 'Choose object' }).click();
  await expect(page.getByRole('group', { name: 'Choose an object' }).locator('.drawing-picker__objects button')).toHaveCount(24);
});

test('new catalog drawings pass through browser rasterization and record suggestions honestly', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Brush', exact: true }).click();
  const manifest = await page.evaluate(async () => fetch('/models/drawing-recognizer-24-candidate/manifest.json').then(response => response.json()));
  const fixtures = JSON.parse(readFileSync('tests/fixtures/batch24-drawings.json', 'utf8'));
  const results = [];
  for (const drawing of fixtures.drawings) {
    const board = page.locator('.draw-board');
    const rect = await board.boundingBox();
    await board.evaluate(element => element.addEventListener('pointerup', () => performance.mark('batch24-last-up'), { once: false, capture: true }));
    for (const stroke of drawing.strokes) {
      const mapped = stroke.map(([x, y]) => [rect.x + rect.width * (0.15 + 0.7 * x / 100), rect.y + rect.height * (0.23 + 0.46 * y / 100)]);
      const [first, ...rest] = mapped;
      await page.mouse.move(...first);
      await page.mouse.down();
      for (const point of rest) await page.mouse.move(...point);
      await page.mouse.up();
    }
    const panel = await waitForRecognition(page);
    await expect(panel.getByRole('status').or(panel.getByRole('alert'))).toBeVisible();
    const result = await panel.evaluate(element => ({
      status: element.querySelector('[role="status"]')?.textContent || element.querySelector('[role="alert"]')?.textContent || '',
      rankedLabels: (element.dataset.rankedLabels || '').split(',').filter(Boolean),
      automatic: element.querySelector('legend')?.textContent === 'Sketch transformed',
      workerRoundtripMs: Number(element.dataset.workerRoundtripMs || 0),
      inferenceMs: Number(element.dataset.inferenceMs || 0),
      modelBytes: Number(element.dataset.modelBytes || 0),
    }));
    result.label = drawing.label;
    result.uiRankedLabels = result.rankedLabels.filter(label => label !== 'other');
    result.pointerUpToVisibleMs = await page.evaluate(() => {
      const mark = performance.getEntriesByName('batch24-last-up').at(-1);
      return Number((performance.now() - mark.startTime).toFixed(1));
    });
    results.push(result);

    const keep = panel.getByRole('button', { name: 'Keep object' });
    if (await keep.count()) await keep.click();
    const clear = page.getByRole('button', { name: 'Clear', exact: true });
    if (await clear.count()) await clear.click();
    await page.getByRole('button', { name: 'Brush', exact: true }).click();
  }
  const controls = [];
  const blankVector = await page.evaluate(() => new Promise((resolve, reject) => {
    const worker = new Worker(new URL('/src/playable/recognizer.worker.js', location.origin), { type: 'module' });
    const timeout = setTimeout(() => { worker.terminate(); reject(new Error('Blank-input worker timed out')); }, 10000);
    worker.onmessage = event => {
      if (event.data?.type !== 'result') return;
      clearTimeout(timeout);
      worker.terminate();
      resolve({ blank: event.data.blank === true, modelBytes: event.data.modelBytes });
    };
    worker.postMessage({ type: 'recognize', id: 991, pixels: new Float32Array(784) });
  }));
  controls.push({ input: 'zero-pixel blank raster via the actual worker', ...blankVector });
  const controlBoard = page.locator('.draw-board');
  let controlRect = await controlBoard.boundingBox();
  await drawStrokes(page, [[[controlRect.x + controlRect.width / 2, controlRect.y + controlRect.height / 2]]]);
  let controlPanel = await waitForRecognition(page);
  controls.push({ input: 'single-point blank', state: await controlPanel.locator('[role="status"]').textContent() });
  await page.getByRole('button', { name: 'Clear', exact: true }).click();

  controlRect = await controlBoard.boundingBox();
  const scribble = [
    [[10, 15], [90, 75], [12, 70], [88, 20], [15, 18], [85, 82]],
    [[48, 8], [52, 92]],
  ].map(stroke => stroke.map(([x, y]) => [controlRect.x + controlRect.width * (0.15 + 0.7 * x / 100), controlRect.y + controlRect.height * (0.23 + 0.46 * y / 100)]));
  await drawStrokes(page, scribble);
  controlPanel = await waitForRecognition(page);
  controls.push({ input: 'scribble', state: await controlPanel.locator('[role="status"]').textContent(), rankedLabels: (await controlPanel.getAttribute('data-ranked-labels') || '').split(',').filter(Boolean) });
  await page.getByRole('button', { name: 'Clear', exact: true }).click();

  const house = [
    [[20, 45], [50, 15], [80, 45], [20, 45]],
    [[27, 44], [27, 85], [73, 85], [73, 44]],
    [[44, 85], [44, 62], [56, 62], [56, 85]],
  ].map(stroke => stroke.map(([x, y]) => [controlRect.x + controlRect.width * (0.15 + 0.7 * x / 100), controlRect.y + controlRect.height * (0.23 + 0.46 * y / 100)]));
  await drawStrokes(page, house);
  controlPanel = await waitForRecognition(page);
  controls.push({ input: 'unsupported house', state: await controlPanel.locator('[role="status"]').textContent(), rankedLabels: (await controlPanel.getAttribute('data-ranked-labels') || '').split(',').filter(Boolean) });
  writeFileSync('docs/playable-portfolio/browser-fixture-results-24.json', `${JSON.stringify({
    modelSha256: manifest.sha256,
    viewport: '390x844 Chromium with local Vite server',
    fixtureDescription: fixtures.description,
    summary: {
      samples: results.length,
      uiFilteredTop1: results.filter(result => result.uiRankedLabels[0] === result.label).length,
      uiFilteredTop3: results.filter(result => result.uiRankedLabels.slice(0, 3).includes(result.label)).length,
      autoCreated: results.filter(result => result.automatic).length,
    },
    controls,
    results,
  }, null, 2)}\n`);
  console.log(`Batch-24 browser integration fixture results: ${JSON.stringify(results.map(({ label, rankedLabels, automatic }) => ({ label, top3: rankedLabels.slice(0, 3), automatic })))}`);
});
