/**
 * Stage 2: seven short, predefined social scenes. The dialogue is built around real human
 * recordings (CC0 or CC BY, see voiceCatalog.ts), so each recorded line is exactly what that
 * recording says. The situation text sets the scene; the character then says one short line, may ask
 * one clarifying question if the answer says little, and may sign off. Who the character is never feeds the scoring; only what
 * the person says does.
 */
import type { RubricCue } from '../analysis';
import type { PortraitSpec, Expression } from '../pixel/portraits';
import type { SceneId } from '../pixel/scenes';
import type { Dimension, Pole } from '../types';

export interface Scene {
  id: string;
  title: string;
  character: { name: string; meta: string; portrait: PortraitSpec };
  setting: SceneId;
  /** Narration shown on the card and in the call: what has happened before the character speaks. */
  situation: string;
  /** Said when the call connects, before the question. */
  greeting?: string;
  line: string;
  /** Asked once, only if the first answer gave no evidence for this scene's dimensions. */
  followUp: string;
  outro?: string;
  expression: Expression;
  dimensions: Dimension[];
  rubric: RubricCue[];
}

const r = (pole: Pole, label: string, pattern: string, weight = 2): RubricCue => ({ pole, label, weight, pattern: new RegExp(`\\b(?:${pattern})\\b`, 'i') });

export const SCENES: Scene[] = [
  {
    id: 'party',
    title: 'Party tonight',
    character: { name: 'Lena', meta: '24 · she/her · design student',
      portrait: { skin: '#f0c7a2', skinShade: '#d9a37e', hair: '#3a2420', hairShade: '#24150f', hairStyle: 'bun', clothes: '#e8b04b', clothesShade: '#c48a2c', collar: '#fdf7ee', blush: '#f09a85' } },
    setting: 'kitchen',
    situation: 'A friend is having a party tonight. Lena is getting ready and calls you.',
    line: 'What are you doing tonight?',
    followUp: 'What do you think?',
    expression: 'curious',
    dimensions: ['EI', 'JP'],
    rubric: [
      r('E', 'keen to go and be around people', "can'?t wait|let'?s go|(?:as )?(?:early|soon) as (?:we can|possible)|(?:meet|see) (?:everyone|people|new people)|the more the merrier|stay (?:until|till) the end|dance|so excited|love parties"),
      r('I', 'wanting a lower-key night', "not (?:sure|really) (?:I'?m|if I'?m) (?:going|up for)|leave early|(?:just )?(?:an|one) hour|stay (?:in|home)|quiet night|tired|recharge|not (?:a|much of a) party person|too many people"),
      r('J', 'wanting a set time', "(?:at|by|around) (?:\\d{1,2}|seven|eight|nine|ten)(?::\\d\\d)?(?: ?(?:pm|o'?clock))?|on time|already planned|(?:leave|go) at|set a time|plan(?:ned)? (?:it|ahead)"),
      r('P', 'happy to keep it loose', "whenever|no rush|see how I feel|(?:we'?ll )?see|play it by ear|go with the flow|last[- ]minute|spontaneous\\w*|whatever (?:time|works)"),
    ],
  },
  {
    id: 'interview',
    title: 'The interview',
    character: { name: 'Dr. Okoye', meta: '55 · she/her · head of product',
      portrait: { skin: '#7b4a2e', skinShade: '#5e3620', hair: '#1c1412', hairShade: '#3a2a22', hairStyle: 'curls', clothes: '#2c3e6b', clothesShade: '#1f2c4f', collar: '#fdf7ee', glasses: true, earrings: true, blush: '#9a5a3e', lines: true } },
    setting: 'office',
    situation: 'Dr. Okoye leads a small product team. She has read your application and asks you straight out.',
    line: 'Have you ever had any experience?',
    followUp: 'What do you mean by that?',
    expression: 'neutral',
    dimensions: ['SN', 'TF', 'JP'],
    rubric: [
      r('S', 'wanting clear, concrete work', "clear (?:goals|tasks|expectations|instructions)|(?:concrete|practical|hands[- ]on)|step by step|details|proven|what (?:has|was) (?:been )?(?:tried|done) before|examples"),
      r('N', 'drawn to ideas and the bigger picture', "big(?:ger)? picture|new ideas|creative\\w*|innovat\\w+|vision|explore|imagine|possibilit\\w+|what if|experiment with ideas"),
      r('T', 'valuing results and direct feedback', "direct (?:feedback|communication)|honest feedback|results|efficien\\w+|logic\\w*|data|measur\\w+|objective\\w*|merit|competent"),
      r('F', 'valuing people and a good team', "(?:good|kind|supportive|friendly) (?:team|people|culture|atmosphere)|(?:help|support|mentor)\\w* (?:people|others|each other)|respect\\w*|appreciat\\w+|feel (?:valued|heard)|collaborat\\w+|harmony"),
      r('J', 'liking structure and plans', "structure\\w*|deadlines?|organi[sz]\\w+|schedul\\w+|plan(?:ned|ning)? ahead|roadmap|clear process|predictab\\w+|routine"),
      r('P', 'liking freedom and flexibility', "flexib\\w+|freedom|autonom\\w+|my own (?:way|pace)|adapt\\w*|variety|figure (?:it|things) out as I go|switch between|try (?:things|stuff)"),
    ],
  },
  {
    id: 'two-programs',
    title: 'The big decision',
    character: { name: 'Jordan', meta: '18 · he/him · about to start university',
      portrait: { skin: '#e0ac85', skinShade: '#c48a62', hair: '#4a3020', hairShade: '#2e1c12', hairStyle: 'short', clothes: '#4f9a6c', clothesShade: '#3a7a52', collar: '#e8dcc6', blush: '#e89a7a' } },
    setting: 'diner',
    situation: 'Over milkshakes, Jordan explains he got into two programs: a practical one with a near-certain job, and one he loves that is riskier. Then he looks at you.',
    line: 'What shall I do?',
    followUp: 'What do you mean?',
    expression: 'thinking',
    dimensions: ['TF', 'SN'],
    rubric: [
      r('T', 'weighing outcomes and trade-offs', "pros and cons|weigh\\w*|compare|job (?:market|prospects)|salary|stability|financ\\w+|numbers|long[- ]term (?:security|earnings)|logical\\w*|cost"),
      r('F', 'centring what matters to him', "what you (?:love|enjoy|care about)|follow your (?:heart|passion)|happ(?:y|iness)|passion\\w*|what matters to you|fulfil\\w*|regret|your values|how you(?:'d| would) feel"),
      r('S', 'looking at the concrete realities', "practical\\w*|guaranteed|proven|concrete|real[- ]world|track record|what (?:actually )?happens|facts"),
      r('N', 'imagining where each path could lead', "potential|future|possibilit\\w+|imagine|where (?:it|this|each) could (?:lead|go)|bigger picture|open (?:doors|up)|vision"),
    ],
  },
  {
    id: 'walters-leap',
    title: 'A leap',
    character: { name: 'Walter', meta: '68 · he/him · retired bus driver',
      portrait: { skin: '#f3d2bd', skinShade: '#d8ab92', hair: '#d6dade', hairShade: '#a9aeb5', hairStyle: 'grey-sides', clothes: '#8a5a44', clothesShade: '#6b4433', collar: '#bcd7ee', mustache: true, lines: true, blush: '#e8a08a' } },
    setting: 'living',
    situation: 'You have just told Walter, your neighbour, that you are thinking of leaving a steady job to travel for a year.',
    line: 'Did you really think it through?',
    followUp: 'Do you really think so?',
    expression: 'curious',
    dimensions: ['SN', 'JP'],
    rubric: [
      r('S', 'grounding it in practical footing', "savings|saved (?:up|money)|budget|(?:a )?safety net|practical\\w*|realistic|bills|insurance|(?:a )?job (?:lined up|to come back to)|what I know works"),
      r('N', 'drawn to the possibility and meaning', "follow (?:a|your|my) (?:hunch|gut|instinct)|intuition|adventure|new experience|see what'?s out there|possibilit\\w+|meaning|once in a lifetime|grow as a person"),
      r('J', 'having planned it', "(?:yes|yeah),? I (?:have|did)|planned|plan (?:it|first|ahead)|thought (?:it|this) through|prepar\\w+|organi[sz]\\w+|worked out|research\\w*|itinerary|timeline"),
      r('P', 'ready to leap and adapt', "just go|jump|leap|spontaneous\\w*|on a whim|why not|figure it out (?:on the way|as I go|later)|go with the flow|not (?:everything|all of it)|see what happens"),
    ],
  },
  {
    id: 'destiny',
    title: 'A different view',
    character: { name: 'Maya', meta: '34 · she/her · book club friend',
      portrait: { skin: '#c69274', skinShade: '#a8755a', hair: '#2a1d1a', hairShade: '#4a3a34', hairStyle: 'bob', clothes: '#d98a5a', clothesShade: '#b56a3e', collar: '#f4ecdf', earrings: true, blush: '#d0846a' } },
    setting: 'park',
    situation: 'Walking home from book club, Maya says she has always felt some things are simply meant to be. Then she adds:',
    line: 'Everyone, when they are young, knows what their destiny is.',
    followUp: 'Why do you see it that way?',
    expression: 'curious',
    dimensions: ['TF', 'SN'],
    // Only how the person reasons and communicates is read here. Agreeing or disagreeing, and any belief
    // itself, is never evidence: there are deliberately no cues for "I agree", faith, religion or doubt.
    rubric: [
      r('T', 'reasoning from evidence and logic', "evidence|proof|logic\\w*|rational\\w*|cause and effect|(?:does|doesn'?t) (?:add up|make sense)|objectiv\\w+|statistic\\w*|probabilit\\w+|coincidence"),
      r('F', 'leading with respect for her view', "respect (?:that|your|you|it)|if it (?:helps|comforts) you|(?:I )?(?:can )?understand why|meaningful (?:to|for) you|that'?s (?:lovely|beautiful)|I like that you|be kind"),
      r('N', 'thinking in terms of meaning and connection', "bigger picture|connected|interconnected|purpose|patterns?|symbol\\w*|deeper meaning|the universe"),
      r('S', 'grounding it in lived experience', "in my experience|what actually happens|day[- ]to[- ]day|real life|concrete|facts|what I can see"),
    ],
  },
  {
    id: 'weekend',
    title: 'Getting everyone together',
    character: { name: 'Sam', meta: '41 · they/them · organises the group',
      portrait: { skin: '#c58c5f', skinShade: '#a46d45', hair: '#2fa39a', hairShade: '#1f2a33', hairStyle: 'swoop', clothes: '#7b5cd6', clothesShade: '#5c43a8', collar: '#ffd166', earrings: true, blush: '#d98a6a' } },
    setting: 'apartment',
    situation: 'Sam wants to get your whole friend group together this week. Nothing is fixed yet.',
    line: 'Can we plan on doing it on Tuesday?',
    followUp: 'How do you mean?',
    outro: 'See you later!',
    expression: 'happy',
    dimensions: ['JP', 'EI', 'TF'],
    rubric: [
      r('J', 'fixing it in advance', "(?:yes|yeah|sure),? (?:Tuesday|let'?s (?:do|lock|book))|book\\w*|reserv\\w+|set a time|schedul\\w+|(?:a )?poll|decide (?:now|early|today|ahead)|lock (?:it )?in|calendar|confirm"),
      r('P', 'keeping it open', "see (?:how|what) (?:the week|people|everyone) (?:goes|feels?|wants?)|keep it open|decide on the day|wing it|flexib\\w+|loose plan|play it by ear|last[- ]minute|maybe"),
      r('E', 'making it bigger and more social', "invite (?:more|everyone|others)|bigger group|the more the merrier|meet (?:new )?people|party|everyone (?:should|can) come"),
      r('I', 'keeping it small and low-key', "small group|just a few|low[- ]key|quiet|one[- ]on[- ]one|not too many people|early night"),
      r('F', 'making sure everyone can come', "make sure everyone (?:can|is|feels)|what everyone wants|include everyone|nobody feels left out|works for everyone|ask (?:everyone|the group)"),
      r('T', 'deciding by a fair rule', "fair(?:est)? (?:way|option|rule)|vote|majority|most efficient|whatever makes (?:the most )?sense|most people can"),
    ],
  },
  {
    id: 'checking-in',
    title: 'Checking in',
    character: { name: 'Rosa', meta: '58 · she/her · your aunt',
      portrait: { skin: '#e8b996', skinShade: '#cc9876', hair: '#b9b2ad', hairShade: '#8f8984', hairStyle: 'bun', clothes: '#4a8a9a', clothesShade: '#356b78', collar: '#fdf7ee', glasses: true, earrings: true, lines: true, blush: '#e09a84' } },
    setting: 'porch',
    situation: 'Your aunt Rosa calls on a quiet evening, just to see how you are.',
    line: 'Are you well?',
    followUp: 'How are you feeling today?',
    expression: 'happy',
    dimensions: ['EI', 'TF'],
    rubric: [
      r('E', 'energised by seeing people', "(?:seeing|out with|hanging out with|catching up with) (?:friends|people|everyone)|so many (?:people|plans|events)|social|busy (?:week|weekend) with friends|went out"),
      r('I', 'recharging with quiet time', "quiet (?:time|week|weekend|evening)|time (?:to myself|alone)|on my own|at home|reading|recharg\\w+|needed a break from people"),
      r('T', 'describing things through what got done', "productive|got (?:a lot|things) done|progress|on track|work(?:'s| is) going (?:well|fine)|figur\\w+ out|problem|solv\\w+"),
      r('F', 'describing things through feelings and people', "I feel|feeling (?:good|happy|stressed|anxious|grateful|lonely)|grateful|people I love|my family|(?:been|felt) (?:happy|sad|stressed|overwhelmed|lonely)"),
    ],
  },
];

/** At least this many scenes before the results; all seven give the steadiest reading. */
export const MIN_SCENES = 4;
export const sceneById = (id: string): Scene | undefined => SCENES.find((s) => s.id === id);
