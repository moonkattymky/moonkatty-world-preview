// Chapter 1 'База Альфа' quest chain + XP/level curve. Targets come from the world layout (passed in as `P`).
export const xpForLevel = (L) => 100 + 60 * (L - 1); // XP needed to go from level L to L+1

export function addXP(data, n) { data.xp += n; let ups = 0; while (data.xp >= xpForLevel(data.level)) { data.xp -= xpForLevel(data.level); data.level++; ups++; } return ups; }

// kinds: reach (enter radius) | collect (crystals) | interact (button + timed hold in zone) | jet (land in zone right after using the jetpack)
export function chapter1(P, fast) {
  return [
    { id: 'canyon', kind: 'reach', icon: '🛬', target: P.canyonPad, r: 10, pts: 20, xp: 40 },
    { id: 'crystals', kind: 'collect', icon: '💎', need: fast ? 2 : 5, pts: 25, xp: 50 },
    { id: 'reactor', kind: 'interact', icon: '⚡', target: P.reactorConsole, r: 4, hold: fast ? 0.3 : 1.2, action: 'activate', pts: 30, xp: 60 },
    { id: 'dish', kind: 'interact', icon: '📡', target: P.dish, r: 4.5, hold: fast ? 0.3 : 2.2, action: 'scan', pts: 30, xp: 60 },
    { id: 'launch', kind: 'reach', icon: '🚀', target: P.launchPad, r: 10, pts: 40, xp: 70 },
    { id: 'ledge', kind: 'jet', icon: '🪂', target: P.ledge, r: 3.4, pts: 45, xp: 80 },
    { id: 'home', kind: 'reach', icon: '🏠', target: P.homePad, r: 4.5, pts: 60, xp: 120 },
  ];
}
