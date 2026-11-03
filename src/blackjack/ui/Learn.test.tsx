import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DEFAULT_RULES } from '../engine/rules';
import { emptyProgress, suggestions } from '../engine/stats';
import { strategyQuestion, explain } from '../engine/drills';
import { mulberry32 } from '../engine/rng';
import Learn from './Learn';

const BRITISH = /practis|memoris|favour|colour|centre|behaviour/i;

describe('American English spelling', () => {
  it('the manual says "practice", never "practise"', () => {
    const { container } = render(<Learn rules={DEFAULT_RULES} go={vi.fn()} />);
    const text = container.textContent!;
    expect(text).not.toMatch(BRITISH);
    expect(text).toMatch(/practicing on/);
    expect(text).toMatch(/Practice true count/);
  });
  it('drill suggestions and explanations use American spelling', () => {
    const p = { ...emptyProgress(), trueCount: { right: 0, total: 5 } };
    expect(suggestions(p).join(' ')).not.toMatch(BRITISH);
    const rng = mulberry32(3);
    for (let i = 0; i < 300; i++) expect(explain(strategyQuestion(rng, DEFAULT_RULES))).not.toMatch(BRITISH);
  });
});
