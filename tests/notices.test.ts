// @vitest-environment happy-dom
// What the projector says about its link to the room (host/notices.ts, wired up in host/main.ts).
import { describe, expect, it } from 'vitest';
import { connectionNotices } from '../host/notices';

/** Records what the page would show: each toast with its time (0 is the sticky slot), and each clearToast(). */
function fakeHud() {
  const shown: [string, number][] = [];
  return {
    shown,
    hud: {
      showToast: (text: string, ms?: number) => { shown.push([text, ms ?? 4000]); },
      clearToast: () => { shown.push(['clear', 0]); },
    },
  };
}

describe('connection notices', () => {
  it('say nothing for the first open, keep "Reconnecting to the room" up through a drop, and say "Connected" once back', () => {
    const { hud, shown } = fakeHud();
    const notice = connectionNotices(hud);
    notice('open');
    expect(shown).toEqual([]);
    notice('closed');
    expect(shown).toEqual([['Reconnecting to the room', 0]]);
    notice('open');
    expect(shown).toEqual([['Reconnecting to the room', 0], ['clear', 0], ['Connected', 1500]]);
    notice('open');
    expect(shown).toHaveLength(3);
  });

  it('say the room has closed, in the sticky slot, when the room is gone, and nothing more after it', () => {
    const { hud, shown } = fakeHud();
    const notice = connectionNotices(hud);
    notice('open');
    notice('closed');
    notice('gone');
    expect(shown).toEqual([['Reconnecting to the room', 0], ['The room has closed. Reload the page for a new room', 0]]);
    notice('open');
    expect(shown).toHaveLength(2);
  });
});
