import { z } from 'zod';
import { OPTION_IDS, ROLES, type OptionId, type Role } from './types';

const nonEmpty = z.string().min(1);

const optionId = z.enum(OPTION_IDS as [OptionId, ...OptionId[]]);
const roleId = z.enum(ROLES as [Role, ...Role[]]);

const role = z.object({
  id: roleId,
  name: nonEmpty,
  blurb: nonEmpty,
});

// An option is its letter and its full text. There are no short labels: every screen shows the letter, the text, or both.
const option = z.object({
  id: optionId,
  text: nonEmpty,
});

// The screens put option i under letter OPTION_IDS[i], so the file must list A, B and C in that order.
const options = z.array(option).length(OPTION_IDS.length)
  .refine((list) => list.every((o, i) => o.id === OPTION_IDS[i]), { message: 'options must be A, B and C in order' });

const round = z.object({
  id: z.enum(['power', 'demand', 'competition', 'risk', 'core']),
  boss: nonEmpty,
  problem: nonEmpty,
  question: nonEmpty,
  options,
});

export const ContentSchema = z.object({
  title: nonEmpty,
  roles: z.array(role).length(4),
  rounds: z.array(round).length(5),
  ending: z.object({ title: nonEmpty, text: nonEmpty }),
  settings: z.object({
    voteSeconds: z.number().positive(),
    maxCallouts: z.number().int().nonnegative(),
  }),
});

export type CaseContent = z.infer<typeof ContentSchema>;
export type RoundContent = CaseContent['rounds'][number];

export function loadContent(raw: unknown): CaseContent {
  return ContentSchema.parse(raw);
}
