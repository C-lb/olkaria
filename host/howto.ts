// How to play (spec 1): eight slides the facilitator shows on the projector before the game, one idea each, with a
// little motion and few words, so the room sees how the scoring works. This is the slide model: howtoSlides() reads
// the case content, every number from content.scoring, so a content edit carries through; the words are the spec's
// (section 3), verbatim. As on the character sheet, nothing gives away an option's score by its letter, a debrief
// line, or an ending title other than "The Deadlock holds". host/hud/HowTo.ts draws a slide; Hud.showHowTo shows it.
import type { CaseContent } from '../shared/content';
import { ROLES, type OptionId, type Role } from '../shared/types';
import { clockText } from './strikers';

/** The four classes, each with its class name ("Rogue") and its stakeholder ("Citizen"). */
export type Party = { role: Role; className: string; stakeholder: string }[];   // ROLES order

/**
 * One slide, in the order of spec section 3. On the round slide `hit` is the HP the boss has left after the example
 * strike, out of `hp`. On the damage slide each chunk's `width` is its part of the `hp` track. The ending's gauge runs
 * from 0 to `max`, with marks at `fragile` and `decisive`, and is filled to `fill`.
 */
export type HowToSlide =
  | { kind: 'title'; eyebrow: string; name: string; sub: string; party: Party; line: string }
  | { kind: 'join'; eyebrow: string; steps: string[] }
  | { kind: 'round'; eyebrow: string; boss: string; hp: number; question: string; options: { letter: OptionId; label: string }[]; clock: string; hit: number; lines: string[] }
  | { kind: 'lead'; eyebrow: string; party: Party; lead: Role; halves: [string, string]; lines: string[] }
  | { kind: 'points'; eyebrow: string; chips: { label: string; value: string }[]; line: string }
  | { kind: 'damage'; eyebrow: string; hp: number; chunks: { label: string; note: string; width: number }[]; line: string }
  | { kind: 'ending'; eyebrow: string; lines: string[]; max: number; fragile: number; decisive: number; fill: number; holds: string }
  | { kind: 'awards'; eyebrow: string; items: string[] };

/** The HP the round slide's boss has left after the example strike: 62 of 100 (spec 3). */
const HIT = 62;

/** What the evidence behind a pick is worth: an option scores from 0 to 100 (shared/content.ts). */
const EVIDENCE = '0 to 100';

/** Counts the slides spell out ("Four bosses"), two to nine; any other count stays in digits. */
const COUNT_WORDS: Readonly<Record<number, string>> = { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine' };
const countWord = (n: number): string => COUNT_WORDS[n] ?? String(n);

/** The text with its first letter in lower case, to sit inside a sentence: "the Deadlock holds". */
const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

/** The content's four roles in ROLES order, with their class names and stakeholders. */
function partyOf(content: CaseContent): Party {
  return ROLES.map((role) => {
    const r = content.roles.find((x) => x.id === role);
    return { role, className: r?.className ?? role, stakeholder: r?.stakeholder ?? role };
  });
}

/** The eight slides of spec section 3, in order, from the case content. */
export function howtoSlides(content: CaseContent): HowToSlide[] {
  const s = content.scoring;
  const party = partyOf(content);
  const first = content.rounds[0];
  const last = content.rounds[content.rounds.length - 1];
  const bosses = content.rounds.length;
  // The title is "Olkaria: the Deadlock": the name over the rest.
  const colon = content.title.indexOf(': ');
  const name = colon === -1 ? content.title : content.title.slice(0, colon);
  const sub = colon === -1 ? '' : content.title.slice(colon + 2);
  // The bonuses drawn on the damage track, as the most each adds to one boss; one rally stands for the rallies.
  const exhibits = s.exhibitBonus * s.maxExhibits;
  const bonuses = s.focusBonus + s.alignmentBonus + exhibits + s.calloutBonus;
  const decider = party.find((p) => p.role === last.lead)?.stakeholder ?? last.lead;
  return [
    { kind: 'title', eyebrow: 'How to play', name, sub, party, line: 'Four classes. One party. Four bosses.' },
    { kind: 'join', eyebrow: 'Join', steps: ['Scan the code on the screen', 'Pick your class', 'Type your name'] },
    {
      kind: 'round',
      eyebrow: 'Each round, one boss',
      boss: first.boss,
      hp: s.roundHp,
      question: first.title,
      options: first.options.map((o) => ({ letter: o.id, label: o.phone })),
      clock: clockText(s.voteSeconds),
      hit: HIT,
      lines: ['Talk at your table. Vote on your phone.', 'The clock stops when everyone has voted.'],
    },
    {
      kind: 'lead',
      eyebrow: 'The lead class',
      party,
      lead: first.lead,
      halves: ['Lead class', 'The rest of the party'],
      lines: ['Every boss has a lead class.', 'Their votes are half the attack. Everyone else is the other half.'],
    },
    {
      kind: 'points',
      eyebrow: 'Your points',
      chips: [
        { label: 'Evidence behind your pick', value: EVIDENCE },
        { label: 'A fast vote', value: `up to +${s.speedBonusMax}` },
        { label: 'Your class leads this boss', value: `+${s.casterBonus}` },
        { label: 'Called out and you speak', value: `+${s.calloutPointsSpoke}` },
        { label: 'Called out and convincing', value: `+${s.calloutPointsAwarded}` },
      ],
      line: 'Points add up over four bosses. Top five at the end.',
    },
    {
      kind: 'damage',
      eyebrow: "The party's damage",
      hp: s.roundHp,
      chunks: [
        // The evidence is drawn as what is left to the full track, so the example fills it.
        { label: "Evidence behind the party's pick", note: EVIDENCE, width: Math.max(0, s.roundHp - bonuses) },
        { label: `Focus: ${Math.round(s.focusThreshold * 100)}% or more of you on one option`, note: `+${s.focusBonus}`, width: s.focusBonus },
        { label: 'Lead class and party agree', note: `+${s.alignmentBonus}`, width: s.alignmentBonus },
        { label: 'Exhibits found on the road', note: `+${s.exhibitBonus} each, up to ${s.maxExhibits}`, width: exhibits },
        { label: 'Rallies won', note: `+${s.calloutBonus} each, up to ${s.maxCallouts}`, width: s.calloutBonus },
      ],
      line: `${countWord(bosses)} bosses, ${s.roundHp} each. ${s.roundHp * bosses} in all.`,
    },
    {
      kind: 'ending',
      eyebrow: 'The last boss and the ending',
      lines: [`${decider} decides.`, 'Its options score by how well they fit what the party chose before.'],
      max: s.roundHp * bosses,
      fragile: s.tiers.fragile,
      decisive: s.tiers.decisive,
      fill: s.tiers.decisive,
      holds: `Under ${s.tiers.fragile}, ${lowerFirst(content.endings.holds.title)}.`,
    },
    { kind: 'awards', eyebrow: 'At the end', items: ['Top five players', 'Most consistent strategist', 'Top table'] },
  ];
}
