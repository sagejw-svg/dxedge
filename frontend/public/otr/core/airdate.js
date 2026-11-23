/* Original broadcast dates for Old Time Radio episode labels.
 *
 * The only source is the catalog date string already stored on an episode
 * (catalog.json / stations/shows.json field eps[][1]). That string is the
 * curated airdate. Archive upload times, file mtimes, and publication dates
 * are not read here.
 *
 * A year alone stays a year. A missing day is not filled in. Nothing is
 * parsed with Date, so a date-only value cannot shift across a time zone.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.OTRAirDate = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  var MONS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var FULL = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  var MON = { sept: 9 };
  MONS.forEach(function (m, i) { MON[m.toLowerCase()] = i + 1; });
  FULL.forEach(function (m, i) { MON[m] = i + 1; });

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isYear(y) { return y >= 1890 && y <= 2099; }
  function daysInMonth(y, m) {
    if (m === 2) return (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28;
    return [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m] || 0;
  }
  // d === 0 means the day was not in the source. An impossible day is dropped
  // entirely rather than rewritten as the 1st.
  function pack(y, m, d) {
    if (!isYear(y)) return null;
    if (!m) return { text: String(y), precision: 'year', y: y, m: 0, d: 0 };
    if (m < 1 || m > 12) return null;
    if (!d) return { text: MONS[m - 1] + ' ' + y, precision: 'month', y: y, m: m, d: 0 };
    if (d < 1 || d > daysInMonth(y, m)) return null;
    return { text: pad(d) + ' ' + MONS[m - 1] + ' ' + y, precision: 'day', y: y, m: m, d: d };
  }

  function formatAirDate(raw) {
    if (raw == null) return null;
    var s = String(raw).trim();
    if (!s) return null;
    if (/^(unknown|undated|n\/?a|none|null|\?+|-+|tbd|xx+)$/i.test(s)) return null;
    // A timestamp is not a catalog airdate. Leaving it unread avoids turning
    // midnight UTC into the previous local evening.
    if (/[T\s]\d{1,2}:\d{2}/.test(s)) return null;
    var m, mo;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s))) return pack(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{4})-(\d{2})$/.exec(s))) return pack(+m[1], +m[2], 0);
    if ((m = /^(\d{4})$/.exec(s))) return pack(+m[1], 0, 0);
    if ((m = /^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/.exec(s))) {
      mo = MON[m[2].toLowerCase()];
      if (!mo) return null;
      return pack(+m[3], mo, +m[1]);
    }
    if ((m = /^([A-Za-z]{3,9})\.?,?\s+(\d{4})$/.exec(s))) {
      mo = MON[m[1].toLowerCase()];
      if (!mo) return null;
      return pack(+m[2], mo, 0);
    }
    if ((m = /^(?:c\.|ca\.|circa|about|approx\.?)\s*(\d{4})$/i.exec(s))) return pack(+m[1], 0, 0);
    return null;
  }

  function titleHasDate(title, info) {
    var t = String(title || '');
    if (!info || !t) return false;
    if (info.precision === 'year') return new RegExp('\\b' + info.y + '\\b').test(t);
    var mon = MONS[info.m - 1], full = FULL[info.m - 1], y = info.y;
    if (info.precision === 'month') {
      return new RegExp('\\b(?:' + mon + '|' + full + ')\\.?\\s+' + y + '\\b', 'i').test(t) ||
        t.indexOf(y + '-' + pad(info.m)) >= 0;
    }
    var d = info.d, mm = pad(info.m), dd = pad(d), yy = String(y).slice(2);
    if (t.indexOf(y + '-' + mm + '-' + dd) >= 0) return true;
    if (new RegExp('(?:^|\\D)' + yy + mm + dd + '(?:\\D|$)').test(t)) return true;
    var dayRe = '(?:' + d + '|' + dd + ')';
    var monRe = '(?:' + mon + '|' + full + ')';
    var patterns = [
      new RegExp('\\b' + dayRe + '\\s+' + monRe + '\\.?\\s*,?\\s*' + y + '\\b', 'i'),
      new RegExp('\\b' + monRe + '\\.?\\s+' + dayRe + ',?\\s*' + y + '\\b', 'i'),
      new RegExp('\\b' + mm + '[/-]' + dd + '[/-]' + y + '\\b'),
      new RegExp('\\b' + dd + '[/-]' + mm + '[/-]' + y + '\\b'),
      new RegExp('\\b' + y + '[./]' + mm + '[./]' + dd + '\\b')
    ];
    for (var i = 0; i < patterns.length; i++) if (patterns[i].test(t)) return true;
    return false;
  }

  function withAirDate(title, raw) {
    var name = String(title == null ? '' : title).replace(/\s+/g, ' ').trim();
    var info = formatAirDate(raw);
    if (!info) return name;
    if (name && titleHasDate(name, info)) return name;
    return name ? name + ' \u00b7 ' + info.text : info.text;
  }

  return { formatAirDate: formatAirDate, titleHasDate: titleHasDate, withAirDate: withAirDate };
});
