/* Station mode for /otr: a network station that plays what the network was carrying at this hour on
 * this day of the week, on the listener's local clock. Pure scheduling logic, no DOM; index.html owns
 * the player and the cards. Loaded as window.OTRStation.
 *
 * Model (James, Oct 2026): episodes run back to back with no commercials. Whenever one ends, the next
 * comes from whichever show owns the grid slot at that minute, so a half hour slot often fits two
 * episodes and the lineup drifts a few minutes late. Nothing is stored anywhere: the whole week is a
 * deterministic function of (grid, episode lists, local week), so every listener in a time zone hears
 * the same thing, and leaving and coming back lands you on whatever is on air now.
 *
 * The chain is anchored at local Sunday 00:00 and walked forward; a week is at most ~600 items, so a
 * walk is sub-millisecond and is cached per week. Slot ownership is looked up in local time at each
 * item's start, so DST changes simply shift the lineup like a real clock would.
 */
(function(){
  'use strict';
  function hashStr(str){ var h=2166136261>>>0; for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return h; }
  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  function mins(hhmm){ var m=/^(\d{1,2}):(\d{2})$/.exec(String(hhmm||'')); return m ? (+m[1])*60+(+m[2]) : 0; }
  function pad2(n){ return (n<10?'0':'')+n; }
  function clock12(min){ var h=Math.floor(min/60)%24, m=min%60, ap=h<12?'AM':'PM'; h=h%12; if(h===0) h=12; return h+':'+pad2(m)+' '+ap; }
  var DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var WEEK_EPOCH = new Date(2026,0,4,0,0,0,0).getTime();   // a local Sunday; week numbers count from here

  function Station(grid, byId){
    this.grid = grid; this.byId = byId; this.id = grid.id; this.name = grid.name;
    this.serial = {}; (grid.serial||[]).forEach(function(id){ this.serial[id]=true; }, this);
    this.pools = {}; var self=this;
    Object.keys(grid.pools||{}).forEach(function(p){ self.pools[p] = (grid.pools[p]||[]).filter(function(id){ return self.has(id); }); });
    this.slots = (grid.slots||[]).map(function(s){ return { days:s.days, start:mins(s.at), len:s.len, end:mins(s.at)+s.len, show:s.show||null, pool:s.pool||null,
      label:s.label||null, conf:s.conf||'likely', src:s.src||'' }; });
    this.defaults = (grid.defaults||[]).map(function(d){ return { start:mins(d.from), end:mins(d.to), pool:d.pool, label:d.label||'' }; });
    this.weeks = {};
    this.perWeek = this.estimatePerWeek();
  }
  Station.prototype.has = function(id){ var s=this.byId[id]; return !!(s && s.eps && s.eps.length); };
  Station.prototype.show = function(id){ return this.byId[id]; };

  // Who owns the dial at (day of week, minute of day)? Explicit slots first, then the hour's default pool.
  Station.prototype.ownerAt = function(day, minute){
    for(var i=0;i<this.slots.length;i++){ var s=this.slots[i];
      if(s.days.indexOf(day)>=0 && minute>=s.start && minute<s.end) return s; }
    for(var j=0;j<this.defaults.length;j++){ var d=this.defaults[j];
      if(minute>=d.start && minute<d.end) return { days:[day], start:d.start, len:d.end-d.start, end:d.end, show:null, pool:d.pool, label:d.label, conf:'fill', src:'', isDefault:true }; }
    var last=this.defaults[this.defaults.length-1];
    return { days:[day], start:0, len:1440, end:1440, show:null, pool:last?last.pool:null, label:last?last.label:'', conf:'fill', src:'', isDefault:true };
  };

  // Rough plays per week per show, from slot minutes owned (pools share their minutes evenly). Serials
  // advance by this many chapters each week so a story keeps moving from one week to the next.
  Station.prototype.estimatePerWeek = function(){
    var minutes={}, self=this;
    function add(id, m){ if(self.has(id)) minutes[id]=(minutes[id]||0)+m; }
    this.slots.forEach(function(s){
      var m=s.len*s.days.length;
      if(s.show) add(s.show, m);
      else if(s.pool && self.pools[s.pool] && self.pools[s.pool].length){ var p=self.pools[s.pool]; p.forEach(function(id){ add(id, m/p.length); }); }
    });
    // default ranges, minus the explicit slots over them, approximated by the whole range on every day
    this.defaults.forEach(function(d){
      var p=self.pools[d.pool]||[]; if(!p.length) return;
      var covered=0; for(var day=0;day<7;day++){ self.slots.forEach(function(s){ if(s.days.indexOf(day)<0) return; var a=Math.max(s.start,d.start), b=Math.min(s.end,d.end); if(b>a) covered+=b-a; }); }
      var m=Math.max(0,(d.end-d.start)*7-covered); p.forEach(function(id){ add(id, m/p.length); });
    });
    var out={};
    Object.keys(minutes).forEach(function(id){
      var eps=self.byId[id].eps, durs=eps.map(function(e){ return e[2]>0?e[2]:1800; }).sort(function(a,b){return a-b;});
      var med=durs[Math.floor(durs.length/2)]/60;
      out[id]=Math.max(1, Math.round(minutes[id]/Math.max(1,med)));
    });
    return out;
  };

  Station.prototype.anchor = function(t){   // local Sunday 00:00 of the week containing t (seconds)
    var d=new Date(t*1000); d.setHours(0,0,0,0); d.setDate(d.getDate()-d.getDay()); return d;
  };
  Station.prototype.weekIndex = function(anchorDate){ return Math.round((anchorDate.getTime()-WEEK_EPOCH)/(7*86400000)); };
  Station.prototype.weekKey = function(anchorDate){ return anchorDate.getFullYear()+'-'+pad2(anchorDate.getMonth()+1)+'-'+pad2(anchorDate.getDate()); };

  // The week's chain: cached and extended lazily up to `untilSec`.
  Station.prototype.week = function(t){
    var a=this.anchor(t), key=this.weekKey(a), W=this.weeks[key];
    if(!W){
      var nextA=new Date(a.getTime()); nextA.setDate(nextA.getDate()+7);
      W=this.weeks[key]={ key:key, idx:this.weekIndex(a), start:a.getTime()/1000, end:nextA.getTime()/1000, items:[], cursor:a.getTime()/1000,
        rng:mulberry32(hashStr('otr-station:'+this.id+':'+key)), orders:{}, count:{}, lastShow:null };
    }
    return W;
  };
  Station.prototype.order = function(W, id){
    var o=W.orders[id]; if(o) return o;
    var n=this.byId[id].eps.length, idx=[]; for(var i=0;i<n;i++) idx.push(i);
    if(this.serial[id]){ var off=((W.idx*(this.perWeek[id]||1))%n+n)%n; o=idx.slice(off).concat(idx.slice(0,off)); }
    else { var r=mulberry32(hashStr('otr-station:'+this.id+':'+W.key+':'+id)); for(var k=n-1;k>0;k--){ var j=Math.floor(r()*(k+1)); var tmp=idx[k]; idx[k]=idx[j]; idx[j]=tmp; } o=idx; }
    return (W.orders[id]=o);
  };
  Station.prototype.defaultPoolAt = function(minute){
    for(var i=0;i<this.defaults.length;i++){ var d=this.defaults[i]; if(minute>=d.start && minute<d.end) return this.pools[d.pool]||[]; }
    return [];
  };
  Station.prototype.pickShow = function(W, own){
    if(own.show && this.has(own.show)) return own.show;
    var pool=own.pool ? (this.pools[own.pool]||[]) : [];
    if(!pool.length){ // slot names a show we do not have: fall back to the hour's default pool
      var d=new Date(W.cursor*1000); pool=this.defaultPoolAt(d.getHours()*60+d.getMinutes());
      if(!pool.length) return null;
    }
    var r=W.rng(), i=Math.floor(r*pool.length), id=pool[i];
    if(id===W.lastShow && pool.length>1){ var uniq=pool.filter(function(x){ return x!==id; }); id=uniq[Math.floor(r*uniq.length)]; }
    return id;
  };
  Station.prototype.extend = function(W, untilSec){
    var guard=0;
    var minLeft = (this.grid.minLeft==null) ? 5 : +this.grid.minLeft;
    while(W.cursor<=untilSec && W.cursor<W.end && guard++<5000){
      var d=new Date(W.cursor*1000), day=d.getDay(), minute=d.getHours()*60+d.getMinutes()+d.getSeconds()/60;
      var own=this.ownerAt(day, Math.floor(minute));
      // A show never starts with less than minLeft minutes left in its slot (a 58-minute Stop the Music would
      // otherwise trigger a second hour and squeeze out Winchell at 9:00); the next slot's owner starts early instead.
      if(minLeft>0 && own.end-minute<minLeft && own.end<1440){ var nxt=this.ownerAt(day, own.end); if(nxt.show!==own.show || nxt.pool!==own.pool) own=nxt; }
      var id=this.pickShow(W, own);
      if(!id){ W.cursor+=900; continue; }
      var o=this.order(W,id), c=W.count[id]||0, epIndex=o[c%o.length]; W.count[id]=c+1;
      var ep=this.byId[id].eps[epIndex], dur=(ep&&ep[2]>0)?ep[2]:1800;
      W.items.push({ showId:id, epIndex:epIndex, at:W.cursor, dur:dur, own:own, fill:!own.show, label:own.show?null:(own.label||'') });
      W.lastShow=id; W.cursor+=dur;
    }
  };
  // What is on air at t (seconds): the item, how far into it we are, and the chain position.
  Station.prototype.onAir = function(t){
    var W=this.week(t); this.extend(W, t);
    var items=W.items; if(!items.length) return null;
    var lo=0, hi=items.length-1;
    while(lo<hi){ var mid=(lo+hi+1)>>1; if(items[mid].at<=t) lo=mid; else hi=mid-1; }
    var it=items[lo]; if(it.at>t) return null;
    return { item:it, offset:t-it.at, left:Math.max(0, it.at+it.dur-t), week:W, idx:lo };
  };
  // The n items after the one on air at t, crossing into the next week's chain when needed.
  Station.prototype.upcoming = function(t, n){
    var a=this.onAir(t); if(!a) return [];
    var out=[], W=a.week, i=a.idx+1;
    while(out.length<n){
      if(i>=W.items.length){ this.extend(W, W.items.length ? W.items[W.items.length-1].at+W.items[W.items.length-1].dur+1 : t); }
      if(i<W.items.length){ out.push(W.items[i++]); continue; }
      if(W.cursor>=W.end){ // week exhausted: continue in the next week's chain from its anchor
        var next=this.week(W.end+1); this.extend(next, W.end+1); W=next; i=0; if(!W.items.length) break; continue; }
      break;
    }
    return out;
  };
  // Today's printed lineup (explicit slots and default ranges), for a guide.
  Station.prototype.lineup = function(dayOrDate){
    var day=(dayOrDate instanceof Date)?dayOrDate.getDay():dayOrDate, self=this, rows=[], m=0;
    var starts=this.slots.filter(function(s){ return s.days.indexOf(day)>=0; }).map(function(s){ return s.start; }).sort(function(a,b){ return a-b; });
    while(m<1440){ var o=this.ownerAt(day,m); var end=Math.min(1440, o.end); // walk by owner spans
      if(o.isDefault){ for(var k=0;k<starts.length;k++){ if(starts[k]>m){ end=Math.min(end, starts[k]); break; } } } // a default range stops at the next slot
      end=Math.max(m+15, end);
      var s=o.show?self.byId[o.show]:null;
      rows.push({ start:m, end:end, time:clock12(m), name:s?s.name:(o.label||'Fill'), conf:o.conf, src:o.src, fill:!o.show, show:o.show||null });
      m=end; }
    // merge adjacent default ranges with the same label
    var out=[]; rows.forEach(function(r){ var p=out[out.length-1]; if(p && p.fill && r.fill && p.name===r.name && p.end===r.start){ p.end=r.end; } else out.push(r); });
    return out;
  };
  Station.prototype.describe = function(it){
    var s=this.byId[it.showId], e=s&&s.eps[it.epIndex];
    return { show:s?s.name:it.showId, title:e?e[0]:'', date:e?e[1]:'', dur:it.dur, at:it.at, slotTime:clock12(it.own.start), slotConf:it.own.conf, slotSrc:it.own.src,
             fill:it.fill, label:it.label, day:DAYS[new Date(it.at*1000).getDay()] };
  };

  window.OTRStation = { Station:Station, hashStr:hashStr, mulberry32:mulberry32, clock12:clock12, mins:mins, DAYS:DAYS };
})();
