'use strict';

/*
  Orders date filter: "from" and "to" are calendar days (YYYY-MM-DD) in
  Indian time. "to" includes the whole last day. Anything that is not a real
  date is ignored.
*/

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const IST = '+05:30';

function parseDay(value) {
  const text = String(value || '').trim();

  if (!DAY.test(text)) return null;

  const start = new Date(`${text}T00:00:00${IST}`);

  if (Number.isNaN(start.getTime())) return null;

  // 2026-02-31 style dates roll over to the next month: refuse them.
  const back = new Date(start.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

  return back === text ? start : null;
}

function istDayRange(from, to) {
  const a = parseDay(from);
  const b = parseDay(to);
  const range = {};

  if (a) range.$gte = a;
  if (b) range.$lt = new Date(b.getTime() + 24 * 3600 * 1000);

  if (range.$gte && range.$lt && range.$gte >= range.$lt) return null;

  return Object.keys(range).length ? range : null;
}

module.exports = { istDayRange, parseDay };
