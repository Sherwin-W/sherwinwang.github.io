import { test, expect } from '@playwright/test';

const active = [
  'cat', 'dog', 'rabbit', 'bird', 'fish', 'butterfly', 'tree', 'flower', 'mushroom', 'cactus', 'sun', 'moon',
  'cow', 'duck', 'elephant', 'frog', 'leaf', 'house-plant', 'apple', 'banana', 'pizza', 'chair', 'airplane', 'bicycle',
];
const roadmap = [
  'bear', 'bee', 'crab', 'dolphin', 'horse', 'lion', 'owl', 'penguin', 'grass', 'palm-tree', 'bush', 'rose',
  'bread', 'cake', 'carrot', 'cookie', 'donut', 'grapes', 'ice-cream', 'strawberry', 'bed', 'book', 'broom',
  'clock', 'floor-lamp', 'mug', 'toaster', 'vase', 'ambulance', 'bus', 'helicopter', 'motorbike', 'sailboat',
  'cloud', 'rainbow', 'star',
];

test('active art and roadmap-only art all render in one visual review sheet', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1600 });
  await page.goto('/');
  const errors = await page.evaluate(async ({ activeIds, roadmapIds }) => {
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:#f4efe4;color:#2b2a28;font:14px system-ui,sans-serif';
    const section = (title, ids, base) => {
      const group = document.createElement('section');
      group.style.cssText = 'padding:12px 20px';
      const heading = document.createElement('h2');
      heading.textContent = title;
      heading.style.cssText = 'margin:4px 0 10px;font:600 20px Georgia,serif';
      group.append(heading);
      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:4px 10px';
      ids.forEach(id => {
        const card = document.createElement('figure');
        card.style.cssText = 'margin:0;height:154px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid #d7cdbc;border-radius:10px;background:#fbf8f1';
        const image = document.createElement('img');
        image.src = `${base}/${id}.svg`;
        image.alt = '';
        image.style.cssText = 'width:124px;height:124px;object-fit:contain';
        const caption = document.createElement('figcaption');
        caption.textContent = id;
        caption.style.cssText = 'height:22px;font:600 12px system-ui,sans-serif';
        card.append(image, caption);
        grid.append(card);
      });
      group.append(grid);
      document.body.append(group);
    };
    section('Active 24 — current recognition set', activeIds, '/objects');
    section('Roadmap 36 — illustration-only, not recognized', roadmapIds, '/objects/roadmap');
    const images = [...document.images];
    await Promise.all(images.map(image => image.decode().catch(() => null)));
    return images.filter(image => !image.naturalWidth || !image.naturalHeight).map(image => image.src);
  }, { activeIds: active, roadmapIds: roadmap });
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'docs/playable-portfolio/screenshots/catalog-60-art-review.png', fullPage: true });
});
