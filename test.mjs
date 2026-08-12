import assert from 'node:assert/strict';
import { shifts, totals, nextActions, state, fmt, dayKey, inRange } from './punch.js';

const H = 3600000;
const M = 60000;
const at = (day, hour, min = 0) => new Date(2026, 7, day, hour, min).getTime();

// --- multi-break day ---------------------------------------------------------
{
  const log = [
    { t: at(10, 9), k: 'in' },
    { t: at(10, 11), k: 'bin' },
    { t: at(10, 11, 15), k: 'bout' },
    { t: at(10, 13), k: 'bin' },
    { t: at(10, 13, 45), k: 'bout' },
    { t: at(10, 18), k: 'out' },
  ];
  const [s] = shifts(log);
  const r = totals(s);
  assert.equal(r.gross, 9 * H);
  assert.equal(r.breaks, 60 * M);
  assert.equal(r.net, 8 * H);
  assert.equal(r.open, false);
  assert.equal(s.date, '2026-08-10');
}

// --- open shift measures to now ---------------------------------------------
{
  const now = at(11, 12);
  const [s] = shifts([{ t: at(11, 9), k: 'in' }]);
  assert.deepEqual(totals(s, now), { gross: 3 * H, breaks: 0, net: 3 * H, open: true });
}

// --- open break counts toward breaks ----------------------------------------
{
  const now = at(11, 12, 30);
  const [s] = shifts([
    { t: at(11, 9), k: 'in' },
    { t: at(11, 12), k: 'bin' },
  ]);
  const r = totals(s, now);
  assert.equal(r.gross, 3.5 * H);
  assert.equal(r.breaks, 30 * M);
  assert.equal(r.net, 3 * H);
}

// --- shift crossing midnight stays on its start day -------------------------
{
  const log = [
    { t: at(12, 21), k: 'in' },
    { t: at(13, 5), k: 'out' }, // 5am next calendar day
  ];
  const all = shifts(log);
  assert.equal(all.length, 1);
  assert.equal(all[0].date, '2026-08-12');
  assert.equal(totals(all[0]).net, 8 * H);
}

// --- multiple shifts, newest first ------------------------------------------
{
  const log = [
    { t: at(10, 9), k: 'in' },
    { t: at(10, 17), k: 'out' },
    { t: at(11, 9), k: 'in' },
    { t: at(11, 17), k: 'out' },
  ];
  const all = shifts(log);
  assert.equal(all.length, 2);
  assert.equal(all[0].date, '2026-08-11');
  assert.equal(all[1].date, '2026-08-10');
}

// --- unsorted input is folded correctly -------------------------------------
{
  const log = [
    { t: at(10, 17), k: 'out' },
    { t: at(10, 9), k: 'in' },
  ];
  const [s] = shifts(log);
  assert.equal(totals(s).net, 8 * H);
}

// --- empty log ---------------------------------------------------------------
assert.deepEqual(shifts([]), []);
assert.deepEqual(totals({ events: [] }), { gross: 0, breaks: 0, net: 0, open: false });

// --- action transitions ------------------------------------------------------
assert.deepEqual(nextActions(null), ['in']);
assert.deepEqual(nextActions('out'), ['in']);
assert.deepEqual(nextActions('in'), ['bin', 'out']);
assert.deepEqual(nextActions('bout'), ['bin', 'out']);
assert.deepEqual(nextActions('bin'), ['bout']);

assert.equal(state(null), 'off');
assert.equal(state('out'), 'off');
assert.equal(state('in'), 'working');
assert.equal(state('bout'), 'working');
assert.equal(state('bin'), 'break');

// --- date-range filter -------------------------------------------------------
{
  const all = shifts([
    { t: at(10, 9), k: 'in' }, { t: at(10, 17), k: 'out' },
    { t: at(11, 9), k: 'in' }, { t: at(11, 17), k: 'out' },
    { t: at(12, 9), k: 'in' }, { t: at(12, 17), k: 'out' },
  ]);
  const days = (list) => list.map((s) => s.date);

  assert.deepEqual(days(inRange(all, '', '')), ['2026-08-12', '2026-08-11', '2026-08-10']);
  assert.deepEqual(days(inRange(all, '2026-08-11', '2026-08-11')), ['2026-08-11']);
  assert.deepEqual(days(inRange(all, '2026-08-11', '')), ['2026-08-12', '2026-08-11']);
  assert.deepEqual(days(inRange(all, '', '2026-08-11')), ['2026-08-11', '2026-08-10']);
  assert.deepEqual(inRange(all, '2026-09-01', ''), []);
}

// --- backfilling a forgotten punch-out closes the stale shift -----------------
{
  const log = [
    { t: at(10, 9), k: 'in' },   // forgot to punch out this day
    { t: at(11, 9), k: 'in' },
    { t: at(11, 17), k: 'out' },
  ];
  const now = at(20, 12);
  const before = shifts(log);
  assert.equal(before.length, 2);
  assert.equal(totals(before.find((s) => s.date === '2026-08-10'), now).open, true);

  const fixed = shifts([...log, { t: at(10, 17), k: 'out' }]);
  const day10 = totals(fixed.find((s) => s.date === '2026-08-10'), now);
  assert.equal(day10.open, false);
  assert.equal(day10.net, 8 * H);
  assert.equal(totals(fixed.find((s) => s.date === '2026-08-11'), now).net, 8 * H);
}

// --- formatting --------------------------------------------------------------
assert.equal(fmt(0), '0h 00m');
assert.equal(fmt(-5), '0h 00m');
assert.equal(fmt(8 * H + 5 * M), '8h 05m');
assert.equal(fmt(90 * M), '1h 30m');
assert.equal(dayKey(at(3, 10)), '2026-08-03');

console.log('ok');
