import { z } from 'zod';
import { ROLES, type OptionId, type Role } from './types';

export type SynergyTable = Record<OptionId, OptionId[][]>;

const nonEmpty = z.string().min(1);
const nonNegative = z.number().nonnegative();
const count = z.number().int().nonnegative();

const optionId = z.enum(['A', 'B', 'C', 'D']);
const roleId = z.enum(ROLES as [Role, ...Role[]]);

const role = z.object({
  id: roleId,
  stakeholder: nonEmpty,
  className: nonEmpty,
  blurb: nonEmpty,
});

const option = z.object({
  id: optionId,
  screen: nonEmpty,
  phone: nonEmpty.max(28),
  score: z.number().min(0).max(100).nullable(),
  debrief: z.string(),
  projector: z.string().max(130),
});

const round = z.object({
  id: z.enum(['grid', 'debt', 'fog', 'core']),
  boss: nonEmpty,
  lead: roleId,
  title: nonEmpty,
  narration: nonEmpty,
  discuss: nonEmpty,
  options: z.array(option).length(4),
});

// Four named keys rather than z.record: Zod 3 types a record keyed by an enum as
// Partial<Record<...>>, which is not a SynergyTable and accepts a table with a letter missing.
const synergyRow = z.array(z.array(optionId)).length(3);
const synergy: z.ZodType<SynergyTable> = z.object({ A: synergyRow, B: synergyRow, C: synergyRow, D: synergyRow });

const ending = z.object({
  title: nonEmpty,
  mustBeTrue: z.array(nonEmpty).min(1),
  risk: z.array(nonEmpty).min(1),
});

const exhibit = z.object({
  id: nonEmpty,
  text: nonEmpty,
  source: nonEmpty,
});

const scoring = z.object({
  roundHp: z.number().positive(),
  focusThreshold: z.number().min(0).max(1),
  focusBonus: nonNegative,
  alignmentBonus: nonNegative,
  casterBonus: nonNegative,
  exhibitBonus: nonNegative,
  maxExhibits: count,
  calloutBonus: nonNegative,
  maxCallouts: count,
  calloutPointsSpoke: nonNegative,
  calloutPointsAwarded: nonNegative,
  decisionBase: nonNegative,
  synergyBonus: nonNegative,
  speedBonusMax: nonNegative,
  voteSeconds: z.number().positive(),
  tiers: z.object({ decisive: nonNegative, fragile: nonNegative }),
});

export const ContentSchema = z.object({
  title: nonEmpty,
  roles: z.array(role).length(4),
  rounds: z.array(round).length(4),
  synergy,
  endings: z.object({
    A: ending,
    B: ending,
    C: ending,
    D: ending,
    holds: z.object({ title: nonEmpty, text: nonEmpty }),
  }),
  exhibits: z.array(z.array(exhibit).length(3)).length(4),
  quotes: z.object({ tanui: nonEmpty, ruto: nonEmpty, smith: nonEmpty }),
  scoring,
});

export type CaseContent = z.infer<typeof ContentSchema>;
export type RoundContent = CaseContent['rounds'][number];

export function loadContent(raw: unknown): CaseContent {
  return ContentSchema.parse(raw);
}
