import type { Rules } from '../engine/rules';

interface Props { rules: Rules; onChange: (r: Rules) => void; disabled?: boolean }

export default function RulesPanel({ rules, onChange, disabled }: Props) {
  const set = <K extends keyof Rules>(k: K, v: Rules[K]) => onChange({ ...rules, [k]: v });
  return (
    <fieldset className="bj-rules" disabled={disabled}>
      <legend>Table rules</legend>
      <label>Decks
        <select value={rules.decks} onChange={(e) => set('decks', Number(e.target.value) as Rules['decks'])}>
          <option value={4}>4</option><option value={6}>6</option><option value={8}>8</option>
        </select>
      </label>
      <label>Dealer on soft 17
        <select value={rules.dealerHitsSoft17 ? 'h17' : 's17'} onChange={(e) => set('dealerHitsSoft17', e.target.value === 'h17')}>
          <option value="h17">Hits (H17)</option><option value="s17">Stands (S17)</option>
        </select>
      </label>
      <label>Blackjack pays
        <select value={rules.blackjackPayout} onChange={(e) => set('blackjackPayout', Number(e.target.value) as Rules['blackjackPayout'])}>
          <option value={1.5}>3 to 2</option><option value={1.2}>6 to 5</option>
        </select>
      </label>
      <label>Double on
        <select value={rules.doubleOn} onChange={(e) => set('doubleOn', e.target.value as Rules['doubleOn'])}>
          <option value="any">Any two cards</option><option value="9-11">Hard 9–11</option><option value="10-11">Hard 10–11</option>
        </select>
      </label>
      <label className="bj-rules__check"><input type="checkbox" checked={rules.doubleAfterSplit} onChange={(e) => set('doubleAfterSplit', e.target.checked)} /> Double after split</label>
      <label className="bj-rules__check"><input type="checkbox" checked={rules.lateSurrender} onChange={(e) => set('lateSurrender', e.target.checked)} /> Late surrender</label>
      <label className="bj-rules__check"><input type="checkbox" checked={rules.resplitAces} onChange={(e) => set('resplitAces', e.target.checked)} /> Re-split aces</label>
      <label>Shoe penetration: {Math.round(rules.penetration * 100)}%
        <input type="range" min={50} max={85} step={5} value={Math.round(rules.penetration * 100)} onChange={(e) => set('penetration', Number(e.target.value) / 100)} />
      </label>
    </fieldset>
  );
}
