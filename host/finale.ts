// The pure side of the ending: the room is congratulated, and the last question's split is shown with who picked
// each option. The words come from the content, the counts and names from the view. Nothing is scored, so nothing is
// ranked. No Phaser and no DOM, so all of it is tested.
import type { CaseContent } from '../shared/content';
import { OPTION_IDS, type HostView, type Player } from '../shared/types';
import type { EndingArgs } from './hud/Hud';

/** How many names one column shows; the rest are counted as "and N more", so a big class still fits the screen. */
export const NAMES_SHOWN = 30;

const byJoinThenId = (a: Player, b: Player): number => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * The ending screen. Each column's count is the view's tally of the last round, so hand counts and bots are in it;
 * its names are the players whose last-round vote is that letter, in the order they joined, which is why a column can
 * name fewer than it counts. With names hidden (H) a column has its count only.
 */
export function endingArgs(content: CaseContent, view: HostView): EndingArgs {
  const lastIndex = content.rounds.length - 1;
  const last = content.rounds[lastIndex];
  const players = Object.values(view.players).sort(byJoinThenId);
  return {
    title: content.ending.title,
    text: content.ending.text,
    question: last.question,
    columns: OPTION_IDS.map((letter, i) => {
      const voters = view.hideNames ? [] : players.filter((p) => p.votes[lastIndex]?.option === letter);
      return {
        letter,
        text: last.options[i].text,
        count: view.tally[letter],
        names: voters.slice(0, NAMES_SHOWN).map((p) => p.name),
        more: Math.max(0, voters.length - NAMES_SHOWN),
      };
    }),
  };
}
