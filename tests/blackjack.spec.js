import { test, expect } from '@playwright/test';
import { decide } from '../src/blackjack/engine/strategy.ts';
import { DEFAULT_RULES } from '../src/blackjack/engine/rules.ts';

const HILO = { Two: 1, Three: 1, Four: 1, Five: 1, Six: 1, Seven: 0, Eight: 0, Nine: 0, Ten: -1, Jack: -1, Queen: -1, King: -1, Ace: -1 };
/** Hi-Lo value of every face-up card currently drawn on the field, read from the cards' accessible names. */
async function fieldCount(page) {
  const labels = await page.locator('.px-field svg[role="img"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  return labels.filter((l) => l !== 'Face-down card').reduce((n, l) => n + HILO[l.split(' ')[0]], 0);
}

async function deploy(page, difficulty, seed = 57) {
  await page.goto(`/blackjack/?seed=${seed}`);
  await page.getByRole('radio', { name: new RegExp(difficulty) }).click();
  await page.getByRole('button', { name: /Deploy/ }).click();
  await expect(page.getByText('Blackjack Ops')).toBeVisible();
}

/** Plays a whole shoe: stands on every hand, declines insurance, answers 0 at checkpoints. */
async function playShoe(page, onNotice = async () => {}) {
  const notices = [];
  for (let step = 0; step < 4000; step++) {
    if (await page.getByRole('heading', { name: /After-action report/ }).count()) return notices;
    const notice = page.locator('.px-notice');
    if (await notice.count()) { const t = await notice.innerText(); notices.push(t); await onNotice(t); await notice.getByRole('button').click(); continue; }
    if (await page.locator('#px-cp').count()) { await page.locator('#px-cp').fill('0'); await page.keyboard.press('Enter'); continue; }
    for (const [name, key] of [[/^Deal/, null], [/No insurance/, 'n'], [/^Stand/, 's'], [/Next round/, null], [/Reveal next/, null]]) {
      const b = page.getByRole('button', { name });
      if (await b.count()) { if (key) await page.keyboard.press(key); else await b.click(); break; }
    }
  }
  throw new Error('shoe did not finish');
}

test('briefing: three difficulties, practice-only wording, rules and options', async ({ page }) => {
  await page.goto('/blackjack/');
  await expect(page.getByRole('heading', { name: 'Blackjack Trainer' })).toBeVisible();
  await expect(page.getByText(/no real money/i).first()).toBeVisible();
  for (const name of ['Recruit', 'Operator', 'Grandmaster']) await expect(page.getByRole('radio', { name: new RegExp(name) })).toBeVisible();
  await expect(page.getByText(/At 100 exposed cards the manual counter and the true-count calculator go offline; at 150 the ace tracker/)).toHaveCount(0);
  await page.getByRole('radio', { name: /Operator/ }).click();
  await expect(page.getByText(/At 100 exposed cards the manual counter and the true-count calculator go offline; at 150 the ace tracker/)).toBeVisible();
  await expect(page.getByText(/Endurance format/)).toBeVisible();
});

test('recruit: keyboard actions, hidden hole card, graded feedback, strategy reference matches rules', async ({ page }) => {
  await deploy(page, 'Recruit');
  await page.keyboard.press('Enter'); // Deal is focused
  await expect(page.getByRole('img', { name: 'Face-down card' })).toHaveCount(1);
  await page.keyboard.press('h');
  await expect(page.locator('.px-feed')).toContainText(/correct|, not /i);
  if (await page.getByRole('button', { name: /^Stand/ }).count()) await page.keyboard.press('s');
  await expect(page.getByRole('button', { name: /Next round/ })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Face-down card' })).toHaveCount(0);
  // ? opens the rule-matched chart; Esc closes it and focus returns.
  await page.keyboard.press('?');
  const dialog = page.getByRole('dialog', { name: 'Ask the dealer' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /full strategy chart/ }).click();
  await expect(dialog.locator('.bj-chart__rules')).toContainText('H17');
  const row17 = dialog.getByRole('table', { name: /Hard totals/ }).getByRole('row', { name: /^17/ });
  await expect(row17.getByRole('cell').last()).toContainText('Surrender, otherwise stand');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: /Next round/ })).toBeFocused();
});

test('operator: wager graded, checkpoint graded against every exposed card, true count from the player’s count', async ({ page }) => {
  await deploy(page, 'Operator');
  let rc = 0;
  for (let round = 0; round < 40; round++) {
    if (await page.locator('#px-cp').count()) break;
    await page.getByRole('radio', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: /^Deal/ }).click();
    if (round === 0) await expect(page.locator('.px-feed')).toContainText('Wager on schedule: 1');
    if (await page.getByRole('button', { name: /No insurance/ }).count()) await page.keyboard.press('n');
    if (await page.getByRole('button', { name: /^Stand/ }).count()) await page.keyboard.press('s');
    await expect(page.getByRole('button', { name: /Next round/ })).toBeVisible();
    rc += await fieldCount(page);
    await page.getByRole('button', { name: /Next round/ }).click();
  }
  await expect(page.locator('#px-cp')).toBeVisible();
  await expect(page.getByText('Count checkpoint · running count')).toBeVisible();
  // The counter was never touched, so the field is pre-filled with 0; replace it with the real count.
  await page.locator('#px-cp').fill(String(rc));
  await page.keyboard.press('Enter');
  await expect(page.locator('.px-feed')).toContainText('correct');
  const left = Number((await page.locator('.px-shoe__text').innerText()).match(/\d+/)[0]);
  const decks = Math.max(0.5, Math.round((left / 52) * 2) / 2);
  await page.locator('#px-cp').fill(String(Math.trunc(rc / decks) || 0));
  await page.keyboard.press('Enter');
  await expect(page.locator('.px-feed')).toContainText(/True count .*correct/);
});

test('operator full shoe: assistance removed at 100/150/200 with warnings, sprint to zero, report, inert keys', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await deploy(page, 'Operator');
  await expect(page.getByRole('button', { name: 'Add 1', exact: true })).toBeVisible();
  const offlineAt = {};
  const notices = await playShoe(page, async (t) => {
    if (!/offline at \d+ cards/.test(t)) return;
    offlineAt[/ace tracker/.test(t) ? 'aces' : 'count'] = await page.locator('.px-assist.is-offline').count();
    if (/ace tracker/.test(t)) await page.screenshot({ path: test.info().outputPath('offline-150.png') });
    else await page.screenshot({ path: test.info().outputPath('offline-100.png') });
  });
  expect(offlineAt).toEqual({ count: 2, aces: 3 });
  // Offline panels stay in the layout but cannot be used.
  const text = notices.join('\n');
  expect(text).toMatch(/manual counter and true-count calculator go offline at 100/);
  expect(text).toMatch(/manual counter and true-count calculator offline at 1\d\d cards/);
  expect(text).toMatch(/ace tracker goes offline at 150/);
  expect(text).toMatch(/ace tracker offline at 1\d\d cards\. The dealer now charges coins/);
  await expect(page.getByText('312/312 cards exposed', { exact: false })).toBeVisible();
  await expect(page.getByText(/Running count/).first()).toBeVisible();
  const grade = await page.locator('.px-grade').innerText();
  for (const k of ['s', 'h', '=', 'Enter', 'c']) await page.keyboard.press(k);
  await expect(page.locator('.px-grade')).toHaveText(grade);
  expect(errors).toEqual([]);
});

test('grandmaster: Wong Halves counter with half steps and the fractional legend', async ({ page }) => {
  await deploy(page, 'Grandmaster');
  await expect(page.getByRole('heading', { name: 'Wong Halves' })).toBeVisible();
  for (const n of ['0.5', '1', '1.5']) {
    await expect(page.getByRole('button', { name: `Add ${n}`, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: `Subtract ${n}`, exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Add 1.5' }).click();
  await page.keyboard.press(']');
  await expect(page.locator('.px-readout').first()).toHaveText('+2');
  await expect(page.locator('.px-calc')).toContainText('+2');
  await expect(page.locator('.px-tags')).toContainText('+1.5');
});

const RANK = { Ace: 'A', Two: '2', Three: '3', Four: '4', Five: '5', Six: '6', Seven: '7', Eight: '8', Nine: '9', Ten: '10', Jack: 'J', Queen: 'Q', King: 'K' };
const SUIT = { spades: 'S', hearts: 'H', diamonds: 'D', clubs: 'C' };
const toCard = (label) => { const [r, , s] = label.split(/[ ,]/); return { rank: RANK[r], suit: SUIT[s] }; };

for (const [label, width] of [['desktop', 1280], ['phone', 390]]) test(`flow rewards (${label}): thumbs-up at 25, neon border at 50, IN THE FLOW and coins at 75`, async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width, height: 844 });
  await deploy(page, 'Recruit');
  const flow = async () => Number(await page.getByRole('meter', { name: 'Flow' }).getAttribute('aria-valuenow'));
  let sawThumb = false, sawNeon = false;
  for (let step = 0; step < 300 && (await flow()) < 75; step++) {
    if (await page.getByRole('button', { name: /^Deal/ }).count()) { await page.getByRole('button', { name: /^Deal/ }).click(); continue; }
    if (await page.getByRole('button', { name: /Next round/ }).count()) { await page.getByRole('button', { name: /Next round/ }).click(); continue; }
    if (await page.getByRole('button', { name: /No insurance/ }).count()) { await page.keyboard.press('n'); continue; }
    const up = toCard(await page.locator('.px-side--dealer svg[role="img"]').first().getAttribute('aria-label'));
    const cards = await page.locator('.px-seat.is-active svg[role="img"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    const legal = await page.locator('.px-actions button:not(:disabled)').evaluateAll((els) => els.map((e) => e.textContent.trim().split(' ')[0].toLowerCase()));
    const d = decide(cards.map(toCard), up, DEFAULT_RULES, { canDouble: legal.includes('double'), canSplit: legal.includes('split'), canSurrender: legal.includes('surrender') });
    await page.keyboard.press({ hit: 'h', stand: 's', double: 'd', split: 'p', surrender: 'r' }[d.action]);
    await expect(page.locator('.px-feed')).toContainText(/correct/i);
    if ((await flow()) >= 25) sawThumb ||= await page.getByRole('img', { name: /Thumbs up/ }).isVisible();
    if ((await flow()) >= 50) sawNeon ||= await page.locator('.px-arena.is-neon').count() > 0;
  }
  expect(await flow()).toBeGreaterThanOrEqual(75);
  expect(sawThumb).toBe(true);
  expect(sawNeon).toBe(true);
  await expect(page.getByText('IN THE FLOW!')).toBeVisible();
  await expect(page.locator('.px-cat')).toHaveCount(2);
  await expect(page.locator('.px-flowbar.tier-3')).toHaveCount(1);
  // The rainbow is animated (not a static gradient) unless motion is reduced.
  expect(await page.locator('.px-flowbar__fill').evaluate((e) => getComputedStyle(e).animationName)).toContain('px-rainbow-flow');
  await page.waitForTimeout(600);
  await page.screenshot({ path: test.info().outputPath(`in-the-flow-${label}.png`) });
  if (width < 500) expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // The next correct decision drops a coin; C collects it into the cosmetic bank.
  for (let step = 0; step < 40 && !(await page.locator('.px-coin').count()); step++) {
    if (await page.getByRole('button', { name: /^Deal/ }).count()) { await page.getByRole('button', { name: /^Deal/ }).click(); continue; }
    if (await page.getByRole('button', { name: /Next round/ }).count()) { await page.getByRole('button', { name: /Next round/ }).click(); continue; }
    if (await page.getByRole('button', { name: /No insurance/ }).count()) { await page.keyboard.press('n'); continue; }
    const up = toCard(await page.locator('.px-side--dealer svg[role="img"]').first().getAttribute('aria-label'));
    const cards = await page.locator('.px-seat.is-active svg[role="img"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    const legal = await page.locator('.px-actions button:not(:disabled)').evaluateAll((els) => els.map((e) => e.textContent.trim().split(' ')[0].toLowerCase()));
    const d = decide(cards.map(toCard), up, DEFAULT_RULES, { canDouble: legal.includes('double'), canSplit: legal.includes('split'), canSurrender: legal.includes('surrender') });
    await page.keyboard.press({ hit: 'h', stand: 's', double: 'd', split: 'p', surrender: 'r' }[d.action]);
  }
  await expect(page.locator('.px-coin').first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('rewards.png') });
  await expect(page.getByRole('button', { name: /Collect \d+ coins?/ })).toBeVisible();
  await page.keyboard.press('c');
  await expect(page.locator('.px-coin')).toHaveCount(0);
  expect(Number(await page.locator('.px-top__coins dd').innerText())).toBeGreaterThan(0);
  expect(await page.evaluate(() => localStorage.getItem('blackjack-coins-v1'))).toBeNull(); // coins belong to the run
});

/** One basic-strategy step in the browser (deal, next, decline insurance, or the correct play). Returns true if it was a play decision. */
async function correctStep(page, wrong = false) {
  for (const name of [/^Deal/, /Next round/]) {
    const b = page.getByRole('button', { name });
    if (await b.count()) { await b.click(); return false; }
  }
  if (await page.getByRole('button', { name: /No insurance/ }).count()) { await page.keyboard.press('n'); return true; }
  const bar = page.locator('.px-actions[aria-label^="Your decision"]');
  if (!(await bar.count())) return false;
  const up = toCard(await page.locator('.px-side--dealer svg[role="img"]').first().getAttribute('aria-label'));
  const cards = await page.locator('.px-seat.is-active svg[role="img"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  const legal = await bar.locator('button:not(:disabled)').evaluateAll((els) => els.map((e) => e.textContent.trim().split(' ')[0].toLowerCase()));
  const d = decide(cards.map(toCard), up, DEFAULT_RULES, { canDouble: legal.includes('double'), canSplit: legal.includes('split'), canSurrender: legal.includes('surrender') });
  const a = wrong ? legal.find((x) => x !== d.action) : d.action;
  await page.keyboard.press({ hit: 'h', stand: 's', double: 'd', split: 'p', surrender: 'r' }[a]);
  return true;
}

for (const [label, width] of [['desktop', 1280], ['phone', 390]]) test(`combo (${label}): Tron power-up at 50%, fire 1×–5×, overdrive at 10×, rainbow 100% once`, async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/blackjack/?seed=7');
  await page.getByRole('button', { name: /Deploy/ }).click();
  const flow = async () => Number(await page.getByRole('meter', { name: 'Flow' }).getAttribute('aria-valuenow'));
  const count = async () => Number(await page.locator('.px-combo').getAttribute('data-count'));
  const shot = (n) => page.screenshot({ path: test.info().outputPath(`${label}-${n}.png`) });
  await expect(page.locator('.px-combo')).toContainText('unlocks at 50% flow');
  while ((await flow()) < 50) await correctStep(page);
  // Capture the circuit mid-flight: spark, streams on the sides, meeting at the top, pulse.
  await expect(page.locator('.px-tron')).toHaveCount(1);
  for (const ms of [120, 450, 800, 1300]) { await page.waitForTimeout(ms === 120 ? 120 : 330); await shot(`tron-${ms}`); }
  await expect(page.locator('.px-combo')).toContainText('Multiplier');
  await expect(page.locator('.px-combo__num')).toHaveAttribute('aria-label', 'multiplier 1 times');
  expect(await page.locator('.px-tron__head').first().evaluate((e) => getComputedStyle(e).animationName)).toBe('px-tron-head');
  while ((await count()) < 5) await correctStep(page);
  await page.waitForTimeout(500);
  await shot('combo-5');
  expect(await page.locator('.px-fire__f0').evaluate((e) => getComputedStyle(e).animationName)).toBe('px-fl-0');
  while ((await flow()) < 100) await correctStep(page);
  await expect(page.getByText(/Perfect flow/)).toBeVisible();
  await expect(page.getByText('IN THE FLOW!')).toBeVisible();
  await expect(page.locator('.px-tron.is-rainbow')).toHaveCount(1);
  await page.waitForTimeout(700);
  await shot('rainbow-100');
  while ((await count()) < 10) await correctStep(page);
  await expect(page.locator('.px-combo.is-overdrive')).toHaveCount(1);
  expect(await page.locator('.px-combo__firebox').evaluate((e) => getComputedStyle(e).animationName)).toBe('px-tremble');
  await page.waitForTimeout(400);
  await shot('overdrive');
  // Mistake: extinguish and drop out of the 100% styling.
  while (!(await correctStep(page, true))) { /* advance to a decision, then play it wrong */ }
  await expect(page.locator('.px-combo')).toHaveAttribute('data-count', '0');
  await expect(page.locator('.px-tron.is-max')).toHaveCount(0);
  await expect(page.locator('.px-fire.is-out')).toHaveCount(1);
  await shot('broken');
  // Cards stay on screen and nothing overflows.
  for (const box of await page.locator('.px-card').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(width);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('reduced motion: Tron streams, fire flicker and combo shake are static', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/blackjack/?seed=7');
  await page.getByRole('button', { name: /Deploy/ }).click();
  const flow = async () => Number(await page.getByRole('meter', { name: 'Flow' }).getAttribute('aria-valuenow'));
  while ((await flow()) < 50) await correctStep(page);
  await expect(page.locator('.px-tron__run')).toBeHidden();
  expect(await page.locator('.px-tron__rail').evaluate((e) => getComputedStyle(e).opacity)).toBe('0.85');
  expect(await page.locator('.px-fire__f0').evaluate((e) => [getComputedStyle(e).animationName, getComputedStyle(e).opacity])).toEqual(['none', '1']);
  expect(await page.locator('.px-combo__num').evaluate((e) => getComputedStyle(e).animationName)).toBe('none');
});

test('mistake feedback: explanation, flow loss and a red edge (static when flashing is reduced)', async ({ page }) => {
  await page.goto('/blackjack/?seed=57');
  await page.getByRole('checkbox', { name: 'Reduce flashing' }).check();
  await page.getByRole('button', { name: /Deploy/ }).click();
  await page.getByRole('button', { name: /^Deal/ }).click();
  // Seed 57 opens with A,2 against an 8: basic strategy hits soft 13, so surrender/stand is a mistake.
  await page.keyboard.press('s');
  await expect(page.locator('.px-feed.is-bad')).toContainText(/Hit, not Stand/);
  await expect(page.locator('.px-arena.is-miss-static')).toHaveCount(1);
  await expect(page.locator('.px-arena.is-miss')).toHaveCount(0);
});

test('mobile: long hands stay on screen, panels collapse, no horizontal overflow (Codex finding 10)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await deploy(page, 'Operator');
  await page.getByRole('button', { name: /^Deal/ }).click();
  for (let i = 0; i < 4 && await page.getByRole('button', { name: /^Hit/ }).isEnabled().catch(() => false); i++) await page.getByRole('button', { name: /^Hit/ }).click();
  await page.waitForTimeout(800);
  for (const box of await page.locator('.px-card').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(390);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const intel = page.getByRole('button', { name: /Intel/ });
  await expect(intel).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('heading', { name: 'Table' })).toBeHidden();
  await intel.click();
  await expect(page.getByRole('heading', { name: 'Table' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Ask the dealer/ })).toBeVisible();
  await expect(page.locator('.px-flowbar__pct')).toBeVisible();
  const bar = await page.locator('.px-flowbar__track').boundingBox();
  expect(bar.width).toBeGreaterThan(200);
  await page.screenshot({ path: test.info().outputPath('mobile-run.png'), fullPage: true });
  const hit = await page.getByRole('button', { name: /Next round|^Stand/ }).first().boundingBox();
  expect(hit.height).toBeGreaterThanOrEqual(44);
});

test('mode switching works on the first click, survives a tab visit, and switching mid-run starts fresh', async ({ page }) => {
  await page.goto('/blackjack/?seed=57');
  await page.getByRole('radio', { name: /Operator/ }).click();
  await page.getByRole('tab', { name: 'Training' }).click();
  await page.getByRole('tab', { name: 'Campaign' }).click();
  await expect(page.getByRole('radio', { name: /Operator/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: /Deploy/ }).click();
  await expect(page.getByRole('heading', { name: 'Hi-Lo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add 1', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: /^Deal/ }).click();
  await page.getByRole('button', { name: 'Grandmaster' }).click();
  await page.getByRole('button', { name: 'Start fresh' }).click();
  await expect(page.getByRole('heading', { name: 'Wong Halves' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add 0.5', exact: true })).toBeVisible();
  await expect(page.locator('.px-top__stats div').nth(1).locator('dd')).toHaveText('0/312');
  await page.getByRole('button', { name: 'Recruit' }).click(); // nothing played yet: switches at once
  await expect(page.getByRole('heading', { name: 'Hi-Lo' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Wong Halves' })).toHaveCount(0);
  await expect(page.locator('.px-top__sub')).toContainText('Recruit');
});

test('golden cards shimmer only face up; the dealer gives rule-based advice for free before 150', async ({ page }) => {
  await deploy(page, 'Recruit');
  let sawGolden = false;
  for (let round = 0; round < 25; round++) {
    await page.getByRole('button', { name: /^Deal/ }).click();
    expect(await page.locator('svg[aria-label="Face-down card"].is-golden').count()).toBe(0);
    if (await page.getByRole('button', { name: /No insurance/ }).count()) await page.keyboard.press('n');
    if (round === 0 && await page.getByRole('button', { name: /^Stand/ }).count()) {
      await page.getByRole('button', { name: /Ask the dealer/ }).click();
      const dlg = page.getByRole('dialog', { name: 'Ask the dealer' });
      await dlg.getByRole('button', { name: 'Tell me (free)' }).click();
      const up = toCard(await page.locator('.px-side--dealer svg[role="img"]').first().getAttribute('aria-label'));
      const cards = await page.locator('.px-seat.is-active svg[role="img"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
      const legal = await page.locator('.px-actions button:not(:disabled)').evaluateAll((els) => els.map((e) => e.textContent.trim().split(' ')[0].toLowerCase()));
      const d = decide(cards.map(toCard), up, DEFAULT_RULES, { canDouble: legal.includes('double'), canSplit: legal.includes('split'), canSurrender: legal.includes('surrender') });
      await expect(dlg.locator('.px-advice__play strong')).toHaveText(new RegExp(d.action, 'i'));
      await page.screenshot({ path: test.info().outputPath('dealer.png') });
      await page.keyboard.press('Escape');
    }
    const goldenNow = (await page.locator('svg.is-golden').count()) > 0;
    sawGolden ||= goldenNow;
    if (goldenNow) { await page.waitForTimeout(900); await page.screenshot({ path: test.info().outputPath('golden.png') }); }
    if (await page.getByRole('button', { name: /^Stand/ }).count()) await page.keyboard.press('s');
    await page.getByRole('button', { name: /Next round/ }).click();
    if (sawGolden) break;
  }
  expect(sawGolden).toBe(true);
});

test('reduced motion: rainbow, cats and gold shimmer are static', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/blackjack/?seed=57');
  await page.getByRole('button', { name: /Deploy/ }).click();
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.innerHTML = '<div class="px-flowbar tier-3"><div class="px-flowbar__track"><span class="px-flowbar__fill"></span></div><span class="px-cat"></span><strong class="px-inflow__text">x</strong></div><svg><rect class="px-gold__shine"/></svg>';
    document.body.appendChild(host);
  });
  for (const sel of ['.px-flowbar__fill', '.px-cat', '.px-inflow__text', '.px-gold__shine']) {
    expect(await page.locator(sel).last().evaluate((e) => getComputedStyle(e).animationName)).toBe('none');
  }
});

test('reduced motion: cards are dealt without animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await deploy(page, 'Recruit');
  await page.getByRole('button', { name: /^Deal/ }).click();
  const names = await page.locator('.px-card').evaluateAll((els) => els.map((e) => getComputedStyle(e).animationName));
  expect(names.length).toBeGreaterThan(2);
  expect(names.every((n) => n === 'none')).toBe(true);
});

test('training: strategy quiz, counting drill and true count still work', async ({ page }) => {
  await page.goto('/blackjack/');
  await page.getByRole('tab', { name: 'Training' }).click();
  await page.getByRole('button', { name: 'Hit', exact: true }).click();
  await expect(page.getByText(/Correct\.|Not quite/)).toBeVisible();
  await expect(page.getByText(/This answer (depends|is the same)/)).toBeVisible();
  await page.getByRole('button', { name: 'Next hand' }).click();
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('blackjack-progress-v1'))).strategy).toBeTruthy();

  await page.getByRole('button', { name: 'Hi-Lo counting' }).click();
  const label = await page.locator('.bj-hand [role="img"]').first().getAttribute('aria-label');
  const expected = /plus one/.test(label) ? '+1' : /minus one/.test(label) ? '−1' : '0';
  await page.getByRole('button', { name: expected, exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /Right:|is [+−0]/ })).toBeVisible();

  await page.getByRole('button', { name: 'True count', exact: true }).click();
  const prompt = await page.locator('.bj-big').innerText();
  const [, rc, decks] = prompt.match(/Running count ([+−-]?\d+), ([\d.]+) deck/);
  await page.getByLabel('True count?').fill(String(Math.trunc(Number(rc.replace('−', '-')) / Number(decks)) || 0));
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText(/Correct\./)).toBeVisible();
});

test('manual: chart changes with the table rules, which persist', async ({ page }) => {
  await page.goto('/blackjack/');
  await page.getByRole('tab', { name: 'Manual' }).click();
  const cell = page.getByRole('table', { name: /Hard totals/ }).getByRole('row', { name: /^11/ }).getByRole('cell').last();
  await expect(cell).toContainText('Double');
  await page.getByRole('button', { name: 'Table rules', exact: true }).click();
  await page.getByLabel('Dealer on soft 17').selectOption('s17');
  await expect(cell).toContainText('Hit');
  await page.reload();
  await page.getByRole('button', { name: 'Table rules', exact: true }).click();
  await expect(page.getByLabel('Dealer on soft 17')).toHaveValue('s17');
  await expect(page.getByText(/A shoe that is rich in tens and aces is better for you/)).toHaveCount(0); // Manual tab not open after reload
});

test('home tile links to the app in a new tab', async ({ page }) => {
  await page.route('**/api/spotify/last-played', (route) => route.abort());
  await page.goto('/');
  const link = page.getByRole('link', { name: /Blackjack Trainer/ });
  await expect(link).toHaveAttribute('href', '/blackjack/');
  await expect(link).toHaveAttribute('target', '_blank');
});

test('dark only: stays dark when the portfolio is in light mode and the OS prefers light; no theme toggle', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => localStorage.setItem('theme', 'light'));
  await page.goto('/blackjack/');
  await expect(page.getByRole('button', { name: /Switch to (light|dark) theme/ })).toHaveCount(0);
  const bg = await page.evaluate(() => [getComputedStyle(document.documentElement).backgroundColor, getComputedStyle(document.body).backgroundColor, document.documentElement.dataset.theme]);
  expect(bg).toEqual(['rgb(11, 12, 22)', 'rgb(11, 12, 22)', 'dark']);
  // The inline <html> style paints dark before any script or stylesheet runs (no light flash).
  const html = await (await page.request.get('/blackjack/')).text();
  expect(html).toMatch(/<html[^>]*data-theme="dark"[^>]*background:#0b0c16/);
  expect(html).not.toMatch(/localStorage\.getItem\('theme'\)/);
});

test('Full Screen enters and exits (button and native exit), keeps the run, and Exit to Portfolio leaves fullscreen first', async ({ page }) => {
  await deploy(page, 'Operator');
  await page.getByRole('radio', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: /^Deal/ }).click();
  const exposed = await page.locator('.px-top__stats div').nth(1).locator('dd').innerText();
  await page.getByRole('button', { name: 'Full Screen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Exit Full Screen', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.fullscreenElement?.classList.contains('bj'))).toBe(true);
  await expect(page.locator('.px-top__stats div').nth(1).locator('dd')).toHaveText(exposed); // same run
  await page.getByRole('button', { name: 'Exit Full Screen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Full Screen', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  // Native exit (Esc / system gesture) is picked up through fullscreenchange.
  await page.getByRole('button', { name: 'Full Screen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Exit Full Screen', exact: true })).toBeVisible();
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.getByRole('button', { name: 'Full Screen', exact: true })).toBeVisible();
  await expect(page.locator('.px-top__stats div').nth(1).locator('dd')).toHaveText(exposed);
  // Exit to Portfolio from fullscreen: fullscreen ends, then the portfolio loads.
  await page.getByRole('button', { name: 'Full Screen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Exit Full Screen', exact: true })).toBeVisible();
  await page.route('**/api/spotify/last-played', (route) => route.abort());
  await page.getByRole('link', { name: 'Exit to Portfolio' }).click();
  await page.waitForURL((u) => u.pathname === '/');
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  await expect(page.getByRole('link', { name: /Blackjack Trainer/ })).toBeVisible();
});

test('unsupported fullscreen (iPhone Safari): honest note, nothing trapped, game still playable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false, configurable: true });
    Object.defineProperty(Element.prototype, 'requestFullscreen', { value: undefined, configurable: true });
    Object.defineProperty(Document.prototype, 'webkitFullscreenEnabled', { get: () => false, configurable: true });
    Object.defineProperty(Element.prototype, 'webkitRequestFullscreen', { value: undefined, configurable: true });
  });
  await page.goto('/blackjack/?seed=57');
  await page.getByRole('button', { name: 'Full Screen', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /can’t make a page full screen/ })).toBeVisible();
  await expect(page.getByText(/Add to Home Screen/)).toBeVisible();
  await page.getByRole('button', { name: 'OK' }).click();
  await page.getByRole('button', { name: /Deploy/ }).click();
  await page.getByRole('button', { name: /^Deal/ }).click();
  await expect(page.getByRole('img', { name: 'Face-down card' })).toHaveCount(1);
});

test.describe('phone portrait', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('rotate prompt shows (orientation lock unavailable), can be dismissed, and play continues', async ({ page }) => {
    await page.goto('/blackjack/?seed=57');
    await page.getByRole('button', { name: /Deploy/ }).click();
    const prompt = page.getByText(/Rotate your phone for the best experience/);
    await expect(prompt).toBeVisible();
    await page.getByRole('button', { name: 'Got it' }).click();
    await expect(prompt).toHaveCount(0);
    await page.getByRole('button', { name: /^Deal/ }).click();
    await expect(page.getByRole('img', { name: 'Face-down card' })).toHaveCount(1);
  });
});

test.describe('phone landscape', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  test('wide layout: no rotate prompt, table and action buttons above the fold, side panels beside the table', async ({ page }) => {
    await page.goto('/blackjack/?seed=57');
    await page.getByRole('radio', { name: /Operator/ }).click();
    await page.getByRole('button', { name: /Deploy/ }).click();
    await page.getByRole('radio', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: /^Deal/ }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByText(/Rotate your phone/)).toBeHidden();
    const r = await page.evaluate(() => {
      const box = (s) => document.querySelector(s).getBoundingClientRect();
      return { actions: box('.px-actions').bottom, arena: box('.px-arena'), left: box('.px-left') };
    });
    expect(r.actions).toBeLessThanOrEqual(390);
    expect(r.left.left).toBeGreaterThanOrEqual(r.arena.right); // count panel beside, not below, the table
  });
});

test('Recruit: ace side count is greyed out and cannot be turned on; Operator restores it on the first click', async ({ page }) => {
  await page.goto('/blackjack/');
  const box = page.getByRole('checkbox', { name: /Ace side count/ });
  const label = page.locator('label.px-opt');
  await expect(box).toBeDisabled();
  await expect(label).toHaveClass(/is-unavailable/);
  await expect(page.getByText('Available in advanced modes (Operator, Grandmaster).')).toBeVisible();
  expect(await label.evaluate((e) => getComputedStyle(e).cursor)).toBe('not-allowed');
  await label.click({ force: true });
  await box.focus();
  await page.keyboard.press('Space');
  await expect(box).not.toBeChecked();
  await page.getByRole('radio', { name: /Operator/ }).click();
  await expect(box).toBeEnabled();
  await expect(label).not.toHaveClass(/is-unavailable/);
  await box.check();
  await expect(box).toBeChecked();
  await page.getByRole('radio', { name: /Recruit/ }).click();
  await expect(box).toBeDisabled();
  await expect(box).not.toBeChecked(); // shown off in Recruit even though the Operator setting is kept
});

test('portfolio thumbnail uses the game’s pixel cards and opens the trainer', async ({ page }) => {
  await page.route('**/api/spotify/last-played', (route) => route.abort());
  await page.goto('/');
  const link = page.getByRole('link', { name: /Blackjack Trainer/ });
  const preview = page.locator('.bj-preview');
  await expect(preview.locator('svg.px-card')).toHaveCount(4);
  await expect(preview.locator('svg.px-card--dark')).toHaveCount(1);
  await expect(preview.locator('svg.px-card--back')).toHaveCount(1);
  await expect(preview.locator('svg.px-card--light')).toHaveCount(2);
  expect(await preview.locator('svg.px-card').first().getAttribute('shape-rendering')).toBe('crispEdges');
  await expect(link).toHaveAttribute('href', '/blackjack/');
  await page.screenshot({ path: test.info().outputPath('home.png'), fullPage: true });
});
