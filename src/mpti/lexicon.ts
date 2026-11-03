import type { Pole } from './types';

export interface Cue { pole: Pole; pattern: RegExp; label: string; weight: number }

// Transparent, hand-written cues. Each is a phrase a person might use when describing
// how they approach a situation. They are a rough first-pass signal, not a validated
// instrument. Weight 2 = fairly direct statement; 1 = weaker hint.
const c = (pole: Pole, label: string, pattern: string, weight = 1): Cue =>
  ({ pole, label, pattern: new RegExp(`\\b(?:${pattern})\\b`, 'i'), weight });

export const CUES: Cue[] = [
  // Extraversion
  c('E', 'seeking people', 'meet(?:ing)? (?:new )?people|talk to (?:everyone|people|strangers)|socializ\\w*|mingl\\w*|go (?:out )?with friends|invite (?:everyone|friends)|more the merrier', 2),
  c('E', 'energized by others', 'energi[sz]ed? (?:by|from) (?:people|others|the crowd)|love (?:big |crowded )?(?:crowds|parties|groups)|thrive around|feed off', 2),
  c('E', 'thinking out loud', 'think(?:ing)? out loud|talk (?:it|things) (?:out|through)|bounce (?:ideas|it) off|throw out ideas|brainstorm\\w*', 1),
  c('E', 'outgoing', 'outgoing|extrovert\\w*|social butterfly|life of the party|jump right in', 1),
  // Introversion
  c('I', 'needing solitude', 'alone|by myself|on my own|solo|quiet (?:time|night|evening|place)|recharge|me time|time to myself', 2),
  c('I', 'drained by crowds', 'drain\\w*|overwhelm\\w*|exhaust\\w*|too many people|crowded?|crowds?|small talk', 1),
  c('I', 'prefers small groups', 'one[- ]on[- ]one|close friends|small group|a few (?:people|friends)|stay (?:in|home)|at home', 1),
  c('I', 'reflects first', 'think (?:it|things) (?:over|through) (?:first|alone|on my own)|reflect\\w*|process (?:it|things) (?:internally|myself|alone)|observe first|watch first|listen first', 2),
  // Sensing
  c('S', 'concrete facts', 'facts?|details?|specific\\w*|concrete|practical\\w*|realistic|hands[- ]on|step[- ]by[- ]step|what(?:\'s| is) actually|proven|tried and (?:true|tested)|real[- ]world|evidence', 2),
  c('S', 'past experience', 'past experience|what worked (?:before|last time)|how (?:it|we) (?:did|have done) (?:it )?before|experience (?:tells|shows)|(?:the )?tried[- ]and[- ]true|standard way', 2),
  c('S', 'present and tangible', 'right now|in front of me|what I can (?:see|touch|measure)|actual\\w*|tangible|exactly what|the basics|one thing at a time', 1),
  // iNtuition
  c('N', 'possibilities', 'possibilit\\w+|what if|imagin\\w+|big picture|bigger picture|vision\\w*|potential|innovat\\w+|unusual|creative\\w*|new (?:idea|approach|way)', 2),
  c('N', 'patterns and meaning', 'pattern\\w*|connect(?:ion|ions|ing)? (?:the )?(?:dots|ideas)|meaning|theor\\w+|abstract\\w*|metaphor\\w*|underlying|bigger meaning|long[- ]term implications?', 2),
  c('N', 'future-oriented', 'future|someday|down the (?:road|line)|where (?:this|it) could (?:go|lead)|intuition|gut (?:feeling|sense)|hunch', 1),
  // Thinking
  c('T', 'logic and analysis', 'logic\\w*|analy[sz]\\w*|rational\\w*|objective\\w*|pros and cons|weigh (?:the )?(?:options|pros)|criteria|data|trade[- ]?offs?|efficien\\w+|cost[- ]benefit|fair(?:ness)? to everyone', 2),
  c('T', 'impersonal decision', 'what makes (?:the most )?sense|the (?:best|right) (?:answer|solution|decision) (?:is|for the)|most effective|regardless of (?:feelings|how)|not (?:take it )?personal(?:ly)?|facts over feelings|critique\\w*|honest feedback|blunt\\w*', 2),
  c('T', 'problem-solving first', 'figure out (?:the )?(?:problem|cause)|fix (?:the|it)|troubleshoot\\w*|root cause|solve (?:the|it)|debug\\w*', 1),
  // Feeling
  c('F', 'people and feelings', 'feel(?:ing|ings)?|emotion\\w*|how (?:they|everyone|he|she) (?:feel|feels|would feel)|hurt\\w*|upset|comfort\\w*|empath\\w+|compassion\\w*|kind(?:ness)?|support(?:ive|ing)? (?:them|her|him|my friend)', 2),
  c('F', 'values and harmony', 'values?|harmony|get along|keep the peace|everyone (?:is )?(?:included|happy|comfortable)|care (?:about|for) (?:them|people|everyone)|relationships?|friendship|loyal\\w*|what matters to (?:them|people)', 2),
  c('F', 'personal considerations', 'be there for|check (?:in )?on|listen to (?:them|her|him|my friend)|make (?:them|sure they) feel|treat (?:them|people) (?:well|kindly)|worry about (?:them|how)', 1),
  // Judging
  c('J', 'planning ahead', 'plan\\w*|schedul\\w+|organi[sz]\\w+|list|calendar|agenda|ahead of time|in advance|prepar\\w+|deadline\\w*|checklist', 2),
  c('J', 'closure and structure', 'decide (?:quickly|early|right away)|finali[sz]\\w+|settle (?:on|it)|stick to (?:the|my) plan|on time|get it (?:done|over with)|structure\\w*|routine|order(?:ly)?|commit\\w*', 2),
  c('J', 'wants certainty', 'need to know|prefer to know|hate (?:surprises|uncertainty)|clear (?:expectations|plan)|lock (?:it )?in|book(?:ed)? (?:it|early)', 1),
  // Perceiving
  c('P', 'spontaneity', 'spontaneous\\w*|improvis\\w+|wing it|go with the flow|see (?:how|what) (?:it|things) (?:goes|go|happens|feels)|play it by ear|last[- ]minute|in the moment|figure it out as I go|on a whim', 2),
  c('P', 'keeping options open', 'keep (?:my |our )?options open|flexible|flexibility|adapt\\w*|open[- ]ended|not commit|decide later|wait and see|leave (?:it|room) open|change (?:my )?(?:mind|plans)', 2),
  c('P', 'deadline energy', 'procrastinat\\w+|until the (?:last minute|deadline)|pressure helps|explore (?:first|more|options)|more information first|one more option', 1),
];
