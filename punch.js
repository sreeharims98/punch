// Pure logic. No DOM, no storage — so test.mjs can run it under Node.

export const KINDS = { in: 'Punch in', bin: 'Break in', bout: 'Break out', out: 'Punch out' };

// What the user is allowed to do next, given the kind of the newest event.
// Keeps invalid sequences (double punch-in, break-out with no break-in) unreachable.
const ACTIONS = {
  null: ['in'],
  out: ['in'],
  in: ['bin', 'out'],
  bout: ['bin', 'out'],
  bin: ['bout'],
};

export function nextActions(lastKind) {
  return ACTIONS[lastKind ?? 'null'] ?? ['in'];
}

// State label for the UI accent colour.
export function state(lastKind) {
  if (lastKind === 'in' || lastKind === 'bout') return 'working';
  if (lastKind === 'bin') return 'break';
  return 'off';
}

// Fold the flat log into shifts. A shift starts at each 'in' and runs to its 'out'.
// Labelled by the local date of the 'in', so a punch-out after midnight stays on
// the day it started. Newest shift first.
export function shifts(events) {
  const sorted = [...events].sort((a, b) => a.t - b.t);
  const out = [];
  for (const e of sorted) {
    if (e.k === 'in' || out.length === 0) out.push({ start: e.t, events: [] });
    out[out.length - 1].events.push(e);
  }
  return out.reverse().map((s) => ({ date: dayKey(s.start), start: s.start, events: s.events }));
}

// { gross, breaks, net } in ms. An open shift or open break measures up to `now`.
export function totals(shift, now = Date.now()) {
  const evs = shift.events;
  if (evs.length === 0) return { gross: 0, breaks: 0, net: 0, open: false };

  const last = evs[evs.length - 1];
  const open = last.k !== 'out';
  const end = open ? Math.max(now, last.t) : last.t;

  let breaks = 0;
  let breakStart = null;
  for (const e of evs) {
    if (e.k === 'bin' && breakStart === null) breakStart = e.t;
    else if (e.k === 'bout' && breakStart !== null) {
      breaks += e.t - breakStart;
      breakStart = null;
    }
  }
  if (breakStart !== null) breaks += end - breakStart; // break still running

  const gross = end - evs[0].t;
  return { gross, breaks, net: gross - breaks, open };
}

export function dayKey(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmt(ms) {
  const total = Math.max(0, Math.round(ms / 60000));
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`;
}
