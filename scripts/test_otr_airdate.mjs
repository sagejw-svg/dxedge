#!/usr/bin/env node
/* Catalog airdate labels: missing, partial, and dates already in the title.
 * Reads the real catalog. Does not invent a day for a year.
 * Run: node scripts/test_otr_airdate.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
await import(pathToFileURL(join(root, '../frontend/public/otr/core/airdate.js')).href);
await import(pathToFileURL(join(root, '../frontend/public/otr/core/bedtime-lamp.js')).href);
const air = globalThis.OTRAirDate;
const bed = globalThis.OTRBedtime;
const catalog = JSON.parse(readFileSync(join(root, '../frontend/public/otr/catalog.json'), 'utf8'));

const F = [];
function ck(name, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL'), name, cond ? '' : '-> ' + detail);
  if (!cond) F.push(name);
}

function ep(showId, title) {
  const show = catalog.shows.find((s) => s.id === showId);
  const row = show && show.eps.find((e) => e[0] === title);
  return row || null;
}

const samples = [
  ['dimension-x', 'Outer Limit', '08 Apr 1950'],
  ['dimension-x', 'With Folded Hands', '15 Apr 1950'],
  ['x-minus-one', 'Tunnel Under The World', '04 Sep 1956'],
  ['x-minus-one', 'Surface Tension', '28 Aug 1956']
];
for (const [show, title, date] of samples) {
  const row = ep(show, title);
  ck(show + ' catalog keeps ' + title, !!row && row[1] === date, row && row[1]);
  ck(title + ' label', air.withAirDate(title, row && row[1]) === title + ' · ' + date, air.withAirDate(title, row && row[1]));
}

ck('ISO date matches the catalog spelling', air.formatAirDate('1950-04-08').text === '08 Apr 1950');
ck('ISO date has no time-zone shift in the text', air.formatAirDate('1950-04-08').text === air.formatAirDate('08 Apr 1950').text);
ck('a timestamp is not read as an airdate', air.formatAirDate('1950-04-08T00:00:00Z') === null);

ck('empty omits', air.withAirDate('Quiet Night', '') === 'Quiet Night');
ck('null omits', air.withAirDate('Quiet Night', null) === 'Quiet Night');
ck('unknown omits', air.withAirDate('Quiet Night', 'unknown') === 'Quiet Night');
ck('blank title and blank date omit', air.withAirDate('', '  ') === '');

const year = air.formatAirDate('1947');
ck('year only stays a year', year && year.precision === 'year' && year.text === '1947' && year.d === 0, year);
ck('year only is not 1 January', air.withAirDate('A Letter To Walter', '1939') === 'A Letter To Walter · 1939');
ck('year already in the title is not repeated', air.withAirDate('Two Episodes From 1937', '1937') === 'Two Episodes From 1937');
ck('a year glued inside an id is not treated as the airdate', air.withAirDate('Unknown Title (Ez1933156)', '1933') === 'Unknown Title (Ez1933156) · 1933');

const month = air.formatAirDate('1950-04');
ck('year-month keeps the month', month && month.precision === 'month' && month.text === 'Apr 1950' && month.d === 0, month);
ck('day 00 keeps the month', air.formatAirDate('00 Apr 1950').text === 'Apr 1950' && air.formatAirDate('00 Apr 1950').d === 0);
ck('ISO month with a zero day keeps the month', air.formatAirDate('1950-04-00').text === 'Apr 1950');
ck('impossible day is omitted', air.formatAirDate('31 Feb 1947') === null);
ck('leap day that existed is kept', air.formatAirDate('29 Feb 1948').text === '29 Feb 1948');
ck('circa year stays a year', air.formatAirDate('c. 1947').text === '1947' && air.formatAirDate('c. 1947').precision === 'year');

ck('yymmdd already in the title is not repeated',
  air.withAirDate('461105 - 01SH - Return to Huxley', '05 Nov 1946') === '461105 - 01SH - Return to Huxley');
ck('a full date still follows a title that only names the year',
  air.withAirDate('Christmas 1943', '25 Dec 1943') === 'Christmas 1943 · 25 Dec 1943');
ck('April 8, 1950 already in the title is not repeated',
  air.withAirDate('Outer Limit, April 8, 1950', '08 Apr 1950') === 'Outer Limit, April 8, 1950');

let empty = 0, years = 0, full = 0, unreadable = 0, emptyKept = 0;
for (const show of catalog.shows) {
  for (const row of show.eps) {
    const raw = String(row[1] || '').trim();
    const info = air.formatAirDate(row[1]);
    if (!raw) {
      empty++;
      const name = String(row[0] || '').replace(/\s+/g, ' ').trim();
      if (air.withAirDate(row[0], row[1]) === name) emptyKept++;
      continue;
    }
    if (!info) unreadable++;
    else if (info.precision === 'year') {
      years++;
      if (info.text !== raw || /Jan/.test(info.text)) F.push('year rewritten ' + raw + ' -> ' + info.text);
    } else if (info.precision === 'day') full++;
  }
}
ck('empty catalog airdates stay off the label', empty > 1000 && emptyKept === empty, empty + '/' + emptyKept);
ck('catalog year-only dates were not turned into 1 January', years > 50 && !F.some((x) => x.startsWith('year rewritten')), years);
ck('catalog full dates still format', full > 5000, full);
ck('every non-empty catalog date can be read', unreadable === 0, unreadable);

const a = bed.blobs(0, true);
const b = bed.blobs(bed.PERIOD, true);
const mid = bed.blobs(bed.PERIOD / 2, true);
ck('bedtime uses 3 to 5 blobs', bed.COUNT >= 3 && bed.COUNT <= 5 && a.length === bed.COUNT, a.length);
ck('bedtime cycle is 60 to 120 seconds', bed.PERIOD >= 60 && bed.PERIOD <= 120, bed.PERIOD);
ck('one cycle returns to the same places', a.every((p, i) => Math.abs(p.y - b[i].y) < 1e-6 && Math.abs(p.x - b[i].x) < 1e-6));
ck('half a cycle has moved', mid.some((p, i) => Math.abs(p.y - a[i].y) > 20));
ck('motion is deterministic', JSON.stringify(bed.blobs(37.5, true)) === JSON.stringify(bed.blobs(37.5, true)));
ck('switched off, the wax rests at the bottom', bed.blobs(40, false).every((p) => p.y > 110));
ck('palette is the dim amber set',
  bed.PALETTE.bg === '#080504' && bed.PALETTE.liq.join() === '49,16,14' &&
  bed.PALETTE.wax.join() === '142,48,32' && bed.PALETTE.amber.join() === '181,102,39');
ck('help text asks for a lower screen and does not promise sleep',
  /lower your screen brightness/i.test(bed.note) && !/perfect|insomnia|treatment|proven/i.test(bed.note), bed.note);

console.log('empty airdates', empty, 'year-only', years, 'full dates', full, 'unreadable', unreadable);
console.log('FAILS', F);
process.exit(F.length ? 1 : 0);
