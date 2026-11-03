// What the projector says about its link to the room, in the HUD's sticky toast slot. A drop keeps "Reconnecting to the
// room" up for as long as it lasts, and the reconnect takes it down with a short "Connected". A room that has closed
// under the page (the server wiped it after hours idle) says so until the page is reloaded, which makes a new room.
import type { Hud } from './hud/Hud';
import type { ConnectionStatus } from './net';

const RECONNECTING = 'Reconnecting to the room';
const CONNECTED = 'Connected';
const CONNECTED_MS = 1500;
const GONE = 'The room has closed. Reload the page for a new room';

/** The listener main.ts hands to client.onStatus. The first 'open' says nothing: only a return from a drop is news. */
export function connectionNotices(hud: Pick<Hud, 'showToast' | 'clearToast'>): (status: ConnectionStatus) => void {
  let dropped = false;
  return (status) => {
    if (status === 'gone') {
      dropped = false;
      hud.showToast(GONE, 0);
    } else if (status === 'closed') {
      dropped = true;
      hud.showToast(RECONNECTING, 0);
    } else if (dropped) {
      dropped = false;
      hud.clearToast();
      hud.showToast(CONNECTED, CONNECTED_MS);
    }
  };
}
