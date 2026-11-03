import { describeRules, type Rules } from '../engine/rules';
import HiLoLegend from './HiLoLegend';
import StrategyChart from './StrategyChart';

type Go = (tab: 'practice' | 'play', drill?: 'quiz' | 'count' | 'truecount') => void;

export default function Learn({ rules, go }: { rules: Rules; go: Go }) {
  return (
    <div className="bj-learn">
      <section aria-labelledby="l1">
        <h3 id="l1">1 · The game in one minute</h3>
        <p>Get closer to 21 than the dealer without going over. Number cards are worth their number, J, Q and K are 10, and an ace is 1 or 11, whichever helps. A two-card 21 is a blackjack and pays extra. The dealer shows one card and keeps one face down, and must hit until 17 or more.</p>
        <p>After the deal you choose: <strong>hit</strong> (take a card), <strong>stand</strong>, <strong>double</strong> (double your bet, take exactly one card), <strong>split</strong> a pair into two hands, or <strong>surrender</strong> (give up half your bet, if the table allows it).</p>
      </section>

      <section aria-labelledby="l2">
        <h3 id="l2">2 · Table rules matter</h3>
        <p>You are practicing on: <strong>{describeRules(rules)}</strong>. Change the rules in the panel above; the chart below changes with them. Standing on soft 17 (S17) and 3:2 blackjack are better for the player than H17 and 6:5. Basic strategy is not the same at every table.</p>
        <p>This trainer assumes the dealer peeks for blackjack (US style). When the dealer shows an ace you are offered insurance, a side bet of half your wager that pays 2:1 if the dealer has blackjack. Basic strategy always declines it; card counters take it only at high counts, which this trainer does not score.</p>
      </section>

      <section aria-labelledby="l3">
        <h3 id="l3">3 · Basic strategy chart</h3>
        <p>For every hand and dealer upcard there is one best play. Memorize the pattern: stand on stiff hands only when the dealer is weak (2–6), double on 10 and 11 against most upcards, split aces and eights. Shortcuts have rule-dependent exceptions: with late surrender at an H17 table, 8,8 against an ace is surrendered, not split, and hard 17 against an ace is surrendered too. The chart shows the exact play.</p>
        <StrategyChart rules={rules} />
        <p>Even with perfect play the house keeps a small edge, around half a percent at some favorable rules, and more at others. Basic strategy lowers the cost of playing; it does not guarantee winning.</p>
        <button type="button" className="px-btn px-btn--primary" onClick={() => go('practice', 'quiz')}>Quiz me on this</button>
      </section>

      <section aria-labelledby="l4">
        <h3 id="l4">4 · Counting with Hi-Lo</h3>
        <p>A shoe that is rich in tens and aces is better for you: more blackjacks (paid 3:2), better doubles, and more dealer busts. So when low cards leave the shoe, what remains is richer in high cards. Hi-Lo tracks that with one running number: add 1 for each low card you see, subtract 1 for each high card, nothing for the middle cards. A positive count means the remaining cards favor you. Count only cards you can see, including the dealer’s hole card once it is turned over.</p>
        <p>The Grandmaster campaign uses Wong Halves, a finer count: 2 = +0.5; 3, 4, 6 = +1; 5 = +1.5; 7 = +0.5; 8 = 0; 9 = −0.5; tens and aces = −1. It is more accurate and much harder to keep.</p>
        <HiLoLegend />
        <p>The count carries over from hand to hand and resets only when the shoe is reshuffled. The drills remove the hints in stages: guided, color only, cards only, then speed.</p>
        <button type="button" className="px-btn px-btn--primary" onClick={() => go('practice', 'count')}>Start counting drills</button>
      </section>

      <section aria-labelledby="l5">
        <h3 id="l5">5 · True count</h3>
        <p>A running count of +6 means more with 2 decks left than with 6. So divide by the decks remaining: <strong>true count = running count ÷ decks remaining</strong>. Example: running count +8 with about 4 decks left is a true count of +2.</p>
        <p>Conventions used here: decks remaining are estimated in half-deck steps, and the result is truncated toward zero (+7 ÷ 4 = +1.75 → +1).</p>
        <button type="button" className="px-btn px-btn--primary" onClick={() => go('practice', 'truecount')}>Practice true count</button>
      </section>

      <section aria-labelledby="l6">
        <h3 id="l6">6 · Practice betting and its limits</h3>
        <p>In the campaign (Operator and Grandmaster) you choose a virtual bet before each round, and it is scored against an illustrative schedule: 1 unit at true count +1 or lower, 2 at +2, 4 at +3, 6 at +4 or more. That is a teaching rubric. It is not advice, and it does not claim to be the best spread.</p>
        <p>A high count does not mean the next hand will win. Edge, variance and risk are different things: a small advantage still loses often. There is no real money anywhere in this app.</p>
        <button type="button" className="px-btn px-btn--primary" onClick={() => go('play')}>Go to the campaign</button>
      </section>
    </div>
  );
}
