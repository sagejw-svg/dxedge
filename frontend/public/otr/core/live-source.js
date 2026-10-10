/* Live internet radio for the OTR radio: finds real stations through the community directory at
 * radio-browser.info (open data, CORS open, no key) and hands back streams a web page can play.
 *
 * "Can play" is narrower than "is listed": the page is https, so an http:// stream is blocked as mixed
 * content; HLS playlists only play natively in Safari; OGG/Opus fail on older iPhones. So a station is
 * kept only when its resolved URL is https and its codec is MP3 or AAC. Roughly two thirds of popular US
 * stations pass; the rest would need a server-side relay, which this does not do.
 *
 *   OTRLive.search({ q, tags:[...], state, country, limit }) -> Promise<[station]>
 *   OTRLive.custom(url, name) -> station | null     a stream URL the listener pastes in
 *   OTRLive.counted(station)                         tells the directory a station was played (its request)
 *   OTRLive.QUICK                                    the quick searches shown in the finder
 *
 * A station: { id, kind:'stream', name, url, favicon, tags:[], place, quality, homepage, uuid }
 * Loaded as window.OTRLive.
 */
(function(){
  'use strict';
  var MIRRORS = ['https://de1.api.radio-browser.info', 'https://de2.api.radio-browser.info'];
  var CODECS = { 'MP3':1, 'AAC':1, 'AAC+':1 };
  var QUICK = [
    { id:'tx-hiphop', label:'Hip hop in Texas', tags:['hip hop', 'hip-hop', 'hiphop', 'rap'], state:'Texas', country:'US' },
    { id:'classic-rock', label:'Classic rock', tags:['classic rock'], country:'US' },
    { id:'country', label:'Country', tags:['country'], country:'US' },
    { id:'jazz', label:'Jazz', tags:['jazz'] },
    { id:'news', label:'News and talk', tags:['news', 'talk'], country:'US' },
    { id:'oldies', label:'Oldies', tags:['oldies'], country:'US' }
  ];

  function tidy(s){ return String(s || '').replace(/\s+/g, ' ').trim(); }
  function titleWord(t){ return t.replace(/\b\w/g, function(c){ return c.toUpperCase(); }); }
  function usable(s){ return s && /^https:\/\//i.test(s.url_resolved || '') && !s.hls && CODECS[String(s.codec || '').toUpperCase()]; }
  function norm(s){
    var tags = String(s.tags || '').split(',').map(tidy).filter(Boolean).slice(0, 3).map(titleWord);
    var place = [tidy(s.state), s.countrycode === 'US' ? '' : tidy(s.country)].filter(Boolean).join(', ');
    var q = [String(s.codec || '').toUpperCase(), s.bitrate ? s.bitrate + ' kbps' : ''].filter(Boolean).join(' ');
    return { id:'rb:' + s.stationuuid, uuid:s.stationuuid, kind:'stream', name:tidy(s.name) || 'Unnamed station', url:s.url_resolved,
      favicon:/^https:\/\//i.test(s.favicon || '') ? s.favicon : '', tags:tags, place:place || tidy(s.country), quality:q, homepage:s.homepage || '' };
  }

  // Try each mirror in turn, eight seconds apiece.
  function api(path){
    var i = 0;
    function next(){
      if (i >= MIRRORS.length) return Promise.reject(new Error('The station directory is not answering.'));
      var base = MIRRORS[i++], ctl = window.AbortController ? new AbortController() : null;
      var t = ctl ? setTimeout(function(){ ctl.abort(); }, 8000) : 0;
      return fetch(base + path, ctl ? { signal:ctl.signal } : {}).then(function(r){
        clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
      }).catch(function(){ clearTimeout(t); return next(); });
    }
    return next();
  }
  function query(p){
    var qs = new URLSearchParams({ hidebroken:'true', is_https:'true', order:'clickcount', reverse:'true', limit:String(p.limit || 60) });
    if (p.name) qs.set('name', p.name);
    if (p.tag) qs.set('tag', p.tag);
    if (p.state) qs.set('state', p.state);
    if (p.country) qs.set('countrycode', p.country);
    return api('/json/stations/search?' + qs.toString()).catch(function(e){ if (p.soft) return []; throw e; });
  }

  // A free-text search looks in station names and in genre tags; a quick search uses its tags.
  function search(opt){
    opt = opt || {};
    var jobs = [];
    if (opt.q) { var q = tidy(opt.q); jobs.push(query({ name:q, state:opt.state, country:opt.country })); jobs.push(query({ tag:q.toLowerCase(), state:opt.state, country:opt.country, soft:true })); }
    (opt.tags || []).forEach(function(t){ jobs.push(query({ tag:t, state:opt.state, country:opt.country, soft:jobs.length > 0 })); });
    if (!jobs.length) jobs.push(query({ country:opt.country || 'US' }));
    return Promise.all(jobs).then(function(lists){
      var seen = {}, out = [];
      [].concat.apply([], lists).sort(function(a, b){ return (b.clickcount || 0) - (a.clickcount || 0); }).forEach(function(s){
        if (!usable(s)) return;
        var key = s.stationuuid, k2 = tidy(s.name).toLowerCase() + '|' + s.url_resolved;
        if (seen[key] || seen[k2]) return; seen[key] = seen[k2] = 1; out.push(norm(s));
      });
      return out.slice(0, opt.limit || 30);
    });
  }

  function custom(url, name){
    url = tidy(url);
    if (!/^https:\/\/[^\s]+$/i.test(url)) return null;
    var host = ''; try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return null; }
    var h = 2166136261 >>> 0; for (var i = 0; i < url.length; i++) { h ^= url.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return { id:'url:' + h.toString(36), kind:'stream', name:tidy(name) || host, url:url, favicon:'', tags:[], place:'Added by you', quality:'', homepage:'' };
  }

  // radio-browser.info asks clients to report plays, which drives its popularity order. Fire and forget.
  function counted(st){ if (st && st.uuid) fetch(MIRRORS[0] + '/json/url/' + encodeURIComponent(st.uuid)).catch(function(){}); }

  window.OTRLive = { search:search, custom:custom, counted:counted, QUICK:QUICK, MIRRORS:MIRRORS, usable:usable, norm:norm };
})();
