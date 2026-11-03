import { chartMove, type Move } from '../engine/strategy';
import { canDoubleTotal, describeRules, type Rules } from '../engine/rules';
import type { Card, Rank } from '../engine/cards';

const UPS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const c = (rank: Rank, suit: Card['suit'] = 'S'): Card => ({ rank, suit });
const upcard = (v: number): Card => c(v === 11 ? 'A' : v === 10 ? '10' : (String(v) as Rank), 'D');

function hardHand(total: number): Card[] {
  if (total <= 11) return [c('2'), c(String(total - 2) as Rank, 'H')];
  if (total === 18) return [c('10'), c('8', 'H')];
  return [c('10'), c(String(total - 10) as Rank, 'H')];
}

interface Row { label: string; cards: Card[]; pair: boolean; total: number; soft: boolean }
const rows = (): { title: string; rows: Row[] }[] => [
  // 5-8 always share a row; 17 has its own row because H17 surrenders it against an ace, and 18+ always stands.
  { title: 'Hard totals', rows: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((t) => ({ label: t === 8 ? '5–8' : t === 18 ? '18+' : String(t), cards: hardHand(t), pair: false, total: t, soft: false })) },
  { title: 'Soft totals', rows: [2, 3, 4, 5, 6, 7, 8, 9].map((x) => ({ label: `A,${x}`, cards: [c('A'), c(String(x) as Rank, 'H')], pair: false, total: 11 + x, soft: true })) },
  { title: 'Pairs', rows: (['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'] as Rank[]).map((r) => ({ label: `${r},${r}`, cards: [c(r), c(r, 'H')], pair: true, total: 0, soft: false })) },
];

const LABEL: Record<Move, string> = { H: 'H', S: 'S', D: 'D', Ds: 'Ds', P: 'P', Rh: 'Rh', Rs: 'Rs', Rp: 'Rp' };
const CLASS: Record<Move, string> = { H: 'hit', S: 'stand', D: 'double', Ds: 'double', P: 'split', Rh: 'surr', Rs: 'surr', Rp: 'surr' };
const WORDS: Record<Move, string> = { H: 'Hit', S: 'Stand', D: 'Double, otherwise hit', Ds: 'Double, otherwise stand', P: 'Split', Rh: 'Surrender, otherwise hit', Rs: 'Surrender, otherwise stand', Rp: 'Surrender, otherwise split' };

/** Cell text for a hand, with doubling restrictions of the current table rules applied. */
function cell(r: Row, up: number, rules: Rules) {
  const ctx = { canDouble: r.pair ? true : canDoubleTotal(rules, r.total, r.soft), canSplit: r.pair, canSurrender: rules.lateSurrender };
  let move = chartMove(r.cards, upcard(up), rules, r.pair).move;
  // Show the restriction as a plain hit/stand instead of a double that the table forbids.
  if (!ctx.canDouble && (move === 'D' || move === 'Ds')) move = move === 'D' ? 'H' : 'S';
  if (!ctx.canSurrender) move = move === 'Rh' ? 'H' : move === 'Rs' ? 'S' : move === 'Rp' ? 'P' : move;
  return move;
}

export default function StrategyChart({ rules }: { rules: Rules }) {
  return (
    <div className="bj-chart">
      <p className="bj-chart__rules">Chart for: <strong>{describeRules(rules)}</strong>. Dealer peeks for blackjack.</p>
      <div className="bj-chart__legend" aria-label="Legend">
        {(['H', 'S', 'D', 'Ds', 'P', 'Rh', 'Rs', 'Rp'] as Move[]).map((m) => (
          <span key={m} className={`bj-chart__key bj-chart__cell--${CLASS[m]}`}><b>{LABEL[m]}</b> {WORDS[m]}</span>
        ))}
      </div>
      {rows().map((g) => (
        <div key={g.title} className="bj-chart__scroll">
          <table className="bj-chart__table">
            <caption>{g.title}, your hand versus the dealer’s upcard</caption>
            <thead><tr><th scope="col">Hand</th>{UPS.map((u) => <th scope="col" key={u}>{u === 11 ? 'A' : u}</th>)}</tr></thead>
            <tbody>
              {g.rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  {UPS.map((u) => {
                    const m = cell(r, u, rules);
                    return <td key={u} className={`bj-chart__cell bj-chart__cell--${CLASS[m]}`} title={`${r.label} vs ${u === 11 ? 'A' : u}: ${WORDS[m]}`}><span aria-hidden="true">{LABEL[m]}</span><span className="visually-hidden">{WORDS[m]}</span></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
