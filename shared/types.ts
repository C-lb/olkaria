export type OptionId = 'A' | 'B' | 'C' | 'D';
export const OPTION_IDS: readonly OptionId[] = ['A', 'B', 'C', 'D'];
export type Role = 'citizen' | 'government' | 'business' | 'microsoft';
export const ROLES: readonly Role[] = ['citizen', 'government', 'business', 'microsoft'];
export type Phase = 'lobby' | 'travel' | 'vote' | 'locked' | 'reveal' | 'ending' | 'leaderboard';
export type Tally = Record<OptionId, number>;
/** `points` is written at the reveal: what the vote earned in its round, call-out points included. */
export interface Vote { option: OptionId; at: number; points?: number }
export interface Player { id: string; name: string; role: Role; table: string | null; joinedAt: number; score: number; lastPoints: number; votes: Record<number, Vote> }
export interface DamageResult {
  round: number; total: number; base: number; focus: number; alignment: number; exhibit: number; rally: number;
  leadShares: Record<OptionId, number>; supportShares: Record<OptionId, number>; shares: Record<OptionId, number>;
  effective: Record<OptionId, number>; perOption: Record<OptionId, number>;
  majority: OptionId; tied: boolean;
  leadMajority: OptionId | null; supportMajority: OptionId | null; leadTied: boolean; supportTied: boolean;
}
export interface Callout { playerId: string | null; option: OptionId | null; status: 'pending' | 'awarded' | 'declined'; points: number }
export interface RoomState {
  code: string; hostKey: string; createdAt: number; updatedAt: number;
  phase: Phase; round: number; voteOpenedAt: number | null; voteDeadline: number | null; voteWindowMs: number;
  players: Record<string, Player>; banned: string[]; synthetic: Record<number, Tally>; exhibits: Record<number, string[]>;
  callouts: Record<number, Callout[]>;
  bossHp: number; damageLog: DamageResult[]; majorities: (OptionId | null)[]; hideNames: boolean;
  /** Roads set off on: start, next into a travel and goto to a road each add one; reset keeps it. */
  trips: number;
}
export type HostCmd =
  | { k: 'start' } | { k: 'openVote'; seconds?: number } | { k: 'closeVote' } | { k: 'reveal' } | { k: 'next' }
  | { k: 'reopen' } | { k: 'reset' } | { k: 'kick'; playerId: string } | { k: 'exhibit'; exhibitId: string }
  | { k: 'injectVotes'; counts: Partial<Tally> } | { k: 'hideNames'; hide: boolean }
  | { k: 'callout'; pick?: number; playerId?: string } | { k: 'judge'; awarded: boolean }
  | { k: 'goto'; stage: number };
export type RoomEvent =
  | { type: 'init'; code: string; hostKey: string; now: number }
  | { type: 'join'; clientId: string; name?: string; role: string; table?: string; now: number }
  | { type: 'vote'; clientId: string; round: number; option: OptionId; now: number }
  | { type: 'cmd'; key: string; cmd: HostCmd; now: number }
  | { type: 'tick'; now: number };
export type Effect = { type: 'setAlarm'; at: number } | { type: 'clearAlarm' } | { type: 'error'; clientId?: string; msg: string } | { type: 'kicked'; clientId: string };
export type ClientMsg =
  | { t: 'join'; clientId: string; name: string; role: Role; table?: string }
  | { t: 'vote'; round: number; option: OptionId }
  | { t: 'cmd'; key: string; cmd: HostCmd };
export type HostView = Omit<RoomState, 'hostKey'> & { serverNow: number; lead: Role; leadTally: Tally; supportTally: Tally; tally: Tally };
export interface PlayerView {
  phase: Phase; round: number; serverNow: number; voteDeadline: number | null; voteWindowMs: number;
  name: string; role: Role; table: string | null; lead: Role; isLead: boolean;
  myVote: OptionId | null; lastPoints: number; score: number; rank: number; playerCount: number;
  tally: Tally | null; leadTally: Tally | null; supportTally: Tally | null; majorities: (OptionId | null)[];
  picks: (OptionId | null)[];
  callout: { name: string | null; option: OptionId | null; isMe: boolean } | null;
}
export type ServerMsg = { t: 'host'; state: HostView } | { t: 'you'; view: PlayerView } | { t: 'error'; msg: string } | { t: 'kicked' };
/** How the room closes the socket of a phone it has removed. The phone page stops reconnecting on this code. */
export const KICKED_CLOSE_CODE = 4001;
export const KICKED_CLOSE_REASON = 'removed';
