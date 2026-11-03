export type Dimension = 'EI' | 'SN' | 'TF' | 'JP';
export type Pole = 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P';
export type Confidence = 'unclear' | 'low' | 'medium' | 'high';

export interface Scenario {
  id: string;
  dimension: Dimension;
  prompt: string;
  /** Asked once if the answer carries no signal for this scenario's dimension. */
  followUp: string;
}

export interface Answer {
  scenarioId: string;
  /** What the person said or typed for the scenario, joined with any follow-up answer. */
  text: string;
  skipped: boolean;
}

export interface Evidence {
  pole: Pole;
  /** The person's own sentence, quoted. */
  quote: string;
  /** The cue phrase that matched. */
  cue: string;
  scenarioId: string;
}

export interface DimensionResult {
  dimension: Dimension;
  /** The leaning pole, or null when evidence is missing or tied. */
  preference: Pole | null;
  confidence: Confidence;
  /** -1..1 toward the first pole of the pair (E, S, T, J). */
  lean: number;
  evidence: Evidence[];
}

export interface Profile {
  type: string;
  dimensions: Record<Dimension, DimensionResult>;
  answered: number;
  limitations: string;
}
