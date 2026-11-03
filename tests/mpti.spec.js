import { test, expect } from '@playwright/test';

const answer = async (page, text) => {
  await page.getByLabel('Your answer').fill(text);
  await page.getByRole('button', { name: 'Continue' }).click();
};

test('typed path: questions adapt, results cite the persons own words, nothing is stored', async ({ page }) => {
  await page.goto('/mpti/');
  await expect(page.getByRole('heading', { name: 'MPTI' })).toBeVisible();
  await expect(page.getByText(/never records or keeps audio/)).toBeVisible();
  await page.getByRole('button', { name: 'Type instead' }).click();
  const prompts = [];
  for (let i = 0; i < 6; i++) {
    const heading = page.locator('.mpti__prompt');
    if (!(await heading.count())) break;
    prompts.push(await heading.innerText());
    await answer(page, 'I would plan and schedule everything in advance. I prefer to stay home alone and recharge, and I like the facts and the details. I think about the logic and the pros and cons.');
  }
  await expect(page.locator('.mpti__type')).toHaveText(/^[A-Z]{4}$/);
  expect(new Set(prompts).size).toBe(prompts.length);
  await expect(page.getByText(/not a validated psychological test/)).toBeVisible();
  await page.getByText(/What you said/).first().click();
  await expect(page.locator('.mpti__evidence q').first()).toContainText('recharge');
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(stored).not.toContain('recharge');
  // The person can overrule a dimension.
  const before = await page.locator('.mpti__type').innerText();
  await page.getByRole('group', { name: /Extraversion or Introversion/ }).getByRole('button', { name: 'E' }).click();
  expect((await page.locator('.mpti__type').innerText())[0]).toBe('E');
  expect(before).toHaveLength(4);
});

test('a vague answer triggers exactly one follow-up and skipping works', async ({ page }) => {
  await page.goto('/mpti/');
  await page.getByRole('button', { name: 'Type instead' }).click();
  const first = await page.locator('.mpti__prompt').innerText();
  await answer(page, 'Maybe.');
  await expect(page.getByText(/quick follow-up/)).toBeVisible();
  expect(await page.locator('.mpti__prompt').innerText()).not.toBe(first);
  await answer(page, 'It depends.');
  await expect(page.getByText(/Question 2/)).toBeVisible();
  await page.getByRole('button', { name: 'Skip this question' }).click();
  await expect(page.getByText(/Question 3/)).toBeVisible();
});

test('without speech support, voice is disabled and typing works; mobile has no overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; });
  await page.goto('/mpti/');
  await expect(page.getByRole('button', { name: /Talk it through/ })).toBeDisabled();
  await expect(page.getByText(/not supported in this browser/)).toBeVisible();
  await page.getByRole('button', { name: 'Type instead' }).click();
  await expect(page.getByRole('button', { name: /Answer by voice/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('microphone permission denial falls back to typing with a clear message', async ({ page }) => {
  await page.addInitScript(() => {
    window.SpeechRecognition = window.webkitSpeechRecognition = class { start() { setTimeout(() => { this.onerror?.({ error: 'not-allowed' }); this.onend?.(); }, 10); } stop() {} abort() {} };
  });
  await page.goto('/mpti/');
  await page.getByRole('button', { name: /Talk it through/ }).click();
  await page.getByRole('button', { name: /Answer by voice/ }).click();
  await expect(page.getByText(/Microphone access was blocked/)).toBeVisible();
  await answer(page, 'I would stay home and recharge alone, I think.');
  await expect(page.getByText(/Question 2/)).toBeVisible();
});

test('voice transcript fills the editable answer box', async ({ page }) => {
  await page.addInitScript(() => {
    window.SpeechRecognition = window.webkitSpeechRecognition = class {
      start() { setTimeout(() => this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: 'I love meeting new people' }], { isFinal: true })] }), 10); }
      stop() { this.onend?.(); } abort() {}
    };
  });
  await page.goto('/mpti/');
  await page.getByRole('button', { name: /Talk it through/ }).click();
  await page.getByRole('button', { name: /Answer by voice/ }).click();
  await expect(page.getByLabel('Your answer')).toHaveValue('I love meeting new people');
});
