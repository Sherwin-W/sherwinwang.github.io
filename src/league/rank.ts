// Ranked tiers, divisions and LP mapped onto one ordered ladder, so progress toward a goal is a plain number.
//
// Every tier below Master has four divisions (IV, III, II, I), each worth 100 LP. Counting from Iron IV,
// a rank sits at `tierIndex * 4 + divisionIndex` whole divisions, plus LP / 100 of the next one:
//
//   steps(Gold II, 27 LP) = 3 * 4 + 2 + 0.27 = 14.27
//   progress = steps(current) / steps(goal), clamped to 0..1      (Diamond IV is 24 steps)
//
// Master, Grandmaster and Challenger have no divisions; they all sit above Diamond I.

export const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'] as const;
export const DIVISIONS = ['IV', 'III', 'II', 'I'] as const;

export type Tier = (typeof TIERS)[number];
export type Division = (typeof DIVISIONS)[number];

/** The tiers with no divisions; their LP is unbounded. */
const APEX: readonly Tier[] = ['MASTER', 'GRANDMASTER', 'CHALLENGER'];
const DIVIDED_TIERS = TIERS.length - APEX.length;

export interface Rank {
  tier: Tier;
  /** Absent for Master and above. */
  division?: Division;
  /** League points, or null when the value given was missing or not a number. */
  lp: number | null;
}

export const isApex = (tier: Tier) => APEX.includes(tier);

/** Reads an untrusted tier/division/LP triple. Returns null for anything that is not a real rank. */
export function parseRank(tier: unknown, division: unknown, lp: unknown): Rank | null {
  const t = typeof tier === 'string' ? tier.toUpperCase() : '';
  if (!(TIERS as readonly string[]).includes(t)) return null;
  const points = typeof lp === 'number' && Number.isFinite(lp) && lp >= 0 ? Math.floor(lp) : null;
  if (isApex(t as Tier)) return { tier: t as Tier, lp: points };
  const d = typeof division === 'string' ? division.toUpperCase() : '';
  if (!(DIVISIONS as readonly string[]).includes(d)) return null;
  // A divided tier holds 0-100 LP; anything above that is not a value Riot sends, so it is not trusted.
  return { tier: t as Tier, division: d as Division, lp: points !== null && points <= 100 ? points : null };
}

/** Whole divisions from Iron IV, plus the fraction of the current one. Apex tiers all count as the top. */
export function steps(rank: Rank): number {
  const t = TIERS.indexOf(rank.tier);
  if (isApex(rank.tier)) return DIVIDED_TIERS * DIVISIONS.length;
  const d = DIVISIONS.indexOf(rank.division ?? 'IV');
  // 100 LP means a promotion is pending, not yet the next division, so the fraction stops just short of it.
  return t * DIVISIONS.length + d + Math.min(rank.lp ?? 0, 99) / 100;
}

/** 0 at Iron IV 0 LP, 1 at the goal. Never above 1. */
export function progress(rank: Rank, goal: Rank): number {
  const end = steps({ ...goal, lp: 0 });
  if (end <= 0) return 1;
  return Math.min(1, Math.max(0, steps(rank) / end));
}

/** True once the rank is at or past the goal's tier and division. */
export function reached(rank: Rank, goal: Rank): boolean {
  return steps(rank) >= steps({ ...goal, lp: 0 });
}

/** The ladder position (0..1) where each tier from Iron up to the goal's tier begins, for tick marks. */
export function tierMarks(goal: Rank): { tier: Tier; at: number }[] {
  const end = steps({ ...goal, lp: 0 });
  const top = TIERS.indexOf(goal.tier);
  return TIERS.slice(0, top + 1).map((tier) => ({ tier, at: Math.min(1, steps({ tier, division: 'IV', lp: 0 }) / end) }));
}

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export const tierName = (tier: Tier) => titleCase(tier);

/** "Gold II", or "Master" for tiers without divisions. */
export const rankName = (rank: Pick<Rank, 'tier' | 'division'>) => (rank.division && !isApex(rank.tier) ? `${tierName(rank.tier)} ${rank.division}` : tierName(rank.tier));

export const lpText = (rank: Rank) => (rank.lp === null ? 'LP unavailable' : `${rank.lp} LP`);

/** Emblem image for a tier (Riot's official ranked emblems, resized). */
export const emblemSrc = (tier: Tier) => `${import.meta.env.BASE_URL}league/emblems/${tier.toLowerCase()}.webp`;
