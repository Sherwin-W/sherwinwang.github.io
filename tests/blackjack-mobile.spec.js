import { test, expect } from '@playwright/test';

/** The sizes from the brief: phones in portrait and landscape, a small phone, and a desktop. */
const SIZES = [
  { name: '390x844', width: 390, height: 844, mobile: true },
  { name: '844x390', width: 844, height: 390, mobile: true },
  { name: '375x667', width: 375, height: 667, mobile: true },
  { name: '667x375', width: 667, height: 375, mobile: true },
  { name: '320x568', width: 320, height: 568, mobile: true },
  { name: '1366x900', width: 1366, height: 900, mobile: false },
];

/**
 * Every visible text leaf, control and card must sit inside the viewport horizontally and must not be
 * clipped by its own box. Content inside an intentional local scroller (the strategy chart) is exempt.
 */
async function clipped(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const bad = [];
    const inScroller = (el) => !!el.closest('.bj-chart__scroll');
    const visible = (el) => {
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !el.closest('[hidden], [aria-hidden="true"] .px-coin');
    };
    const els = [...document.querySelectorAll('button, a, label, h1, h2, h3, p, dt, dd, th, td, li, .px-card, .px-num, kbd, .px-combo__label, input, select')];
    for (const el of els) {
      if (!visible(el) || inScroller(el) || el.closest('.px-coins') || el.closest('.visually-hidden')) continue;
      const r = el.getBoundingClientRect();
      const name = `${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).split(' ')[0]} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40)}"`;
      if (r.left < -1 || r.right > vw + 1) bad.push(`outside: ${name} [${Math.round(r.left)}, ${Math.round(r.right)}] vw=${vw}`);
      const cs = getComputedStyle(el);
      if (['hidden', 'clip'].includes(cs.overflowX) && el.scrollWidth > el.clientWidth + 2) bad.push(`clipped: ${name}`);
    }
    if (document.documentElement.scrollWidth > vw + 1) bad.push(`page scrolls sideways: ${document.documentElement.scrollWidth} > ${vw}`);
    return bad;
  });
}

/** Two boxes overlap (with a 1px tolerance). */
const overlaps = (a, b) => a && b && a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;

for (const size of SIZES) {
  test.describe(`blackjack at ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: size.mobile, isMobile: size.mobile });

    test('every screen fits: briefing, manual, training, run HUD, dealer dialog, checkpoint, long hands', async ({ page }) => {
      test.setTimeout(120_000);
      const shot = (n) => page.screenshot({ path: test.info().outputPath(`${size.name}-${n}.png`), fullPage: true });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('/blackjack/?seed=57');
      await page.getByRole('radio', { name: /Operator/ }).click();
      expect(await clipped(page)).toEqual([]);
      await shot('briefing');

      await page.getByRole('tab', { name: 'Manual' }).click();
      expect(await clipped(page)).toEqual([]);
      await shot('manual');
      await page.getByRole('tab', { name: 'Training' }).click();
      expect(await clipped(page)).toEqual([]);
      await page.getByRole('button', { name: 'Hi-Lo counting' }).click();
      expect(await clipped(page)).toEqual([]);
      await page.getByRole('tab', { name: 'Campaign' }).click();
      await page.getByRole('button', { name: 'Table rules', exact: true }).click();
      expect(await clipped(page)).toEqual([]);
      await page.getByRole('button', { name: 'Table rules', exact: true }).click();

      await page.getByRole('button', { name: /Deploy/ }).click();
      await page.getByRole('radio', { name: '1', exact: true }).click();
      await page.getByRole('button', { name: /^Deal/ }).click();
      // Seed 57 opens with A,2 vs 8: hit until the hand ends to get a long hand on screen (Codex finding 10).
      for (let i = 0; i < 5 && await page.getByRole('button', { name: /^Hit/ }).isEnabled().catch(() => false); i++) await page.keyboard.press('h');
      await page.waitForTimeout(700);
      expect(await clipped(page)).toEqual([]);
      await shot('run');

      // Ask the Dealer dialog with the full chart.
      if (await page.getByRole('button', { name: /^Stand/ }).count() === 0 && await page.getByRole('button', { name: /Next round/ }).count()) {
        await page.getByRole('button', { name: /Next round/ }).click();
        if (await page.locator('#px-cp').count()) { await page.locator('#px-cp').fill('0'); await page.keyboard.press('Enter'); }
        if (await page.getByRole('button', { name: /^Deal/ }).count()) await page.getByRole('button', { name: /^Deal/ }).click();
      }
      await page.getByRole('button', { name: /Ask the dealer/ }).click();
      const dlg = page.getByRole('dialog', { name: 'Ask the dealer' });
      await expect(dlg).toBeVisible();
      if (await dlg.getByRole('button', { name: /Tell me/ }).count()) await dlg.getByRole('button', { name: /Tell me/ }).click();
      await dlg.getByRole('button', { name: /full strategy chart/ }).click();
      const box = await dlg.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      expect(await clipped(page)).toEqual([]);
      await shot('dealer');
      await page.keyboard.press('Escape');
      expect(errors).toEqual([]);
    });

    test('combo row: MULTIPLIER, number, fire on one line, clear of the flow bar', async ({ page }) => {
      await page.goto('/blackjack/?seed=7');
      await page.getByRole('button', { name: /Deploy/ }).click();
      // Force an unlocked combo deterministically through the real UI: play correct decisions.
      const { decide } = await import('../src/blackjack/engine/strategy.ts');
      const { DEFAULT_RULES } = await import('../src/blackjack/engine/rules.ts');
      const RANK = { Ace: 'A', Two: '2', Three: '3', Four: '4', Five: '5', Six: '6', Seven: '7', Eight: '8', Nine: '9', Ten: '10', Jack: 'J', Queen: 'Q', King: 'K' };
      const SUIT = { spades: 'S', hearts: 'H', diamonds: 'D', clubs: 'C' };
      const toCard = (l) => { const [r, , s] = l.split(/[ ,]/); return { rank: RANK[r], suit: SUIT[s] }; };
      const flow = async () => Number(await page.getByRole('meter', { name: 'Flow' }).getAttribute('aria-valuenow'));
      const count = async () => Number(await page.locator('.px-combo').getAttribute('data-count'));
      for (let i = 0; i < 400 && (await count()) < 4; i++) {
        for (const name of [/^Deal/, /Next round/]) { const b = page.getByRole('button', { name }); if (await b.count()) { await b.click(); break; } }
        if (await page.getByRole('button', { name: /No insurance/ }).count()) { await page.keyboard.press('n'); continue; }
        const bar = page.locator('.px-actions[aria-label^="Your decision"]');
        if (!(await bar.count())) continue;
        const up = toCard(await page.locator('.px-side--dealer svg[role="img"]').first().getAttribute('aria-label'));
        const cards = await page.locator('.px-seat.is-active svg[role="img"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
        const legal = await bar.locator('button:not(:disabled)').evaluateAll((els) => els.map((e) => e.textContent.trim().split(' ')[0].toLowerCase()));
        const d = decide(cards.map(toCard), up, DEFAULT_RULES, { canDouble: legal.includes('double'), canSplit: legal.includes('split'), canSurrender: legal.includes('surrender') });
        await page.keyboard.press({ hit: 'h', stand: 's', double: 'd', split: 'p', surrender: 'r' }[d.action]);
      }
      expect(await flow()).toBeGreaterThanOrEqual(50);
      await page.waitForTimeout(400);
      const label = await page.locator('.px-combo__label').boundingBox();
      const num = await page.locator('.px-combo__num').boundingBox();
      const fire = await page.locator('.px-combo__firebox').boundingBox();
      const bar = await page.locator('.px-flowbar__track').boundingBox();
      // Order: label, then number, then fire, left to right with steady gaps.
      expect(label.x + label.width).toBeLessThanOrEqual(num.x + 1);
      expect(num.x + num.width).toBeLessThanOrEqual(fire.x + 1);
      const gapA = num.x - (label.x + label.width), gapB = fire.x - (num.x + num.width);
      expect(Math.abs(gapA - gapB)).toBeLessThanOrEqual(2);
      // Vertically centered on one line.
      const mid = (b) => b.y + b.height / 2;
      expect(Math.abs(mid(label) - mid(num))).toBeLessThanOrEqual(2);
      expect(Math.abs(mid(num) - mid(fire))).toBeLessThanOrEqual(2);
      // The number is drawn with the bitmap digit font and labelled for assistive tech.
      await expect(page.locator('.px-combo__num')).toHaveAttribute('aria-label', /multiplier \d+ times/);
      expect(num.height).toBeGreaterThanOrEqual(24);
      // Not on top of the flow bar.
      expect(overlaps(num, bar) || overlaps(fire, bar) || overlaps(label, bar)).toBe(false);
      expect(await clipped(page)).toEqual([]);
      await page.locator('.px-combo').screenshot({ path: test.info().outputPath(`${size.name}-combo.png`) });
    });
  });
}

test.describe('phone touch targets', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('game controls are at least 44px tall', async ({ page }) => {
    await page.goto('/blackjack/?seed=57');
    await page.getByRole('radio', { name: /Operator/ }).click();
    await page.getByRole('button', { name: /Deploy/ }).click();
    await page.getByRole('radio', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: /^Deal/ }).click();
    const small = await page.evaluate(() => [...document.querySelectorAll('.px-run button, .px-run a, .px-run input')]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && !el.closest('.px-coins') && !el.closest('.px-tiny') && !el.classList.contains('px-link'); })
      .map((el) => ({ t: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30), h: Math.round(el.getBoundingClientRect().height) }))
      .filter((x) => x.h < 44));
    expect(small).toEqual([]);
  });
});
