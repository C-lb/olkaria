// The room this tab is hosting. A reload of the host page reads it back and returns to the same room instead of
// opening a new one. It lives in sessionStorage, so it belongs to this tab and goes when the tab does.
const KEY = 'olkaria.room';

export interface RememberedRoom { code: string; hostKey: string }

// Every access is guarded: with site data blocked, a browser can throw from the getter as well as from the methods.
// A tab that cannot remember simply opens a fresh room after a reload.

export function rememberRoom(code: string, hostKey: string): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ code, hostKey }));
  } catch {
    // not remembered
  }
}

/** The remembered room, or null when there is none or what is stored is not a room. */
export function recallRoom(): RememberedRoom | null {
  try {
    const stored = sessionStorage.getItem(KEY);
    if (stored === null) return null;
    const saved: unknown = JSON.parse(stored);
    if (typeof saved !== 'object' || saved === null) return null;
    const { code, hostKey } = saved as Record<string, unknown>;
    return typeof code === 'string' && code !== '' && typeof hostKey === 'string' && hostKey !== '' ? { code, hostKey } : null;
  } catch {
    return null;
  }
}

export function forgetRoom(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing that could be cleared
  }
}
