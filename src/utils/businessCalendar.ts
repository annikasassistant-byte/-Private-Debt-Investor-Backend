/**
 * Payment due-date business calendar helpers.
 * MVP policy (configurable): move weekend/holiday dues to the next business day,
 * or keep the contractual calendar date with an explanatory note.
 */

/** UTC YYYY-MM-DD */
export function toUtcDateKey(d) {
  return d.toISOString().slice(0, 10);
}

function easterSundayUtc(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addUtcDays(date, days) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Fixed + common EU/DE public holidays for a year (UTC dates). */
export function holidaysForYear(year) {
  const easter = easterSundayUtc(year);
  const goodFriday = addUtcDays(easter, -2);
  const easterMonday = addUtcDays(easter, 1);
  const ascension = addUtcDays(easter, 39);
  const whitMonday = addUtcDays(easter, 50);
  const fixed = [
    `${year}-01-01`,
    `${year}-05-01`,
    `${year}-10-03`,
    `${year}-12-25`,
    `${year}-12-26`,
  ];
  return [
    ...fixed,
    toUtcDateKey(goodFriday),
    toUtcDateKey(easterMonday),
    toUtcDateKey(ascension),
    toUtcDateKey(whitMonday),
  ];
}

export function buildHolidaySet(fromYear, toYear) {
  const set = new Set();
  for (let y = fromYear; y <= toYear; y += 1) {
    for (const h of holidaysForYear(y)) set.add(h);
  }
  return set;
}

export function isWeekendUtc(date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function isNonBusinessDay(date, holidays) {
  return isWeekendUtc(date) || holidays.has(toUtcDateKey(date));
}

export function nextBusinessDay(date, holidays) {
  let d = new Date(date.getTime());
  while (isNonBusinessDay(d, holidays)) {
    d = addUtcDays(d, 1);
  }
  return d;
}

/**
 * Apply payment date policy for weekends / public holidays.
 */
export function applyPaymentDatePolicy(contractual, policy = 'next_business_day', holidays) {
  const year = contractual.getUTCFullYear();
  const cal = holidays || buildHolidaySet(year - 1, year + 2);
  const nonBusiness = isNonBusinessDay(contractual, cal);

  if (!nonBusiness) {
    return {
      dueDate: contractual,
      contractualDueDate: contractual,
      adjusted: false,
      note: '',
    };
  }

  const reasonDe = isWeekendUtc(contractual) ? 'Wochenende' : 'Feiertag';

  if (policy === 'keep_contractual') {
    return {
      dueDate: contractual,
      contractualDueDate: contractual,
      adjusted: false,
      note: `Vertragliches Fälligkeitsdatum fällt auf einen ${reasonDe}; Datum wie vereinbart beibehalten.`,
    };
  }

  const adjusted = nextBusinessDay(contractual, cal);
  return {
    dueDate: adjusted,
    contractualDueDate: contractual,
    adjusted: true,
    note: `Verschoben von ${toUtcDateKey(contractual)} (${reasonDe}) auf den nächsten Geschäftstag ${toUtcDateKey(adjusted)}.`,
  };
}

export function resolvePaymentDatePolicy(value) {
  if (value === 'keep_contractual') return 'keep_contractual';
  return 'next_business_day';
}

export default {
  applyPaymentDatePolicy,
  buildHolidaySet,
  holidaysForYear,
  nextBusinessDay,
  resolvePaymentDatePolicy,
};
