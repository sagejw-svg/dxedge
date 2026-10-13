// Filament tube painter: the lit tube, its looks and the canvas fit helper.
// COPIED from /otr/index.html at commit f9f5d2b (lines 1466-1467, 2652, 2705-2747, 3420-3423, 3457-3511, 3514-3529, 3546-3776, 3777-3803), per the Filament
// design brief, decision 5: the synth carries its own copy of the /otr tube code
// instead of sharing it through /lib/. The copied block is verbatim; anything the
// synth adds is below the "Filament additions" line. If the two ever need to be
// merged into /lib/, diff the copied block against /otr at that commit first.

// ---- copied block starts ----
  function hashStr(str){ var h=2166136261>>>0; for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return h; }
  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  function clampN(v,a,b){ return Math.max(a, Math.min(b, v)); }
  var NAT = { bg:null, bloom:[255,140,40], heatCore:[255,170,70], heatMid:[255,110,30], slit:[255,190,90], filament:[255,200,120],
    plate:['#171717','#3b3b3b','#262626'], plateEdge:'rgba(0,0,0,0.35)', red:[255,70,20], blue:[70,120,255],
    getter:['rgba(205,205,215,0.92)','rgba(85,85,95,0.75)'], glassFill:'rgba(30,26,22,0.55)', glassStroke:'rgba(255,255,255,0.22)', refl:[255,255,255], reflA:0.20,
    mica:'rgba(200,196,182,0.32)', rods:'rgba(170,170,170,0.55)', gridLine:'rgba(30,22,14,0.75)', label:'rgba(240,240,236,0.62)',
    base:['#24180e','#4a3420','#0d0805'], chassis:'#141414', chassisEdge:'#3a3a3a', pins:'#8a8a8a',
    heatLow:[190,40,10], chassisCol:['#1e1e1e','#0b0b0b'], socket:'#141210', socketRim:'rgba(255,255,255,0.14)', getterEdge:'rgba(110,80,50,0.35)',
    stem:'rgba(215,225,230,0.14)', copper:'rgba(196,128,80,0.85)', cathode:'#6a6560', micaEdge:'rgba(130,126,115,0.55)', micaHi:'rgba(225,222,210,0.45)',
    plateLip:'rgba(140,140,140,0.6)', glassTint:[205,220,230], glassBackA:0.018, glassEdgeA:0.14 };
  function look(o){ var p={}; Object.keys(NAT).forEach(function(k){ p[k]=NAT[k]; }); Object.keys(o).forEach(function(k){ p[k]=o[k]; }); return p; }
  var TUBE_LOOKS = [
    { id:'natural', name:'Natural', p:NAT },
    { id:'blacklight', name:'Black light', p:look({ bg:'#07000f', ambient:[110,40,255], bloom:[150,60,255], heatCore:[255,120,230], heatMid:[190,50,255], slit:[255,170,255], filament:[255,170,255],
        plate:['#1b1030','#3c2a66','#150a28'], plateEdge:'rgba(0,0,0,0.5)', red:[255,40,170], blue:[120,80,255], blueBoost:1.7,
        getter:['rgba(120,80,220,0.85)','rgba(40,20,80,0.55)'], glassFill:'rgba(25,5,50,0.55)', glassStroke:'rgba(190,130,255,0.7)', refl:[210,180,255], reflA:0.26,
        mica:'rgba(215,195,255,0.9)', fluor:[200,170,255], rods:'rgba(170,130,255,0.6)', gridLine:'rgba(40,10,70,0.8)', label:'rgba(160,255,250,0.98)', labelGlow:[90,255,240],
        base:['#1a0f2c','#2e1c4a','#0c0618'], chassis:'#0c0616', chassisEdge:'#3a1f6a', pins:'#9a7aff', dust:true,
        heatLow:[150,30,190], chassisCol:['#120a20','#05020a'], socket:'#120a1e', socketRim:'rgba(190,130,255,0.25)', getterEdge:'rgba(120,60,200,0.3)', stem:'rgba(200,170,255,0.22)',
        copper:'rgba(220,150,255,0.85)', cathode:'#5a4a70', micaEdge:'rgba(170,140,255,0.6)', micaHi:'rgba(235,220,255,0.85)', plateLip:'rgba(150,110,220,0.6)', glassTint:[190,150,255], glassBackA:0.05, glassEdgeA:0.3 }) },
    { id:'thermal', name:'Thermal', p:look({ bg:'#000014', bloom:[255,70,0], heatCore:[255,255,200], heatMid:[255,190,0], slit:[255,255,230], filament:[255,255,220],
        thermal:true, plateEdge:'rgba(0,0,0,0.25)', red:[255,220,0], blue:null,
        getter:['rgba(30,20,90,0.9)','rgba(20,10,60,0.5)'], glassFill:'rgba(20,10,80,0.65)', glassStroke:'rgba(90,60,220,0.55)', refl:[120,90,255], reflA:0.05,
        mica:'rgba(160,40,140,0.6)', rods:'rgba(140,30,120,0.7)', gridLine:'rgba(255,120,0,0.6)', label:'rgba(0,0,0,0)',
        base:['#120a3c','#1a0e50','#06041e'], chassis:'#04031a', chassisEdge:'#1a1050', pins:'#3a2a8a',
        heatLow:[180,40,0], chassisCol:['#05031a','#020110'], socket:'#0a0630', socketRim:'rgba(90,60,220,0.3)', getterEdge:'rgba(40,20,120,0.3)', stem:'rgba(60,40,180,0.25)',
        micaEdge:'rgba(120,30,140,0.6)', micaHi:'rgba(180,60,160,0.6)', plateLip:'rgba(0,0,0,0.3)', glassTint:[80,60,220], glassBackA:0.08, glassEdgeA:0.25 }) },
    { id:'neon', name:'Neon', p:look({ bg:'#05010d', synth:true, bloom:[255,0,170], heatCore:[0,240,255], heatMid:[255,0,200], slit:[120,255,255], filament:[0,255,255],
        plate:['#0a0414','#14081e','#0a0414'], plateEdge:'rgba(255,40,200,0)', outline:[255,40,200], red:[255,0,120], blue:[0,200,255],
        getter:['rgba(80,0,120,0.6)','rgba(20,0,40,0.3)'], glassFill:'rgba(10,0,25,0.6)', glassStroke:'rgba(0,240,255,0.95)', glassGlow:[0,240,255], refl:[0,240,255], reflA:0.12,
        mica:'rgba(0,240,255,0.8)', fluor:[0,240,255], rods:'rgba(255,40,200,0.8)', gridLine:'rgba(0,240,255,0.55)', label:'rgba(255,80,220,1)', labelGlow:[255,40,200],
        base:['#1e0040','#2a0050','#0a0018'], chassis:'#0a0018', chassisEdge:'#ff28c8', pins:'#00f0ff',
        heatLow:[255,0,160], chassisCol:['#0a0018','#04000a'], socket:'#140028', socketRim:'rgba(255,40,200,0.6)', getterEdge:'rgba(80,0,120,0.2)', stem:'rgba(0,240,255,0.15)',
        copper:'rgba(0,240,255,0.8)', cathode:'#30104a', micaEdge:'rgba(0,240,255,0.6)', micaHi:'rgba(150,255,255,0.7)', plateLip:'rgba(255,40,200,0.8)', glassTint:[0,240,255], glassBackA:0.04, glassEdgeA:0.12 }) },
    { id:'xray', name:'X-ray', p:look({ bg:'#02080e', noLight:true, xray:true, bloom:null,
        plate:['#9fb8c8','#e6f3ff','#8aa4b6'], plateEdge:'rgba(255,255,255,0.5)', red:null, blue:null,
        getter:['rgba(200,230,255,0.55)','rgba(100,140,170,0.2)'], glassFill:'rgba(120,170,210,0.06)', glassStroke:'rgba(170,215,255,0.45)', refl:[200,230,255], reflA:0,
        mica:'rgba(170,200,220,0.45)', rods:'rgba(230,245,255,0.85)', gridLine:'rgba(230,245,255,0.85)', label:'rgba(0,0,0,0)',
        base:['#56687a','#7a8e9c','#2a3640'], chassis:'#1a242c', chassisEdge:'#4a5a66', pins:'#f0f8ff',
        chassisCol:['#1a242c','#0d151b'], socket:'#2a3640', socketRim:'rgba(200,230,255,0.3)', getterEdge:'rgba(150,190,220,0.15)', stem:'rgba(200,230,255,0.3)',
        copper:'rgba(235,245,255,0.9)', cathode:'#c8dcea', micaEdge:'rgba(170,200,220,0.5)', micaHi:'rgba(210,230,245,0.5)', plateLip:'rgba(255,255,255,0.6)', glassTint:[170,215,255], glassBackA:0.03, glassEdgeA:0.22 }) },
    { id:'night', name:'Night vision', p:look({ bg:'#020402' }), css:'grayscale(1) sepia(1) hue-rotate(58deg) saturate(5) brightness(1.15) contrast(1.15)', overlay:'night' },
    { id:'vintage', name:'Vintage photo', p:look({ bg:'#0d0a06' }), css:'sepia(0.85) contrast(1.08) brightness(0.95) saturate(0.9)', overlay:'vintage' }
  ];
  var LOOK_BY={}; TUBE_LOOKS.forEach(function(l){ LOOK_BY[l.id]=l; });
  function fitCanvas(cv, q){ var r=(window.devicePixelRatio||1)*(q||1), w=cv.clientWidth, h=cv.clientHeight; if(!w||!h) return null;
    var bw=Math.max(1,Math.round(w*r)), bh=Math.max(1,Math.round(h*r));
    if(cv.width!==bw || cv.height!==bh){ cv.width=bw; cv.height=bh; }
    var c=cv.getContext('2d'); c.setTransform(r,0,0,r,0,0); return { c:c, w:w, h:h, r:r }; }
  var TW=120, TH=200, EK=0.16, FONT=null;
  // Geometry per envelope, logical units. prof: [y, half-width] from the bottom of the glass up;
  // top: the crown; base: [top of the bakelite base, radius] (none for 9-pin tubes, which sit in the
  // socket); mTop/mBot: micas; pTop/pBot: plates; stem: top of the glass press.
  //   mini   9-pin miniature (12AX7 family, EL84)      tall   straight power tube (EL34)
  //   octal  straight octal (6V6)                      bottle ST "coke bottle" (6L6G): belly, shoulder, neck
  //   big    KT88: wide belly easing into the crown    globe  300B: narrow neck, round globe, tapered top
  var GEO = {
    mini:   { prof:[[182,22.5],[62,22.5],[47,22]], top:33, pip:true, chassis:184, mTop:73, mBot:151, pTop:82, pBot:144, stem:170 },
    octal:  { prof:[[156,24.5],[64,24.5],[42,24]], top:24, base:[151,25.5], chassis:184, mTop:64, mBot:136, pTop:73, pBot:128, stem:146 },
    tall:   { prof:[[156,26],[60,26],[38,25.5]], top:14, base:[151,27], chassis:184, mTop:60, mBot:138, pTop:69, pBot:131, stem:148 },
    bottle: { prof:[[156,23],[140,28],[116,30.5],[96,29],[80,23.5],[64,21.5],[40,21.5]], top:18, base:[151,24.5], chassis:184, mTop:79, mBot:140, pTop:88, pBot:133, stem:148 },
    big:    { prof:[[156,28],[128,31.5],[100,32],[80,29],[64,27],[38,27]], top:12, base:[151,29], chassis:184, mTop:60, mBot:138, pTop:69, pBot:131, stem:148 },
    globe:  { prof:[[156,17],[146,18],[128,28.5],[106,33.5],[84,33],[64,28.5],[46,21]], top:18, base:[152,21.5], chassis:184, mTop:66, mBot:130, pTop:75, pBot:123, stem:142 }
  };
  // The wall is a monotone cubic through prof (smooth, symmetric, never bulging past its points)
  // under an elliptical crown. profAt() and glassPath() share it, so whatever is placed by profAt
  // sits exactly inside the glass that is drawn, and nothing needs a clip.
  Object.keys(GEO).forEach(function(k){ var g=GEO[k], P=g.prof, n=P.length, d=[], m=[], i;
    for(i=0;i<n-1;i++) d.push((P[i+1][1]-P[i][1])/(P[i][0]-P[i+1][0]));
    m[0]=0; m[n-1]=0; for(i=1;i<n-1;i++) m[i] = d[i-1]*d[i]<=0 ? 0 : (d[i-1]+d[i])/2;
    for(i=0;i<n-1;i++){ if(!d[i]){ m[i]=m[i+1]=0; continue; } var a=m[i]/d[i], b=m[i+1]/d[i], s=a*a+b*b; if(s>9){ var q=3/Math.sqrt(s); m[i]=q*a*d[i]; m[i+1]=q*b*d[i]; } }
    g.m=m; g.cache={}; });
  function profAt(g, y){
    var P=g.prof; if(y>=P[0][0]) return P[0][1];
    for(var i=1;i<P.length;i++){ if(y>=P[i][0]){ var a=P[i-1], b=P[i], h=a[0]-b[0], s=(a[0]-y)/h, s2=s*s, s3=s2*s;
      return (2*s3-3*s2+1)*a[1] + (s3-2*s2+s)*h*g.m[i-1] + (3*s2-2*s3)*b[1] + (s3-s2)*h*g.m[i]; } }
    var L=P[P.length-1], u=clampN((L[0]-y)/(L[0]-g.top),0,1); return L[1]*Math.sqrt(Math.max(0,1-u*u));
  }
  // Half outline [x offset, y] from yBot (default: the bottom of the glass) over the crown, cached.
  function glassPts(g, inset, yBot){
    var key=inset+':'+yBot; if(g.cache[key]) return g.cache[key];
    var P=g.prof, Ly=P[P.length-1][0], Lw=P[P.length-1][1]-inset, H=Ly-g.top-inset, y0=yBot==null ? P[0][0] : Math.min(P[0][0], yBot), pts=[], y;
    for(y=y0; y>Ly; y-=1.5) pts.push([profAt(g,y)-inset, y]);
    var th0 = y0>Ly ? 0 : Math.asin(clampN((Ly-y0)/H,0,1));
    for(var k=0;k<=24;k++){ var th=th0+(Math.PI/2-th0)*k/24; pts.push([Lw*Math.cos(th), Ly-H*Math.sin(th)]); }
    return (g.cache[key]=pts);
  }
  // The glass as a path: closed (for fills, cut flat at yBot) or open (for strokes, no bottom edge).
  function glassPath(c, g, inset, yBot, open){
    var pts=glassPts(g, inset||0, yBot), cx=TW/2, i;
    c.beginPath(); c.moveTo(cx-pts[0][0], pts[0][1]);
    for(i=1;i<pts.length;i++) c.lineTo(cx-pts[i][0], pts[i][1]);
    for(i=pts.length-2;i>=0;i--) c.lineTo(cx+pts[i][0], pts[i][1]);
    if(!open) c.closePath();
  }
  // One wall of the glass (side -1 left, +1 right) from y0 down to y1, inset from the outside.
  function wallPath(c, g, side, y0, y1, inset){ var cx=TW/2; c.beginPath(); for(var y=y0; y<=y1+0.01; y+=1.5){ var x=cx+side*(profAt(g,y)-inset); if(y===y0) c.moveTo(x,y); else c.lineTo(x,y); } }
  // A streak that hugs the glass: x at fraction k of the half-width, from y0 to y1.
  function streak(c, g, k, y0, y1){ var cx=TW/2; c.beginPath(); for(var y=y0; y<=y1; y+=2){ var x=cx+k*profAt(g,y); if(y===y0) c.moveTo(x,y); else c.lineTo(x,y); } }
  function rgba(col,a){ return 'rgba('+col[0]+','+col[1]+','+col[2]+','+clampN(a,0,1).toFixed(3)+')'; }
  function mix(a,b,t){ return [Math.round(a[0]+(b[0]-a[0])*t),Math.round(a[1]+(b[1]-a[1])*t),Math.round(a[2]+(b[2]-a[2])*t)]; }
  var THERM=[[0,0,24],[40,0,110],[130,0,160],[220,30,90],[255,110,0],[255,210,0],[255,255,230]];
  function thermRGB(t){ t=clampN(t,0,1)*(THERM.length-1); var i=Math.min(THERM.length-2,Math.floor(t)); return mix(THERM[i],THERM[i+1],t-i); }
  function thermCol(t,a){ return rgba(thermRGB(t), a==null?1:a); }
  function curLook(){ return LOOK_BY[ADV.tvFilter]||TUBE_LOOKS[0]; }
  // Grain for matte plates, bakelite and the brushed chassis: one noise tile, patterns cached per context.
  var NOISE=null, PATS=(typeof WeakMap!=='undefined') ? new WeakMap() : null;
  function noiseTile(){
    if(NOISE) return NOISE;
    var cv=document.createElement('canvas'); cv.width=cv.height=96; var x=cv.getContext('2d'), id=x.createImageData(96,96), r=mulberry32(97);
    for(var i=0;i<96*96;i++){ var v=Math.floor(105+r()*150); id.data[i*4]=id.data[i*4+1]=id.data[i*4+2]=v; id.data[i*4+3]=255; }
    x.putImageData(id,0,0); return (NOISE=cv);
  }
  function grain(c, key, sx, sy){
    var m=PATS && PATS.get(c); if(!m){ m={}; if(PATS) PATS.set(c,m); }
    if(!m[key]){ m[key]=c.createPattern(noiseTile(),'repeat'); try{ m[key].setTransform(new DOMMatrix([sx,0,0,sy,0,0])); }catch(e){} }
    return m[key];
  }
  function texture(c, key, sx, sy, alpha, x, y, w, h){
    c.save(); c.globalAlpha=alpha; c.globalCompositeOperation='overlay'; c.fillStyle=grain(c,key,sx,sy); c.fillRect(x,y,w,h); c.restore();
  }
  // What is inside each tube: plate sections (centre x, front width), side wings, box depth
  // (seen as the open top), the slot through which the cathode shows, welded tabs, filament.
  function plateSpec(t){
    var cx=TW/2;
    if(t.twin) return { secs:[cx-9.7, cx+9.7], w:13, wing:1.6, depth:7, slot: t.id==='12AU7' ? 0 : 1.3, tabs:true, rods:[-20.5,-0.9,0.9,20.5] };
    if(t.id==='EL84') return { secs:[cx], w:23, wing:2.2, depth:8, slot:2.8, tabs:true, rods:[-18.5,18.5] };
    if(t.id==='300B') return { secs:[cx-11, cx+11], w:12.5, wing:1.3, depth:5, slot:0, tabs:false, filament:true, rods:[-24,24] };
    var W = t.id==='KT88' ? 33 : t.id==='EL34' ? 29 : t.id==='6L6' ? 28 : 26;
    return { secs:[cx], w:W, wing: t.id==='KT88' ? 4.2 : 3.2, depth:10, slot:3.2, tabs:true, beam:true, rods:[-(W/2+6.5), W/2+6.5] };
  }

  function paintTube(c, now, o){
    var L=curLook(), P=L.p, B=clampN(ADV.tvBright,0,200)/100, d=o.detail||1, cx=TW/2;
    var t=TUBE_BY[TV.shown]||TUBES[0], g=GEO[t.shape], S=plateSpec(t), tt=now/1000, font=FONT || (FONT=getComputedStyle(document.body).fontFamily);
    var fl=clampN(ADV.tvFlicker,0,100)/100*0.2, flick=(1-fl)+fl*(0.5+0.5*Math.sin(tt*13.1)*Math.sin(tt*7.3+1.2));
    var heat=TV.heat*flick, glow=TV.glow, drv=ADV.drive/10, lit=!P.noLight, thermal=!!P.thermal;
    var red=clampN((ADV.bias-1.5)/3.5,0,1)*0.55 + clampN((ADV.drive-6.5)/3.5,0,1)*0.45;
    var light=function(a){ return clampN(a*B,0,1); };
    // the heater warms from dull red to orange; music lifts it a touch
    var hcol=mix(P.heatLow, P.heatCore, Math.pow(clampN(TV.heat,0,1),0.8)), hot=heat*(0.9+0.15*glow);
    var CH=g.chassis, mid=(g.pTop+g.pBot)/2, plH=g.pBot-g.pTop, rIn=function(y){ return profAt(g,y)-1.4; };
    var add=function(fn){ c.save(); c.globalCompositeOperation='lighter'; fn(); c.restore(); };
    var temp=0.30+0.30*heat+0.25*heat*glow+0.2*red*heat;          // thermal look: plate temperature

    // ---- backdrop: synthwave floor (Neon), ambient wash (Black light), bloom ----
    if(P.synth){ c.save(); c.strokeStyle='rgba(255,40,200,0.22)'; c.lineWidth=0.5;
      for(var gx=-6; gx<=6; gx++){ c.beginPath(); c.moveTo(cx+gx*6, CH); c.lineTo(cx+gx*40, CH+120); c.stroke(); }
      for(var gy=0; gy<6; gy++){ var yy=CH+Math.pow(gy/5,1.8)*120; c.beginPath(); c.moveTo(-TW,yy); c.lineTo(TW*2,yy); c.stroke(); }
      var sun=c.createLinearGradient(0,10,0,100); sun.addColorStop(0,'rgba(255,60,200,0.10)'); sun.addColorStop(1,'rgba(255,60,200,0)'); c.fillStyle=sun; c.fillRect(-TW,-TH,TW*3,TH*1.6); c.restore(); }
    if(P.ambient){ var am=c.createRadialGradient(cx,mid,4,cx,mid,TW*1.3); am.addColorStop(0,rgba(P.ambient,light(0.22*(0.4+0.6*heat)))); am.addColorStop(1,rgba(P.ambient,0)); c.fillStyle=am; c.fillRect(cx-TW*1.3,mid-TW*1.3,TW*2.6,TW*2.6); }
    // (the bloom sits on a near-black backdrop, so plain blending matches additive and costs less)
    if(lit && P.bloom && heat>0.01){ var br0=TW*0.8*(0.8+0.25*B), bl=c.createRadialGradient(cx,mid,4,cx,mid,br0);
      bl.addColorStop(0,rgba(P.bloom,light(0.16*heat*(0.65+0.8*glow)))); bl.addColorStop(1,rgba(P.bloom,0)); c.fillStyle=bl; c.beginPath(); c.arc(cx,mid,br0,0,Math.PI*2); c.fill(); }

    // ---- chassis: brushed metal, seen from a little above ----
    var chg=c.createLinearGradient(0,CH,0,CH+60); chg.addColorStop(0,P.chassisCol[0]); chg.addColorStop(1,P.chassisCol[1]);
    c.fillStyle=chg; c.fillRect(-TW, CH, TW*3, TH);
    c.save(); c.globalAlpha=0.07; c.fillStyle=grain(c,'brush',6,0.09); c.fillRect(cx-80, CH, 160, 40); c.restore();
    c.fillStyle=P.chassisEdge; c.fillRect(-TW, CH, TW*3, 0.6);
    // the tube's reflection in the chassis: glow pool, plus a faint mirrored outline
    if(lit && heat>0.01) add(function(){ var pr=c.createRadialGradient(cx,CH+5,1,cx,CH+5,48); pr.addColorStop(0,rgba(P.bloom||hcol,light(0.22*heat))); pr.addColorStop(1,rgba(P.bloom||hcol,0));
      c.save(); c.translate(cx,CH+5); c.scale(1,0.22); c.translate(-cx,-(CH+5)); c.fillStyle=pr; c.fillRect(cx-60,CH-40,120,90); c.restore(); });

    // ---- socket ----
    var sockR=(g.base?g.base[1]:g.prof[0][1])+7;
    c.beginPath(); c.ellipse(cx, CH, sockR, sockR*EK, 0, 0, Math.PI*2); c.fillStyle=P.socket; c.fill();
    c.strokeStyle=P.socketRim; c.lineWidth=0.6; c.beginPath(); c.ellipse(cx, CH-0.4, sockR, sockR*EK, 0, Math.PI, 0); c.stroke();
    for(var sc=0; sc<2; sc++){ var sxr=cx+(sc?1:-1)*(sockR+3.5); c.beginPath(); c.ellipse(sxr, CH+0.3, 2, 0.5, 0, 0, Math.PI*2); c.fillStyle='rgba(180,180,180,0.35)'; c.fill(); }

    // ---- bakelite base (octal and 4-pin tubes) ----
    if(g.base){ var bt=g.base[0], br=g.base[1];
      c.beginPath(); c.moveTo(cx-br, bt); c.lineTo(cx-br, CH); c.ellipse(cx, CH, br, br*EK, 0, Math.PI, 0, true); c.lineTo(cx+br, bt); c.ellipse(cx, bt, br, br*EK, 0, 0, Math.PI, false); c.closePath();
      var bg=c.createLinearGradient(cx-br,0,cx+br,0); bg.addColorStop(0,P.base[2]); bg.addColorStop(0.3,P.base[1]); bg.addColorStop(0.55,P.base[0]); bg.addColorStop(1,P.base[2]);
      c.fillStyle=bg; c.fill();
      c.save(); c.globalAlpha=0.25; c.globalCompositeOperation='overlay'; c.fillStyle=grain(c,'bake',0.35,0.35); c.fill(); c.restore();
      c.fillStyle='rgba(255,255,255,0.07)'; c.fillRect(cx-br*0.62, bt, br*0.16, CH-bt);
      if(lit && heat>0.01) add(function(){ var bs=c.createLinearGradient(0,bt-2,0,bt+8); bs.addColorStop(0,rgba(hcol,light(0.12*heat))); bs.addColorStop(1,rgba(hcol,0)); c.fillStyle=bs; c.fill(); });
      if(P.outline){ c.strokeStyle=rgba(P.outline,0.8); c.lineWidth=0.7; c.stroke(); }
      c.beginPath(); c.ellipse(cx, bt, br, br*EK, 0, 0, Math.PI*2); c.fillStyle=P.base[1]; c.fill(); c.strokeStyle='rgba(255,255,255,0.10)'; c.lineWidth=0.5; c.stroke();
      if(P.label!=='rgba(0,0,0,0)'){ c.save(); c.textAlign='center'; c.fillStyle='rgba(235,225,205,0.42)'; c.font='bold 5.2px '+font; c.fillText(t.id, cx, bt+(CH-bt)*0.5+1);
        if(d>=1.8){ c.font='2.6px '+font; c.fillText('DXEDGE', cx, bt+(CH-bt)*0.5+5); } c.restore(); }
    }

    // ---- inside the glass ----
    // Nothing in here is clipped: fills that would spill use the glass outline as their path, and
    // everything else is placed by profAt, which follows the same curve. On octal tubes the glass
    // goes on down into the base, so the inside stops at the base rim (iBot).
    var gBot=g.prof[0][0], iBot=g.base ? g.base[0]+1 : gBot, GR=profAt(g,mid);
    // back wall of the glass: a faint tint, and the far side catching the glow near the edges
    glassPath(c,g,0,iBot); c.fillStyle=rgba(P.glassTint, P.glassBackA); c.fill();
    if(lit && heat>0.01) add(function(){ var bw=c.createRadialGradient(0,0,0,0,0,GR); bw.addColorStop(0,rgba(hcol,0)); bw.addColorStop(0.55,rgba(hcol,light(0.018*heat))); bw.addColorStop(0.9,rgba(hcol,light(0.055*heat))); bw.addColorStop(1,rgba(hcol,0));
      glassPath(c,g,0,iBot); c.translate(cx,mid); c.scale(1,plH*0.85/GR); c.fillStyle=bw; c.fill(); });
    // getter flash: a silver mirror on the crown, fading to a brownish fringe
    var gf=g.mTop-(t.shape==='mini'?13:10), gg=c.createLinearGradient(0,g.top,0,gf);
    gg.addColorStop(0,P.getter[0]); gg.addColorStop(0.55,P.getter[1]); gg.addColorStop(0.85,P.getterEdge); gg.addColorStop(1,'rgba(0,0,0,0)');
    glassPath(c,g,0,gf); c.fillStyle=gg; c.fill();
    c.fillStyle=rgba(P.refl, P.reflA*1.4); c.beginPath(); c.ellipse(cx-profAt(g,g.top+6)*0.35, g.top+7, profAt(g,g.top+6)*0.22, 2.2, -0.3, 0, Math.PI*2); c.fill();
    // stem: the pressed glass foot with the leads running up to the bottom mica
    var stTop=g.stem, sw0=t.shape==='mini' ? 15 : 13;
    var sg=c.createLinearGradient(0,stTop,0,gBot); sg.addColorStop(0,'rgba(0,0,0,0)'); sg.addColorStop(0.35,P.stem); sg.addColorStop(1,P.stem);
    c.fillStyle=sg; c.beginPath(); c.moveTo(cx-sw0*0.45, stTop); c.lineTo(cx+sw0*0.45, stTop); c.lineTo(cx+sw0, iBot); c.lineTo(cx-sw0, iBot); c.closePath(); c.fill();
    var leads=t.shape==='mini' ? 9 : 7;
    c.strokeStyle=P.rods; c.lineWidth=0.45;
    for(var ld=0; ld<leads; ld++){ var lf=ld/(leads-1)-0.5, lx0=cx+lf*sw0*1.6, lx1=cx+lf*(S.w*S.secs.length*0.55+8);
      c.beginPath(); c.moveTo(lx0, iBot-1); c.lineTo(lx0*0.6+cx*0.4, stTop+2); c.lineTo(lx1, g.mBot+1.5); c.stroke(); }
    if(t.shape==='mini'){ for(var pn=0; pn<9; pn++){ var a=Math.PI*2*pn/9+0.35, px=cx+Math.cos(a)*9.5, py=gBot-2+Math.sin(a)*9.5*EK, back=Math.sin(a)<0;
        c.fillStyle= back ? 'rgba(150,150,150,0.35)' : 'rgba(205,205,205,0.75)'; c.fillRect(px-0.55, py-3.2, 1.1, 3.2); } }
    // support rods (nickel) from the stem up past the top mica
    c.lineCap='round';
    S.rods.forEach(function(dx){ var x=cx+dx, yb=g.stem-2; while(yb>g.mBot+2 && Math.abs(dx)+1.2>profAt(g,yb)-1.6) yb-=1;
      c.strokeStyle=P.rods; c.lineWidth=0.95; c.beginPath(); c.moveTo(x, yb); c.lineTo(x, g.mTop-4); c.stroke();
      c.strokeStyle='rgba(255,255,255,0.25)'; c.lineWidth=0.3; c.beginPath(); c.moveTo(x-0.25, yb); c.lineTo(x-0.25, g.mTop-4); c.stroke(); });
    // micas: translucent discs seen from a little above, toothed where they touch the glass
    function mica(y){
      var rx=rIn(y)-0.4, ry=rx*EK;
      if(P.fluor){ c.fillStyle=rgba(P.fluor, light(0.22)); c.beginPath(); c.ellipse(cx,y,rx+1.5,ry+1.5,0,0,Math.PI*2); c.fill(); }
      c.beginPath(); c.ellipse(cx, y, rx, ry, 0, 0, Math.PI*2);
      var mg=c.createLinearGradient(cx-rx,0,cx+rx,0); mg.addColorStop(0,P.micaEdge); mg.addColorStop(0.35,P.mica); mg.addColorStop(0.6,P.micaHi); mg.addColorStop(1,P.micaEdge);
      c.fillStyle= thermal ? thermCol(0.42+0.2*heat,0.6) : mg; c.fill();
      c.strokeStyle='rgba(255,255,255,0.22)'; c.lineWidth=0.35; c.stroke();
      c.fillStyle=P.micaEdge; c.fillRect(cx-rx, y, rx*2, 0.7);
      for(var k=0;k<3;k++){ [-1,1].forEach(function(sd){ var tx=cx+sd*(rx+0.2), ty=y-ry*0.6+k*ry*0.6; c.beginPath(); c.moveTo(tx,ty-0.5); c.lineTo(tx+sd*1,ty); c.lineTo(tx,ty+0.5); c.fillStyle=P.mica; c.fill(); }); }
      if(d>=2){ c.fillStyle='rgba(0,0,0,0.45)'; S.rods.forEach(function(dx){ c.beginPath(); c.ellipse(cx+dx, y, 0.75, 0.75*EK*2.2, 0, 0, Math.PI*2); c.fill(); });
        S.secs.forEach(function(sx){ [-S.w*0.42, S.w*0.42].forEach(function(o2){ c.beginPath(); c.ellipse(sx+o2, y, 0.55, 0.3, 0, 0, Math.PI*2); c.fill(); }); }); }
    }
    mica(g.mBot);
    // cathode sleeves, heater ends and grid side rods: everything the plates wrap around
    S.secs.forEach(function(sx){
      if(!S.filament){
        c.strokeStyle= thermal ? thermCol(0.6+0.3*heat) : P.copper; c.lineWidth=0.5;
        [-2.6,2.6].forEach(function(o2){ c.beginPath(); c.moveTo(sx+o2, g.mBot-0.5); c.lineTo(sx+o2, g.mTop+0.5); c.stroke(); });
        c.fillStyle= thermal ? thermCol(0.5+0.5*heat) : P.cathode; c.fillRect(sx-0.8, g.mTop+0.5, 1.6, g.mBot-g.mTop-1);
        if(lit && heat>0.01) add(function(){ var cg=c.createLinearGradient(sx-3,0,sx+3,0); cg.addColorStop(0,rgba(hcol,0)); cg.addColorStop(0.5,rgba(hcol,light(0.85*hot))); cg.addColorStop(1,rgba(hcol,0));
          c.fillStyle=cg; c.fillRect(sx-3, g.mTop+1, 6, g.mBot-g.mTop-2);
          [g.mTop+2.2, g.mBot-2.2].forEach(function(hy, i){ var hs=c.createRadialGradient(sx,hy,0,sx,hy,4.5); hs.addColorStop(0,rgba(mix(hcol,[255,240,200],0.5),light((i?0.55:0.9)*hot))); hs.addColorStop(1,rgba(hcol,0)); c.fillStyle=hs; c.fillRect(sx-5,hy-5,10,10); }); });
      }
    });
    // 300B: the filament itself is the light, an M hung from springs under the top mica
    if(S.filament){ var fx=[-3.4,-1.7,0,1.7,3.4], fy=function(i){ return i%2 ? g.mBot-3 : g.mTop+5; };
      fx.forEach(function(k,i){ if(i%2) return; var x=cx+k; c.strokeStyle=P.rods; c.lineWidth=0.35; c.beginPath(); for(var z=0; z<6; z++){ c.lineTo(x+(z%2?0.9:-0.9), g.mTop+0.6+z*0.75); } c.stroke(); });
      var fpath=function(){ c.beginPath(); fx.forEach(function(k,i){ if(i) c.lineTo(cx+k, fy(i)); else c.moveTo(cx+k, fy(i)); }); };
      if(lit && heat>0.01) add(function(){ fpath(); c.strokeStyle=rgba(P.filament, light(0.22*hot)); c.lineWidth=5; c.stroke(); fpath(); c.strokeStyle=rgba(P.filament, light(0.5*hot)); c.lineWidth=2.2; c.stroke(); });
      fpath(); c.strokeStyle= lit ? rgba(mix([90,60,50], mix(P.filament,[255,250,235],0.4), clampN(heat*1.1,0,1)), 1) : P.rods; c.lineWidth=0.8; c.stroke(); }
    // plates: matte carbonised boxes with wings, ribs, welded tabs and an open top
    S.secs.forEach(function(sx){
      var x0=sx-S.w/2, x1=sx+S.w/2, w=S.w, topD=S.depth*EK;
      // open top: we look down into the box; the cathode glows inside
      c.fillStyle='#050403'; c.beginPath(); c.moveTo(x0+0.4,g.pTop); c.lineTo(x0+1.6,g.pTop-topD); c.lineTo(x1-1.6,g.pTop-topD); c.lineTo(x1-0.4,g.pTop); c.closePath(); c.fill();
      if(lit && heat>0.01 && !S.filament) add(function(){ var og=c.createRadialGradient(sx,g.pTop-topD/2,0,sx,g.pTop-topD/2,w*0.35); og.addColorStop(0,rgba(hcol,light(0.9*hot))); og.addColorStop(1,rgba(hcol,0)); c.fillStyle=og; c.fillRect(x0,g.pTop-topD-2,w,topD+3); });
      c.strokeStyle= thermal ? thermCol(temp) : P.plateLip; c.lineWidth=0.5; c.beginPath(); c.moveTo(x0+1.6,g.pTop-topD); c.lineTo(x1-1.6,g.pTop-topD); c.stroke();
      // wings
      [[x0-S.wing,x0],[x1,x1+S.wing]].forEach(function(wg){ var wgg=c.createLinearGradient(wg[0],0,wg[1],0); wgg.addColorStop(0, thermal?thermCol(temp-0.25):P.plate[0]); wgg.addColorStop(1, thermal?thermCol(temp-0.1):P.plate[1]);
        c.fillStyle=wgg; c.fillRect(wg[0], g.pTop+1.2, wg[1]-wg[0], plH-2.4); c.fillStyle='rgba(255,255,255,0.10)'; c.fillRect(wg[0], g.pTop+1.2, 0.35, plH-2.4); });
      // front face
      var pg=c.createLinearGradient(x0,0,x1,0);
      if(thermal){ pg.addColorStop(0,thermCol(temp-0.15)); pg.addColorStop(0.45,thermCol(temp+0.05)); pg.addColorStop(1,thermCol(temp-0.2)); }
      else { pg.addColorStop(0,P.plate[0]); pg.addColorStop(0.4,P.plate[1]); pg.addColorStop(0.75,P.plate[2]); pg.addColorStop(1,P.plate[0]); }
      c.fillStyle=pg; c.fillRect(x0, g.pTop, w, plH);
      if(!thermal && !P.noLight) texture(c,'plate',0.3,0.3,0.24,x0,g.pTop,w,plH);
      if(P.red && red>0.02 && heat>0.3) add(function(){ c.fillStyle=rgba(P.red, light(0.8*red*heat*(0.35+0.65*glow))); c.fillRect(x0, g.pTop, w, plH); });
      // light from the gaps above and below grazing the plate edges
      if(lit && heat>0.01 && !thermal) add(function(){ var eg=c.createLinearGradient(0,g.pTop,0,g.pTop+6); eg.addColorStop(0,rgba(hcol,light(0.18*hot))); eg.addColorStop(1,rgba(hcol,0)); c.fillStyle=eg; c.fillRect(x0,g.pTop,w,6);
        var eb=c.createLinearGradient(0,g.pBot,0,g.pBot-5); eb.addColorStop(0,rgba(hcol,light(0.12*hot))); eb.addColorStop(1,rgba(hcol,0)); c.fillStyle=eb; c.fillRect(x0,g.pBot-5,w,5); });
      // pressed ribs and crimps
      var rib=function(x){ c.fillStyle='rgba(255,255,255,0.09)'; c.fillRect(x-0.5, g.pTop+2.5, 0.45, plH-5); c.fillStyle='rgba(0,0,0,0.45)'; c.fillRect(x, g.pTop+2.5, 0.5, plH-5); };
      if(w>16){ rib(x0+w*0.2); rib(x1-w*0.2); } else rib(sx+(S.slot?w*0.3:0));
      c.fillStyle='rgba(0,0,0,0.35)'; c.fillRect(x0, g.pTop+2.2, w, 0.45); c.fillRect(x0, g.pBot-2.6, w, 0.45);
      c.fillStyle='rgba(255,255,255,0.07)'; c.fillRect(x0, g.pTop+1.7, w, 0.45); c.fillRect(x0, g.pBot-3.1, w, 0.45);
      c.fillStyle='rgba(255,255,255,0.14)'; c.fillRect(x0, g.pTop, w, 0.4);
      // slot: the cathode and the wound grid seen through a window in the plate
      if(S.slot){ var sy0=g.pTop+plH*0.14, sh=plH*0.72, s2=S.slot/2;
        c.fillStyle='#060402'; c.fillRect(sx-s2, sy0, S.slot, sh);
        if(lit && heat>0.01) add(function(){ var cg=c.createLinearGradient(sx-s2,0,sx+s2,0); cg.addColorStop(0,rgba(hcol,light(0.15*hot))); cg.addColorStop(0.5,rgba(mix(hcol,[255,235,190],0.35),light(0.95*hot))); cg.addColorStop(1,rgba(hcol,light(0.15*hot)));
          c.fillStyle=cg; c.fillRect(sx-s2, sy0, S.slot, sh); });
        else if(!lit){ c.fillStyle=P.rods; c.fillRect(sx-0.6, sy0, 1.2, sh); }
        if(d>=1.6){ c.strokeStyle=P.gridLine; c.lineWidth=0.2; for(var gw=sy0+0.4; gw<sy0+sh; gw+=0.9){ c.beginPath(); c.moveTo(sx-s2,gw); c.lineTo(sx+s2,gw+0.22); c.stroke(); } }
        c.fillStyle='rgba(255,255,255,0.16)'; c.fillRect(sx-s2-0.35, sy0, 0.35, sh); c.fillStyle='rgba(0,0,0,0.5)'; c.fillRect(sx+s2, sy0, 0.4, sh); }
      // welded tabs that hold the plate in the micas
      if(S.tabs){ c.fillStyle= thermal ? thermCol(temp-0.1) : P.plate[1]; [x0+w*0.18, x1-w*0.18-1.6].forEach(function(tx){ c.fillRect(tx, g.mTop+1, 1.6, g.pTop-g.mTop-1); c.fillRect(tx, g.pBot, 1.6, g.mBot-g.pBot-1); }); }
      if(P.outline) add(function(){ c.strokeStyle=rgba(P.outline,light(0.28)); c.lineWidth=2.4; c.strokeRect(x0,g.pTop,w,plH); c.strokeStyle=rgba(P.outline,light(0.95)); c.lineWidth=0.7; c.strokeRect(x0,g.pTop,w,plH); });
    });
    // beam power tubes: the beam-forming plates peek out above and below
    if(S.beam){ c.fillStyle= thermal ? thermCol(temp-0.2) : P.plate[2]; c.fillRect(cx-S.w*0.32, g.mTop+2, S.w*0.64, 1.1); c.fillRect(cx-S.w*0.32, g.mBot-3, S.w*0.64, 1.1); }
    mica(g.mTop);
    // light spilling onto the micas
    if(lit && heat>0.01) add(function(){ S.secs.forEach(function(sx){ [g.mTop, g.mBot].forEach(function(my, i){ var ms=c.createRadialGradient(sx,my,0,sx,my,S.w*0.75); ms.addColorStop(0,rgba(hcol,light((i?0.16:0.24)*hot))); ms.addColorStop(1,rgba(hcol,0));
      c.save(); c.translate(sx,my); c.scale(1,0.3); c.translate(-sx,-my); c.fillStyle=ms; c.fillRect(sx-S.w,my-S.w,S.w*2,S.w*2); c.restore(); }); }); });
    // getter holder above the top mica
    c.strokeStyle=P.rods; c.lineWidth=0.5;
    if(t.shape==='mini'){ c.beginPath(); c.moveTo(cx+S.rods[S.rods.length-1], g.mTop-4); c.lineTo(cx+5, g.mTop-9); c.stroke(); c.lineWidth=0.9; c.beginPath(); c.ellipse(cx, g.mTop-9, 5.5, 1.3, 0, 0, Math.PI*2); c.stroke(); }
    else { c.beginPath(); c.moveTo(cx+S.rods[1], g.mTop-4); c.lineTo(cx+4, g.mTop-8); c.stroke(); c.fillStyle=P.rods; c.beginPath(); c.ellipse(cx, g.mTop-8.5, 4, 1.4, 0, 0, Math.PI*2); c.fill(); }
    // blue glow on the glass of power tubes, rising with the music
    // (stray electrons light the inside of the glass beside the plates; it swells with the music)
    if(lit && P.blue && t.blue>0 && heat>0.3) add(function(){ var ba=(P.blueBoost||1)*t.blue*heat*(0.08+0.9*Math.pow(glow,1.1)*(0.5+drv)), y0=g.pTop-4, y1=g.pBot+2;
      var vg=function(a){ var v=c.createLinearGradient(0,y0,0,y1); v.addColorStop(0,rgba(P.blue,0)); v.addColorStop(0.3,rgba(P.blue,light(a))); v.addColorStop(0.62,rgba(P.blue,light(a*0.8))); v.addColorStop(1,rgba(P.blue,0)); return v; };
      c.lineJoin='round';
      [-1,1].forEach(function(sd){ wallPath(c,g,sd,y0,y1,4.2); c.strokeStyle=vg(ba*0.22); c.lineWidth=8; c.stroke();
        wallPath(c,g,sd,y0,y1,1.9); c.strokeStyle=vg(ba*0.45); c.lineWidth=3.2; c.stroke();
        wallPath(c,g,sd,y0+4,y1-4,0.9); c.strokeStyle=vg(ba*0.6); c.lineWidth=1.1; c.stroke(); });
      var bm=c.createLinearGradient(0,g.mTop-2,0,g.mTop+2); bm.addColorStop(0,rgba(P.blue,0)); bm.addColorStop(0.5,rgba(P.blue,light(ba*0.25))); bm.addColorStop(1,rgba(P.blue,0));
      c.fillStyle=bm; c.fillRect(cx-rIn(g.mTop), g.mTop-2, rIn(g.mTop)*2, 4); });
    // fluorescent dust specks under black light
    if(P.dust){ var dr=mulberry32(hashStr('dust:'+t.id)); for(var ds=0; ds<22; ds++){ var dq=dr(), dy=g.top+8+dr()*(iBot-g.top-14), dx2=cx+(dq-0.5)*1.7*(profAt(g,dy)-2), cc= dr()<0.5 ? [120,255,200] : [180,255,120];
        var tw=0.55+0.45*Math.sin(tt*(1.5+dr()*2)+ds); c.fillStyle=rgba(cc, light(0.25*tw)); c.beginPath(); c.arc(dx2,dy,1.4,0,Math.PI*2); c.fill();
        c.fillStyle=rgba(cc, light(0.9*tw)); c.beginPath(); c.arc(dx2,dy,0.45,0,Math.PI*2); c.fill(); } }
    // X-ray: a scanning band that brightens with the music
    if(P.xray){ var yb=((tt*38)%(TH*1.3))-TH*0.15, xb=c.createLinearGradient(0,yb-10,0,yb+10); xb.addColorStop(0,'rgba(160,220,255,0)'); xb.addColorStop(0.5,'rgba(160,220,255,'+clampN(0.10+0.35*glow*B,0,0.8)+')'); xb.addColorStop(1,'rgba(160,220,255,0)');
      glassPath(c,g,0,iBot); c.fillStyle=xb; c.fill(); }
    // printed type on the glass, between the getter and the top mica (glows under black light and neon)
    var ly=(g.top+gf+8)/2+5, lw=profAt(g,ly);
    c.save(); c.textAlign='center'; c.font='bold 6.8px '+font; c.translate(cx,ly); c.scale(Math.min(1, lw/22),1);
    if(P.labelGlow){ c.fillStyle=rgba(P.labelGlow, light(0.35)); for(var k=0;k<4;k++){ c.fillText(t.id, [0.6,-0.6,0,0][k], [0,0,0.6,-0.6][k]); } }
    c.fillStyle=P.label; c.fillText(t.id, 0, 0);
    if(d>=1.8){ c.font='2.8px '+font; c.fillText('DXEDGE  ·  MADE IN USA', 0, 4.2); c.fillText('46-'+(t.id.length+3)+'  TESTED', 0, 7.4); }
    c.restore();

    // ---- the glass itself: front surface ----
    // Fresnel: the wall reflects more where we see it edge-on. The gradient is laid across the
    // widest point, so a waisted bottle keeps a clear centre and bright edges all the way up.
    var R=GR+0.5, fr=c.createLinearGradient(cx-R,0,cx+R,0);
    fr.addColorStop(0,rgba(P.glassTint,P.glassEdgeA)); fr.addColorStop(0.1,rgba(P.glassTint,P.glassEdgeA*0.45)); fr.addColorStop(0.28,rgba(P.glassTint,0));
    fr.addColorStop(0.72,rgba(P.glassTint,0)); fr.addColorStop(0.9,rgba(P.glassTint,P.glassEdgeA*0.45)); fr.addColorStop(1,rgba(P.glassTint,P.glassEdgeA));
    glassPath(c,g,0,iBot); c.fillStyle=fr; c.fill();
    c.lineJoin='round'; c.lineCap='butt';
    [-1,1].forEach(function(sd){ wallPath(c,g,sd,g.prof[g.prof.length-1][0],iBot-1,0.9); c.strokeStyle=rgba(P.glassTint,P.glassEdgeA*0.6); c.lineWidth=1.6; c.stroke(); });
    // the glow scattering in the glass wall beside the plates
    if(lit && heat>0.01) add(function(){ var wv=c.createLinearGradient(0,g.pTop,0,g.pBot); wv.addColorStop(0,rgba(hcol,0)); wv.addColorStop(0.5,rgba(hcol,light(0.07*heat))); wv.addColorStop(1,rgba(hcol,0));
      [-1,1].forEach(function(sd){ wallPath(c,g,sd,g.pTop,g.pBot,1.3); c.strokeStyle=wv; c.lineWidth=2.4; c.stroke(); }); });
    // outline, wall thickness, specular streaks
    if(P.glassGlow) add(function(){ glassPath(c,g,0,iBot-0.5,true); c.strokeStyle=rgba(P.glassGlow, light(0.25)); c.lineWidth=3; c.stroke(); });
    c.save();
    glassPath(c,g,0,iBot-0.5,true); c.strokeStyle=P.glassStroke; c.lineWidth=0.75; c.stroke();
    glassPath(c,g,1.2,iBot-1,true); c.strokeStyle=rgba(P.refl, P.reflA*0.45); c.lineWidth=0.4; c.stroke();
    if(P.reflA>0){
      var y0=g.top+5, y1=(g.base?g.base[0]:gBot)-4;
      streak(c,g,-0.68,y0+4,y1); c.strokeStyle=rgba(P.refl,P.reflA*0.28); c.lineWidth=4.2; c.stroke();
      streak(c,g,-0.68,y0+6,y1-2); c.strokeStyle=rgba(P.refl,P.reflA*0.6); c.lineWidth=1.7; c.stroke();
      streak(c,g,-0.7,y0+10,y1-6); c.strokeStyle=rgba(P.refl,Math.min(1,P.reflA*2.4)); c.lineWidth=0.5; c.stroke();
      streak(c,g,0.82,y0+12,y1-4); c.strokeStyle=rgba(P.refl,P.reflA*0.5); c.lineWidth=1.1; c.stroke();
      streak(c,g,0.84,y0+16,y1-8); c.strokeStyle=rgba(P.refl,P.reflA*1.2); c.lineWidth=0.3; c.stroke();
      // a softbox reflection on the shoulder
      var sbY=g.mTop+4, sbx=cx-profAt(g,sbY)*0.42; c.fillStyle=rgba(P.refl,P.reflA*0.32); c.beginPath(); c.ellipse(sbx, sbY+6, 2.2, 7, 0, 0, Math.PI*2); c.fill();
      c.strokeStyle=rgba(P.refl,P.reflA*0.7); c.lineWidth=1; c.beginPath(); c.arc(cx, g.top+profAt(g,g.top+10)*0.95, profAt(g,g.top+10)*0.72, Math.PI*1.18, Math.PI*1.45); c.stroke();
    }
    c.restore();
    // the tip-off pip on 9-pin tubes, and the glass meeting the socket
    if(g.pip){ c.beginPath(); c.moveTo(cx-2.4, g.top+0.6); c.quadraticCurveTo(cx-2.2, g.top-2.6, cx, g.top-2.8); c.quadraticCurveTo(cx+2.2, g.top-2.6, cx+2.4, g.top+0.6); c.closePath();
      c.fillStyle=rgba(P.glassTint,0.18); c.fill(); c.strokeStyle=P.glassStroke; c.lineWidth=0.5; c.stroke(); c.fillStyle=rgba(P.refl,P.reflA*1.5); c.fillRect(cx-1.2, g.top-2.1, 0.5, 1.6); }
    if(!g.base){ c.beginPath(); c.ellipse(cx, gBot, g.prof[0][1], g.prof[0][1]*EK, 0, 0, Math.PI); c.strokeStyle=P.glassStroke; c.lineWidth=0.6; c.stroke(); }
    if(o.view==='rack' && TV.heat<0.05 && !(ADV.on&&ADV.tubeOn)){ c.fillStyle='#6a6a6a'; c.font='9px '+font; c.textAlign='center'; c.fillText('STANDBY', cx, TH-3); c.textAlign='start'; }
  }
  // Night vision and Vintage photo overlays, drawn in device pixels after the tube.
  function lookOverlay(c, W, H, L, now){
    if(!L.overlay) return;
    var rnd=Math.random, tt=now/1000;
    if(L.overlay==='night'){
      c.fillStyle='rgba(0,0,0,0.16)'; for(var y=0;y<H;y+=3) c.fillRect(0,y,W,1);
      c.fillStyle='rgba(255,255,255,0.10)'; for(var i=0;i<Math.min(900,W*H/900);i++) c.fillRect(rnd()*W, rnd()*H, 1.5, 1.5);
      var v=c.createRadialGradient(W/2,H/2,Math.min(W,H)*0.3,W/2,H/2,Math.max(W,H)*0.62); v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,0.85)'); c.fillStyle=v; c.fillRect(0,0,W,H);
    } else {
      c.fillStyle='rgba(255,240,210,'+(0.02+0.02*Math.sin(tt*9))+')'; c.fillRect(0,0,W,H);
      c.fillStyle='rgba(0,0,0,0.10)'; for(var j=0;j<Math.min(1200,W*H/600);j++) c.fillRect(rnd()*W, rnd()*H, 1, 1);
      var v2=c.createRadialGradient(W/2,H/2,Math.min(W,H)*0.25,W/2,H/2,Math.max(W,H)*0.7); v2.addColorStop(0,'rgba(0,0,0,0)'); v2.addColorStop(1,'rgba(30,18,6,0.75)'); c.fillStyle=v2; c.fillRect(0,0,W,H);
    }
  }
  // Paint into a canvas: fit (or zoom) the 120 x 200 tube space into it.
  function renderTube(cv, now, view, z, px, py, q){
    var f=fitCanvas(cv, q); if(!f) return null; tubeTick(now);
    var c=f.c, r=f.r, L=curLook(), W=cv.width, H=cv.height;
    var s=Math.min(f.w/TW, f.h/TH)*(view==='big'?0.94:1)*(z||1), tx=f.w/2-(TW/2+(px||0))*s, ty=f.h/2-(TH/2+(py||0))*s;
    if(cv.style.filter!==(L.css||'')) cv.style.filter=L.css||'';
    c.setTransform(1,0,0,1,0,0);
    var bg = L.p.bg || (view==='big' ? '#060504' : null); if(bg){ c.fillStyle=bg; c.fillRect(0,0,W,H); } else c.clearRect(0,0,W,H);
    c.setTransform(r*s,0,0,r*s,r*tx,r*ty);
    paintTube(c, now, { detail:r*s, view:view });
    c.setTransform(1,0,0,1,0,0); lookOverlay(c, W, H, L, now);
    return { s:s, tx:tx, ty:ty, w:f.w, h:f.h };
  }
// ---- copied block ends ----

// ======================================================================
// ---- Filament additions (not in /otr) ----
// /otr has one tube, so its painter reads the rack state (ADV) and the Tube view
// state (TV) from globals. The synth has four, each with its own state object
// { shown, heat, glow, drive, bias, on, tubeOn, tvFilter, tvBright, tvFlicker }.
// paintTubeState() points both names at that object for the length of one paint.
// ======================================================================
import { TUBES, TUBE_BY } from './rack.js';
var ADV = null, TV = null;
function tubeTick(){}                       // the synth advances heat and glow itself
function paintTubeState(cv, now, st, view){ ADV = st; TV = st; return renderTube(cv, now, view||'rack'); }
export { paintTubeState, TUBE_LOOKS, LOOK_BY, fitCanvas, rgba, mix };
