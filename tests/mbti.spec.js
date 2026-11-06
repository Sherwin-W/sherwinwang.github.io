import { test, expect } from '@playwright/test';

const QUESTION_ANSWER = 'I love big parties and I talk to everyone. I always make a plan and a list. I care about how everyone feels. I like concrete facts.';
const SCENE_ANSWER = "Yeah, let's go somewhere and invite more people, I would make a plan right away and focus on the practical facts and how everyone feels.";

const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

async function finishStage1(page) {
  for (let i = 0; i < 16 && !(await page.getByRole('button', { name: 'Open the scenes' }).isVisible()); i++) {
    await page.getByLabel('Your answer').fill(QUESTION_ANSWER);
    await page.getByRole('button', { name: 'Next' }).click();
  }
  await expect(page.getByRole('heading', { name: /Stage 2\s*Social scenes/ })).toBeVisible();
}

async function playScene(page, title) {
  await page.getByRole('button', { name: new RegExp(`^${title}:`) }).click();
  await expect(page.locator('.mb-caption')).toBeVisible();
  for (let k = 0; k < 2 && await page.getByLabel('Your answer').isVisible(); k++) {
    await page.getByLabel('Your answer').fill(SCENE_ANSWER);
    await page.getByRole('button', { name: 'Send answer' }).click();
  }
  await expect(page.getByText('Scene complete.')).toBeVisible();
  await page.getByRole('button', { name: 'All scenes' }).click();
}

test('typed path through both stages ends in a reading quoting both stages; nothing is stored', async ({ page }) => {
  const requests = [];
  page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1:4173') && !r.url().startsWith('data:')) requests.push(r.url()); });
  await page.goto('/mbti/');
  await expect(page.getByRole('heading', { name: 'MBTI-Inspired Personality Test' })).toBeVisible();
  await expect(page.getByText(/Not affiliated with or endorsed by The Myers-Briggs Company/)).toBeVisible();
  await page.getByRole('button', { name: 'Type instead' }).click();
  await expect(page.getByText(/Stage 1 of 2/)).toBeVisible();
  await finishStage1(page);
  await page.getByRole('button', { name: 'Open the scenes' }).click();
  await expect(page.getByRole('button', { name: 'See my reading' })).toBeDisabled();
  for (const title of ['Party tonight', 'The interview', 'The big decision', 'A leap']) await playScene(page, title);
  await expect(page.locator('.mb-card.is-done')).toHaveCount(4);
  await page.getByRole('button', { name: 'See my reading' }).click();
  await expect(page.locator('.mb-type')).toHaveText(/^[ESTJFINPX]{4}$/);
  await expect(page.locator('.mb-quotes').getByText(/^Scene: /).first()).toBeVisible();
  await expect(page.locator('.mb-quotes').getByText(/^Questions/).first()).toBeVisible();
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  expect(requests).toEqual([]);
  await page.getByRole('button', { name: 'Start over (deletes this session)' }).click();
  await expect(page.getByRole('button', { name: 'Type instead' })).toBeVisible();
});

test('a scene call rings, subtitles the line, replays, and works with voices off', async ({ page }) => {
  await page.goto('/mbti/');
  await page.getByRole('button', { name: 'Type instead' }).click();
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.getByRole('button', { name: 'Finish questions' }).click();
  await page.getByRole('button', { name: 'Open the scenes' }).click();
  await page.getByRole('button', { name: /^A different view:/ }).click();
  await expect(page.getByText(/Calling Maya/)).toBeVisible();
  await expect(page.locator('.mb-caption')).toContainText('Maya: Everyone, when they are young, knows what their destiny is.');
  await page.getByRole('button', { name: 'Replay' }).click();
  await page.getByRole('button', { name: 'Voice on' }).click();
  await expect(page.getByRole('button', { name: 'Voice off' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.mb-caption')).toBeVisible();
  await page.getByRole('button', { name: 'Skip this scene' }).click();
  await expect(page.getByText('Skipped.')).toBeVisible();
  await page.getByRole('button', { name: /^Next scene:/ }).click();
  await expect(page.locator('#mb-call-h')).not.toHaveText('A different view');
});

test('without speech synthesis the calls still run on recordings alone', async ({ page }) => {
  await page.addInitScript(() => { delete window.speechSynthesis; delete window.SpeechSynthesisUtterance; });
  await page.goto('/mbti/');
  await page.getByRole('button', { name: 'Type instead' }).click();
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.getByRole('button', { name: 'Finish questions' }).click();
  await page.getByRole('button', { name: 'Open the scenes' }).click();
  await playScene(page, 'Party tonight');
  await expect(page.locator('.mb-card.is-done')).toHaveCount(1);
});

test('microphone permission denial falls back to typing with a clear message', async ({ page }) => {
  await page.addInitScript(() => {
    window.SpeechRecognition = window.webkitSpeechRecognition = class { start() { setTimeout(() => { this.onerror?.({ error: 'not-allowed' }); this.onend?.(); }, 10); } stop() {} abort() {} };
  });
  await page.goto('/mbti/');
  await page.getByRole('button', { name: 'Answer out loud' }).click();
  await page.getByRole('button', { name: 'Speak' }).click();
  await expect(page.getByText(/Microphone access was blocked/)).toBeVisible();
  await page.getByLabel('Your answer').fill(QUESTION_ANSWER);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText(/Question 2/)).toBeVisible();
});

test('a voice transcript fills the editable answer box, cleaned up', async ({ page }) => {
  await page.addInitScript(() => {
    window.SpeechRecognition = window.webkitSpeechRecognition = class {
      start() { setTimeout(() => this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: 'um I I love meeting new people' }], { isFinal: true })] }), 10); }
      stop() { this.onend?.(); } abort() {}
    };
  });
  await page.goto('/mbti/');
  await page.getByRole('button', { name: 'Answer out loud' }).click();
  await page.getByRole('button', { name: 'Speak' }).click();
  await expect(page.getByText(/Recording\./)).toBeVisible();
  await expect(page.getByLabel('Your answer')).toHaveValue('I love meeting new people');
});

for (const [w, h] of [[390, 844], [844, 390], [1366, 900]]) {
  test(`layout fits at ${w}×${h} on every screen`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/mbti/');
    expect(await noOverflow(page)).toBe(true);
    await page.getByRole('button', { name: 'Type instead' }).click();
    expect(await noOverflow(page)).toBe(true);
    for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await page.getByRole('button', { name: 'Finish questions' }).click();
    expect(await noOverflow(page)).toBe(true);
    await page.getByRole('button', { name: 'Open the scenes' }).click();
    expect(await noOverflow(page)).toBe(true);
    await page.getByRole('button', { name: /^Getting everyone together:/ }).click();
    await expect(page.locator('.mb-caption')).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
    const tap = await page.getByRole('button', { name: 'Replay' }).boundingBox();
    expect(tap.height).toBeGreaterThanOrEqual(44);
  });
}

test('the old /mpti/ address redirects to /mbti/, keeping query and hash', async ({ page }) => {
  await page.goto('/mpti/?from=old#top');
  await page.waitForURL('**/mbti/?from=old#top');
  await expect(page.getByRole('heading', { name: 'MBTI-Inspired Personality Test' })).toBeVisible();
});

async function openScenes(page) {
  await page.getByRole('button', { name: 'Type instead' }).click();
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.getByRole('button', { name: 'Finish questions' }).click();
  await page.getByRole('button', { name: 'Open the scenes' }).click();
}

test('every voice file in the catalog is served locally as decodable audio', async ({ page }) => {
  await page.goto('/mbti/');
  const files = await page.locator('.mb-credits__play').evaluateAll((els) => els.length);
  expect(files).toBe(9);
  const results = await page.evaluate(async () => {
    const names = ['party-line', 'interview-line', 'two-programs-line', 'walters-leap-line', 'destiny-line', 'weekend-line', 'weekend-followUp', 'weekend-outro', 'checking-in-line'];
    return Promise.all(names.map((n) => new Promise((res) => {
      const a = new Audio(`/voices/${n}.m4a`);
      a.oncanplaythrough = () => res([n, a.duration]); a.onerror = () => res([n, 'error']); a.load();
    })));
  });
  for (const [name, duration] of results) { expect(typeof duration, name).toBe('number'); expect(duration, name).toBeGreaterThan(0.3); }
});

test('a call plays the human recordings in order, subtitled, and the face talks while they play', async ({ page }) => {
  const audio = [];
  page.on('response', (r) => { if (r.url().includes('/voices/')) audio.push([new URL(r.url()).pathname, r.status()]); });
  await page.goto('/mbti/');
  await openScenes(page);
  await page.getByRole('button', { name: /^Party tonight:/ }).click();
  await expect(page.locator('.mb-caption')).toHaveText('Lena: What are you doing tonight?');
  await expect(page.locator('.mb-call__speaking')).toBeVisible();
  await expect(page.locator('.mb-caption .is-now')).toContainText('What are you doing tonight?', { timeout: 6000 });
  await expect(page.locator('.mb-call__speaking')).toBeHidden({ timeout: 8000 });
  await expect(page.getByText(/Voice: Common Voice contributor .* \(CC0\)/)).toBeVisible();
  expect(audio.map(([p]) => p)).toEqual(expect.arrayContaining(['/voices/party-line.m4a']));
  expect(audio.every(([, s]) => s === 200 || s === 206 || s === 304)).toBe(true);
  // Replay plays again; leaving stops it.
  await page.getByRole('button', { name: 'Replay' }).click();
  await expect(page.locator('.mb-call__speaking')).toBeVisible();
  await page.getByRole('button', { name: 'Leave' }).click();
  await expect(page.getByRole('heading', { name: 'Pick a scene' })).toBeVisible();
});

test('a missing recording falls back to the subtitle and says so', async ({ page }) => {
  await page.route('**/voices/interview-line.m4a', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/mbti/');
  await openScenes(page);
  await page.getByRole('button', { name: /^The interview:/ }).click();
  await expect(page.getByText(/recording did not load, so this line is shown as text/)).toBeVisible();
  await expect(page.locator('.mb-caption')).toContainText('Have you ever had any experience?');
  await page.getByLabel('Your answer').fill('I like clear goals, honest feedback and a structured plan with deadlines.');
  await page.getByRole('button', { name: 'Send answer' }).click();
  await expect(page.getByText('Scene complete.')).toBeVisible();
});

test('replaying a line while the microphone is on stops listening first', async ({ page }) => {
  await page.addInitScript(() => {
    window.__stops = 0;
    window.SpeechRecognition = window.webkitSpeechRecognition = class { start() {} stop() { window.__stops++; this.onend?.(); } abort() {} };
  });
  await page.goto('/mbti/');
  await page.getByRole('button', { name: 'Answer out loud' }).click();
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.getByRole('button', { name: 'Finish questions' }).click();
  await page.getByRole('button', { name: 'Open the scenes' }).click();
  await page.getByRole('button', { name: /^The big decision:/ }).click();
  await expect(page.locator('.mb-caption')).toContainText('Jordan: What shall I do?');
  await page.getByRole('button', { name: 'Speak' }).click();
  await expect(page.getByText(/Recording\./)).toBeVisible();
  await page.getByRole('button', { name: 'Replay' }).click();
  await expect.poll(() => page.evaluate(() => window.__stops)).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Speak' })).toBeVisible();
});

test('the voices and credits list plays each recording and names its licence', async ({ page }) => {
  await page.goto('/mbti/');
  await page.getByText('Voices and credits').click();
  await expect(page.getByRole('button', { name: /^Play Rosa: Are you well\?/ })).toBeVisible();
  await expect(page.locator('.mb-credits').getByText(/CC0/).first()).toBeVisible();
  await expect(page.locator('.mb-credits').getByText(/by Sarah Gutierrez/)).toBeVisible();
  await page.getByRole('button', { name: /^Play Walter: Did you really think it through\?/ }).click();
  await expect(page.getByRole('button', { name: 'Stop Walter: Did you really think it through?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play Walter: Did you really think it through?' })).toBeVisible({ timeout: 6000 });
});

test.describe('portfolio thumbnail', () => {
  const box = (page, sel) => page.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, w: r.width, h: r.height }; });
  for (const scheme of ['light', 'dark']) {
    test(`desktop (${scheme}): MBTI art matches the Blackjack art and the cards line up`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 1366, height: 900 });
      await page.goto('/');
      const [mbti, bj, spotify] = await Promise.all(['.bento-slot--mbti', '.bento-slot--blackjack', '.bento-slot--spotify'].map((s) => box(page, s)));
      expect(Math.abs(mbti.h - bj.h)).toBeLessThanOrEqual(1);
      expect(Math.abs(mbti.y - bj.y)).toBeLessThanOrEqual(1);
      // Spotify has its own row above the three app tiles.
      expect(spotify.y + spotify.h).toBeLessThan(mbti.y);
      const [mArt, bArt] = await Promise.all([box(page, '.mb-preview'), box(page, '.bj-preview')]);
      expect(Math.abs(mArt.h - bArt.h)).toBeLessThanOrEqual(2);
      expect(mArt.h).toBeLessThanOrEqual(120);
      const [mTitle, bTitle] = await Promise.all([box(page, '.bento-slot--mbti h2'), box(page, '.bento-slot--blackjack h2')]);
      expect(Math.abs(mTitle.y - bTitle.y)).toBeLessThanOrEqual(2);
      // The illustration is small and decorative.
      const art = await box(page, '.mb-preview__art');
      expect(art.w).toBeLessThanOrEqual(150);
      expect(art.h).toBeLessThanOrEqual(110);
      expect(await page.locator('.mb-preview').getAttribute('aria-hidden')).toBe('true');
    });
  }

  test('the thumbnail does not shift the grid after it renders', async ({ page }) => {
    // Layout boxes (offset*), which ignore the tiles' entrance animation transform.
    const layout = () => page.evaluate(() => ['spotify', 'mbti', 'blackjack'].map((s) => { const e = document.querySelector('.bento-slot--' + s); return [e.offsetLeft, e.offsetTop, e.offsetWidth, e.offsetHeight]; }));
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/');
    // Rows now size to their text, so measure after the web font has swapped in.
    await page.evaluate(() => document.fonts.ready);
    const before = await layout();
    await page.waitForTimeout(1500);
    expect(await layout()).toEqual(before);
  });

  for (const [w, h] of [[390, 844], [900, 1000]]) {
    test(`stacks cleanly at ${w}px with the art the same size as Blackjack's`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/');
      const [mbti, bj] = await Promise.all([box(page, '.bento-slot--mbti'), box(page, '.bento-slot--blackjack')]);
      expect(Math.abs(mbti.h - bj.h)).toBeLessThanOrEqual(24);
      const [mArt, bArt] = await Promise.all([box(page, '.mb-preview'), box(page, '.bj-preview')]);
      expect(Math.abs(mArt.h - bArt.h)).toBeLessThanOrEqual(2);
      expect(mbti.x + mbti.w).toBeLessThanOrEqual(w);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
});
