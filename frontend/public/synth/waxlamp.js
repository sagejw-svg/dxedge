// Filament wax lamp: the /otr lava lamp (its wax simulation and its painter) and the synth's module around it.
// On the page it is the "Wax lamp": "lava lamp" is close to a registered mark (LAVA), so the synth's UI and its own
// names avoid it; the copied block keeps /otr's names and comments as they are.
// COPIED from /otr/index.html at commit 573e0dd (lines 3119-3133, 4242-4975), per the Filament
// design brief, decision 5 (the lava lamp is on the brief's list of what carries over from /otr):
// the synth carries its own copy of the /otr code instead of sharing it through /lib/. The copied
// block is verbatim; anything the synth adds is below the "Filament additions" line. If the two
// ever need to be merged into /lib/, diff the copied block against /otr at that commit first.

// ---- copied block starts ----
  // Lava lamp colourways (wax, liquid, what the wax fluoresces under black light, its neon line) and base finishes.
  var LAMP_COLS = [
    { id:'classic', name:'Red / yellow',   wax:[222,48,22],   liq:[255,186,44],  uv:[255,96,70],   neon:[255,40,160] },
    { id:'blue',    name:'White / blue',   wax:[244,240,230], liq:[34,104,255],  uv:[190,225,255], neon:[0,240,255] },
    { id:'orange',  name:'Orange / clear', wax:[255,118,18],  liq:[255,236,205], uv:[255,150,40],  neon:[255,140,0], clear:true },
    { id:'purple',  name:'Pink / purple',  wax:[255,84,168],  liq:[118,36,206],  uv:[255,110,220], neon:[255,60,220] },
    { id:'green',   name:'Yellow / green', wax:[255,212,34],  liq:[34,186,84],   uv:[230,255,60],  neon:[160,255,40] },
    { id:'bclear',  name:'Blue / clear',   wax:[44,110,255],  liq:[226,240,255], uv:[90,170,255],  neon:[60,140,255], clear:true }
  ];
  var LAMP_BASES = [
    { id:'gold',   name:'Gold',   m:['#2a1c06','#7a5718','#e8c06a','#fff0c2','#a07226'] },
    { id:'silver', name:'Chrome', m:['#1c1e21','#5a6068','#d6dce2','#ffffff','#8a9098'] },
    { id:'black',  name:'Black',  m:['#060606','#1a1a1a','#4a4a4a','#9a9a9a','#262626'] }
  ];
  var LCOL_BY={}, LBASE_BY={}; LAMP_COLS.forEach(function(x){ LCOL_BY[x.id]=x; }); LAMP_BASES.forEach(function(x){ LBASE_BY[x.id]=x; });

  // ---- Lava lamp physics ----
  // A slice through the lamp in the 120 x 200 logical space the tube uses (y grows down), in
  // seconds and degrees C. Nothing is scripted or looped; everything comes from these rules plus a
  // little noise, so no two evenings are the same.
  //  Wax: parcels of molten paraffin, each with its own volume, heat and velocity; a blob is every
  //   parcel joined by necks, and a big blob is many parcels. Paraffin expands two to three times more
  //   than the liquid when warmed, so wax rises when it is hotter than the crossover temperature and
  //   sinks when it cools below it. It melts over a latent-heat plateau; solid wax is heavy and stuck
  //   where it lies. Drag is Stokes-like and belongs to the whole blob, so big blobs move faster than
  //   small ones (up to blobs nearly as wide as the bottle, which the walls hold back).
  //  Heat: wax trades heat with the liquid only through surface the liquid can reach (wax pressed
  //   against wax is not in contact), so big blobs and the pool hold their heat and small blobs cool
  //   fast. A blob moving through the liquid is stirred inside, so its parcels share heat quickly; the
  //   pool lying on the bottom is not, so it stays hottest over the coil and coolest at its edges.
  //   The bulb warms the bottom of the glass and the liquid; the coil is a hot surface, hottest in the
  //   middle, that passes heat to wax lying on it in proportion to the difference, so the pool warms
  //   toward the coil's temperature rather than without limit. Glass and cap lose heat to the room.
  //  Necks: parcels of one blob are joined by threads of wax that pull them together (surface
  //   tension). A thread thins as it is stretched (its volume is conserved) and breaks once it is
  //   longer than its own circumference (Rayleigh-Plateau), sometimes leaving a satellite droplet.
  //   Parcels of different blobs that stay pressed together long enough for the film of liquid
  //   between them to drain grow a neck and become one blob; neighbours inside a blob fuse.
  //  Liquid: a coarse grid with its own temperature and incompressible flow (buoyancy, viscosity,
  //   pressure projection, advection), dragged by the wax and dragging it back.
  // Warm-up, the first tower pushing up through the cake, a pool that stays on the coil and buds
  // blobs of every size, merging, stalling under the cap when the lamp runs hot, and the wax setting
  // again when it is switched off all follow from those rules.
  function makeLava(seed){
    var rnd=mulberry32((seed>>>0)||1);
    var CX=60, Y0=33.5, Y1=126.5, TROOM=22, TM=34, TX=48, LAT=10;
    var PROF=[[128,19],[114,21.6],[96,21],[70,18.2],[46,14.6],[26,12.4]], PM=[];
    (function(){ var n=PROF.length, d=[], i; for(i=0;i<n-1;i++) d.push((PROF[i+1][1]-PROF[i][1])/(PROF[i][0]-PROF[i+1][0]));
      PM[0]=0; PM[n-1]=0; for(i=1;i<n-1;i++) PM[i] = d[i-1]*d[i]<=0 ? 0 : (d[i-1]+d[i])/2;
      for(i=0;i<n-1;i++){ if(!d[i]){ PM[i]=PM[i+1]=0; continue; } var a=PM[i]/d[i], b=PM[i+1]/d[i], s=a*a+b*b; if(s>9){ var q=3/Math.sqrt(s); PM[i]=q*a*d[i]; PM[i+1]=q*b*d[i]; } } })();
    function outer(y){ var P=PROF; if(y>=P[0][0]) return P[0][1]; for(var i=1;i<P.length;i++){ if(y>=P[i][0]){ var a=P[i-1], b=P[i], h=a[0]-b[0], s=(a[0]-y)/h, s2=s*s, s3=s2*s;
      return (2*s3-3*s2+1)*a[1]+(s3-2*s2+s)*h*PM[i-1]+(3*s2-2*s3)*b[1]+(s3-s2)*h*PM[i]; } } return P[P.length-1][1]; }
    function inner(y){ return outer(y)-1.4; }
    // the bottom of the bottle dishes down a little toward the coil in the middle
    function floorY(x){ var w=inner(Y1), u=(x-CX)/w; return Y1-2.2*u*u; }

    // ---- the liquid grid ----
    var CS=2.5, GX=18, GY=Math.ceil((Y1-Y0)/CS), GN=GX*GY, GX0=CX-GX*CS/2, CC=2.6;
    var M=new Uint8Array(GN), TL=new Float32Array(GN), U=new Float32Array(GN), V=new Float32Array(GN), T2=new Float32Array(GN), U2=new Float32Array(GN), V2=new Float32Array(GN),
        PR=new Float32Array(GN), DV=new Float32Array(GN), FU=new Float32Array(GN), FV=new Float32Array(GN), EDGE=new Uint8Array(GN), BOT=new Float32Array(GN), i, j, k;
    for(j=0;j<GY;j++) for(i=0;i<GX;i++){ var xc=GX0+(i+0.5)*CS, yc=Y0+(j+0.5)*CS; M[j*GX+i] = Math.abs(xc-CX)<inner(Math.min(yc,Y1))-0.4 ? 1 : 0; }
    for(j=0;j<GY;j++) for(i=0;i<GX;i++){ k=j*GX+i; if(!M[k]) continue; EDGE[k]=(i===0||!M[k-1])+(i===GX-1||!M[k+1]);
      if(j>=GY-2){ BOT[k]=0.25+Math.exp(-Math.pow((GX0+(i+0.5)*CS-CX)/9,2)); } }
    var bs=0; for(k=0;k<GN;k++) bs+=BOT[k]; for(k=0;k<GN;k++) BOT[k]/=bs;
    function cellAt(x,y){ var a=Math.floor((x-GX0)/CS), b=Math.floor((y-Y0)/CS); if(a<0) a=0; else if(a>=GX) a=GX-1; if(b<0) b=0; else if(b>=GY) b=GY-1; return b*GX+a; }
    function bil(A,x,y){ var fx=(x-GX0)/CS-0.5, fy=(y-Y0)/CS-0.5; if(fx<0) fx=0; else if(fx>GX-1.001) fx=GX-1.001; if(fy<0) fy=0; else if(fy>GY-1.001) fy=GY-1.001;
      var a=fx|0, b=fy|0, s=fx-a, t=fy-b, q=b*GX+a; return (A[q]*(1-s)+A[q+1]*s)*(1-t)+(A[q+GX]*(1-s)+A[q+GX+1]*s)*t; }
    // spread an amount over the cells a disc covers (heat and momentum from a blob go into all of them)
    function spread(A, x, y, r, amt, cap){
      var a0=Math.max(0,Math.floor((x-r-GX0)/CS)), a1=Math.min(GX-1,Math.floor((x+r-GX0)/CS)), b0=Math.max(0,Math.floor((y-r-Y0)/CS)), b1=Math.min(GY-1,Math.floor((y+r-Y0)/CS)), n=0, a, b;
      for(b=b0;b<=b1;b++) for(a=a0;a<=a1;a++) if(M[b*GX+a]) n++;
      if(!n){ A[cellAt(x,y)]+=amt/cap; return; } var per=amt/(n*cap); for(b=b0;b<=b1;b++) for(a=a0;a<=a1;a++){ var q=b*GX+a; if(M[q]) A[q]+=per; }
    }
    function avgIn(A, x, y, r){
      var a0=Math.max(0,Math.floor((x-r-GX0)/CS)), a1=Math.min(GX-1,Math.floor((x+r-GX0)/CS)), b0=Math.max(0,Math.floor((y-r-Y0)/CS)), b1=Math.min(GY-1,Math.floor((y+r-Y0)/CS)), n=0, s=0, a, b;
      for(b=b0;b<=b1;b++) for(a=a0;a<=a1;a++){ var q=b*GX+a; if(M[q]){ s+=A[q]; n++; } } return n ? s/n : bil(A,x,y);
    }

    // ---- wax ----
    var CW=0.28, VMAX=90, RWALL=9, area=0, yy;
    for(yy=Y0; yy<Y1; yy+=0.5) area+=2*inner(yy)*0.5;
    var WF=0.27, WAX=area*WF, L=[], LINKS=[], CONTACT={}, nextId=1;
    var S={ t:0, power:1, on:true, music:0, seed:seed, lobes:L, links:LINKS };
    function lobe(x,y,v,e){ var o={ id:nextId++, x:x, y:y, vx:0, vy:0, v:v, r:Math.sqrt(v/Math.PI), e:e, T:0, f:0, rest:0, sq:0, el:0, ang:0, ex:1 }; phase(o); return o; }
    function phase(o){ var e=o.e; if(e<TM){ o.T=e; o.f=0; } else if(e<TM+LAT){ o.T=TM; o.f=(e-TM)/LAT; } else { o.T=e-LAT; o.f=1; } }
    function link(a,b,rn,L0){ LINKS.push({ a:a, b:b, rn0:rn, L0:L0, rn:rn }); }
    function reset(){
      L.length=0; LINKS.length=0; CONTACT={};
      // a cold cake of wax across the bottom: two courses of parcels, each joined to its neighbours
      var n=Math.max(4,Math.round(WAX/(VMAX*0.55))), n1=Math.ceil(n/2), v=WAX/n, r0=Math.sqrt(v/Math.PI), w=inner(Y1-3)-2, lo=[], hi=[], i, x, o;
      for(i=0;i<n1;i++){ x=CX-w+(2*w)*(i+0.5)/n1; o=lobe(x, 0, v, TROOM); o.y=floorY(x)-o.r*0.55; L.push(o); lo.push(o); }
      for(i=0;i<n-n1;i++){ x=CX-(w-r0)+(2*(w-r0))*(i+0.5)/(n-n1); o=lobe(x, 0, v, TROOM); o.y=floorY(x)-o.r*0.55-r0*1.25; L.push(o); hi.push(o); }
      var join=function(a,b){ link(a, b, Math.min(a.r,b.r)*0.9, Math.hypot(b.x-a.x, b.y-a.y)); };
      for(i=1;i<lo.length;i++) join(lo[i-1], lo[i]); for(i=1;i<hi.length;i++) join(hi[i-1], hi[i]);
      hi.forEach(function(u){ lo.slice().sort(function(p,q){ return Math.abs(p.x-u.x)-Math.abs(q.x-u.x); }).slice(0,2).forEach(function(d){ join(d,u); }); });
      for(k=0;k<GN;k++){ TL[k]=TROOM; U[k]=V[k]=0; PR[k]=0; }
      S.t=0;
    }

    // ---- one step ----
    var DT=1/60, liqAcc=0;
    // blob membership from the links (union-find), so contacts know whether they are inside one blob
    function blobsOf(){ var par={}, i; function f(a){ while(par[a]!==a){ par[a]=par[par[a]]; a=par[a]; } return a; }
      for(i=0;i<L.length;i++) par[L[i].id]=L[i].id;
      for(i=0;i<LINKS.length;i++){ var a=f(LINKS[i].a.id), b=f(LINKS[i].b.id); if(a!==b) par[a]=b; }
      for(i=0;i<L.length;i++) L[i].blob=f(L[i].id); }
    // the share of a's surface that b covers (wax pressed against wax trades no heat with the liquid)
    function occl(ra, rb, d){ if(d>=ra+rb) return 0; if(d<=Math.abs(rb-ra)) return rb>ra ? 1 : 0; return Math.acos(Math.max(-1,Math.min(1,(d*d+ra*ra-rb*rb)/(2*d*ra))))/Math.PI; }
    function linked(a,b){ for(var i=0;i<LINKS.length;i++){ var l=LINKS[i]; if((l.a===a&&l.b===b)||(l.a===b&&l.b===a)) return l; } return null; }
    function step(){
      var dt=DT, P=S.on ? S.power*(1+0.6*S.music) : 0, n=L.length, i, a, b, o;
      for(i=0;i<n;i++){ L[i].px=L[i].x; L[i].py=L[i].y; }   // where it was a step ago, so drawing can go smoothly between steps
      blobsOf();
      var BV={}, BF={}; for(i=0;i<n;i++){ o=L[i]; BV[o.blob]=(BV[o.blob]||0)+o.v; if(o.rest>0.5) BF[o.blob]=1; o.ex=1-0.3*o.rest; }
      // forces from the liquid: buoyancy, drag (Stokes: 1/r per unit mass, r of the whole blob, held
      // down for blobs nearly as wide as the bottle, which the walls slow), and a nudge now and then
      // standing in for eddies smaller than the liquid grid can show
      for(i=0;i<n;i++){ o=L[i]; var Rb=Math.min(RWALL, Math.sqrt(BV[o.blob]/Math.PI));
        var tl=bil(TL,o.x,o.y), acc=1.0*((o.T-TX)-BL*(tl-TX)) - (1-o.f)*8;
        o.vy-=acc*dt;
        var g=3.0/Math.max(1,Rb)*(0.6+0.4*o.f), ul=bil(U,o.x,o.y), vl=bil(V,o.x,o.y), fr=1-Math.exp(-g*dt), dvx=(ul-o.vx)*fr, dvy=(vl-o.vy)*fr;
        o.vx+=dvx; o.vy+=dvy; spread(FU,o.x,o.y,o.r,-dvx*o.v*0.12,1); spread(FV,o.x,o.y,o.r,-dvy*o.v*0.12,1);
        if(o.f>0.5){ o.vx+=(rnd()-0.5)*0.5*dt*60*0.05; o.vy+=(rnd()-0.5)*0.5*dt*60*0.05; }
      }
      // necks: surface tension pulls a blob's parcels together; stretched necks thin and break
      for(i=LINKS.length-1;i>=0;i--){ var l=LINKS[i]; a=l.a; b=l.b;
        var dx=b.x-a.x, dy=b.y-a.y, d=Math.sqrt(dx*dx+dy*dy)||1e-6, nx=dx/d, ny=dy/d, solid=Math.min(a.f,b.f)<0.5;
        l.rn=l.rn0*Math.sqrt(l.L0/Math.max(l.L0,d));
        var gap=d-(a.r+b.r)*0.8;
        if(!solid && (l.rn<0.5 || (gap>0 && gap>Math.PI*2*l.rn))){
          // the thread breaks; a thick one leaves a satellite droplet behind
          LINKS.splice(i,1);
          if(l.rn>1.2 && gap>2 && rnd()<0.12){ var sv=Math.min(Math.PI*l.rn*l.rn*0.8, a.v*0.15, b.v*0.15); a.v-=sv/2; b.v-=sv/2; a.r=Math.sqrt(a.v/Math.PI); b.r=Math.sqrt(b.v/Math.PI);
            var s=lobe((a.x+b.x)/2,(a.y+b.y)/2,sv,(a.e+b.e)/2); s.vx=(a.vx+b.vx)/2; s.vy=(a.vy+b.vy)/2; L.push(s); }
          continue; }
        // tension ~ circumference of the neck; viscous damping along the neck
        var ma=a.v, mb=b.v, ten=(solid?40:TEN)*l.rn*(gap>-a.r*0.3 ? 1 : 0.3), rv=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny, damp=(solid?1:0.25)*l.rn*rv;
        var Fm=(ten+damp)*dt*KT; a.vx+=Fm*nx/ma; a.vy+=Fm*ny/ma; b.vx-=Fm*nx/mb; b.vy-=Fm*ny/mb;
        // a neck that is pressed together grows thicker (the blobs are flowing into one)
        if(d<l.L0){ l.L0=Math.max(d,(a.r+b.r)*0.5); l.rn0=Math.min(0.85*Math.min(a.r,b.r), l.rn0+0.6*dt); }
        // heat runs along the neck
        var q=(BF[a.blob]?KN:KF)*l.rn*(b.T-a.T)*dt; a.e+=q/(a.v*CW); b.e-=q/(b.v*CW);
      }
      // contacts: push apart; parcels of different blobs pressed together long enough coalesce;
      // neighbours inside one blob fuse while the result is not too big
      var fused=false;
      for(i=0;i<L.length;i++){ a=L[i]; for(var jj=i+1;jj<L.length;jj++){ b=L[jj];
        var ex=b.x-a.x, ey=b.y-a.y, dd=Math.sqrt(ex*ex+ey*ey)||1e-6, touch=(a.r+b.r)*0.95;
        var key=a.id<b.id ? a.id+':'+b.id : b.id+':'+a.id;
        if(dd>=touch){ if(CONTACT[key]) delete CONTACT[key]; continue; }
        var ux=ex/dd, uy=ey/dd, same=a.blob===b.blob, ov=(same?(a.r+b.r)*0.62:touch)-dd;
        a.ex-=occl(a.r,b.r,dd); b.ex-=occl(b.r,a.r,dd);
        if(same && dd<(a.r+b.r)*0.66 && a.v+b.v<=VMAX && a.f>0.6 && b.f>0.6){ fuse(a,b); fused=true; break; }
        if(ov>0){ var push=(same?8:22)*ov*dt, wa=b.v/(a.v+b.v), wb=a.v/(a.v+b.v);
          a.vx-=push*ux*wa; a.vy-=push*uy*wa; b.vx+=push*ux*wb; b.vy+=push*uy*wb; }
        if(!same && a.f>0.7 && b.f>0.7){ var tm=(a.T+b.T)/2, rr=a.r*b.r/(a.r+b.r), need=1.6*Math.exp(-(tm-50)/9)*(0.6+0.8*rnd())*Math.min(1,rr*rr/2.56);   // the film drains faster under a small drop
          // (the new neck is never thinner than the 0.5 at which necks part, or a droplet under 1.43 across
          // would be joined and then parted again on the very next step, every time it tried)
          CONTACT[key]=(CONTACT[key]||0)+dt*(0.5+ov); if(CONTACT[key]>need){ delete CONTACT[key]; link(a,b,Math.max(0.55,0.35*Math.min(a.r,b.r)),dd); } }
        var q2=(same?(BF[a.blob]?KN:KF):0.05)*Math.min(a.r,b.r)*(b.T-a.T)*dt; a.e+=q2/(a.v*CW); b.e-=q2/(b.v*CW);
      } if(fused) break; }
      // move; keep inside the glass, above the dished floor, below the surface
      for(i=0;i<L.length;i++){ o=L[i];
        if(o.f<0.5 && o.rest>0.5){ o.vx=0; o.vy=Math.max(0,o.vy); }   // solid wax on the bottom stays put
        o.x+=o.vx*dt; o.y+=o.vy*dt;
        var ry=o.r*(1-0.38*o.rest), fy=floorY(o.x), w=inner(o.y)-o.r*0.92;
        if(o.x>CX+w){ o.x=CX+w; if(o.vx>0) o.vx*=-0.1; o.vy*=0.97; } else if(o.x<CX-w){ o.x=CX-w; if(o.vx<0) o.vx*=-0.1; o.vy*=0.97; }
        var onFloor=o.y+ry>=fy-0.05;
        if(o.y+ry>fy){ o.y=fy-ry; if(o.vy>0) o.vy=0; o.vx*=0.985; o.vx+=(CX-o.x)*0.02*dt*60*0.05; }
        if(o.y-ry*1.0<Y0+0.3){ o.y=Y0+0.3+ry; if(o.vy<0) o.vy=0; o.vx*=0.99; }
        o.rest+=((onFloor?1:0)-o.rest)*(1-Math.exp(-dt*3));
        o.sq+=(((o.y-ry<Y0+0.6)?1:0)-o.sq)*(1-Math.exp(-dt*3));    // flattening under the cap
        var sp=Math.sqrt(o.vx*o.vx+o.vy*o.vy); o.el+=(Math.min(0.2, sp*0.02*o.f)-o.el)*(1-Math.exp(-dt*2)); if(sp>0.3) o.ang=Math.atan2(o.vy,o.vx);
      }
      // heat: the coil under the wax, wax <-> liquid across each blob's surface
      for(i=0;i<L.length;i++){ o=L[i];
        // the coil and the hot glass bottom: hotter than the liquid above them, most in the middle over
        // the bulb, and they pass heat to wax lying on them in proportion to the difference, so wax
        // on the coil warms toward the coil's temperature rather than without limit
        var gapF=Math.max(0, floorY(o.x)-(o.y+o.r*(1-0.38*o.rest))), prox=Math.exp(-gapF/3);
        if(prox>0.02){ var tfl=bil(TL,o.x,Y1-CS)+P*DF*(FE+(1-FE)*Math.exp(-Math.pow((o.x-CX)/FW,2))); o.e+=KC*o.r*prox*(tfl-o.T)*dt/(o.v*CW); }
        var tl2=avgIn(TL,o.x,o.y,o.r), Q=HX*2*Math.PI*o.r*Math.max(0.15,o.ex)*(tl2-o.T)*dt;
        o.e+=Q/(o.v*CW); spread(TL,o.x,o.y,o.r,-Q,CC); phase(o);
      }
      // parcels too big to stay round split in two along the way they are moving
      for(i=0;i<L.length;i++){ o=L[i]; if(o.v>VMAX*1.02){ var half=o.v/2, ang=o.rest>0.5?0:o.ang+Math.PI/2, ca=Math.cos(ang), sa=Math.sin(ang), r2=Math.sqrt(half/Math.PI);
          var c=lobe(o.x+ca*r2*0.6, o.y+sa*r2*0.6, half, o.e); c.vx=o.vx; c.vy=o.vy; c.rest=o.rest;
          o.v=half; o.r=r2; o.x-=ca*r2*0.6; o.y-=sa*r2*0.6; L.push(c); link(o,c,r2*0.8,r2*1.2); } }
      liqAcc+=dt; if(liqAcc>=2*DT-1e-9){ liquid(liqAcc, P); liqAcc=0; }
      S.t+=dt;
    }
    function fuse(a,b){
      var v=a.v+b.v, wa=a.v/v, wb=b.v/v;
      a.x=a.x*wa+b.x*wb; a.y=a.y*wa+b.y*wb; a.vx=a.vx*wa+b.vx*wb; a.vy=a.vy*wa+b.vy*wb; a.e=a.e*wa+b.e*wb; a.rest=Math.max(a.rest,b.rest);
      a.v=v; a.r=Math.sqrt(v/Math.PI); phase(a);
      for(var i=LINKS.length-1;i>=0;i--){ var l=LINKS[i]; if(l.a===b) l.a=a; if(l.b===b) l.b=a; if(l.a===l.b) LINKS.splice(i,1); }
      // drop duplicate links between the same two parcels
      var seen={}; for(i=LINKS.length-1;i>=0;i--){ var l2=LINKS[i], key=Math.min(l2.a.id,l2.b.id)+':'+Math.max(l2.a.id,l2.b.id); if(seen[key]) LINKS.splice(i,1); else seen[key]=1; }
      L.splice(L.indexOf(b),1);
      // b is gone and its number is never used again: drop the contact timers it was in, or they are kept for ever
      for(var ck in CONTACT){ var cp=ck.split(':'); if(+cp[0]===b.id || +cp[1]===b.id) delete CONTACT[ck]; }
    }

    // ---- the liquid ----
    function liquid(dt, P){
      var i, j, k, s=0, n=0;
      for(k=0;k<GN;k++) if(M[k]){ s+=TL[k]; n++; } var tav=s/n;
      for(k=0;k<GN;k++){ if(!M[k]){ U[k]=V[k]=0; FU[k]=FV[k]=0; continue; } V[k]+=-0.25*(TL[k]-tav)*dt + FV[k]; U[k]+=FU[k]; FU[k]=FV[k]=0; }
      var nu=3*dt/(CS*CS);
      for(j=0;j<GY;j++) for(i=0;i<GX;i++){ k=j*GX+i; if(!M[k]){ U2[k]=V2[k]=0; continue; }
        var uL=i>0&&M[k-1]?U[k-1]:0, uR=i<GX-1&&M[k+1]?U[k+1]:0, uU=j>0&&M[k-GX]?U[k-GX]:0, uD=j<GY-1&&M[k+GX]?U[k+GX]:0;
        var vL=i>0&&M[k-1]?V[k-1]:0, vR=i<GX-1&&M[k+1]?V[k+1]:0, vU=j>0&&M[k-GX]?V[k-GX]:0, vD=j<GY-1&&M[k+GX]?V[k+GX]:0;
        U2[k]=U[k]+nu*(uL+uR+uU+uD-4*U[k]); V2[k]=V[k]+nu*(vL+vR+vU+vD-4*V[k]); }
      U.set(U2); V.set(V2); project();
      for(j=0;j<GY;j++) for(i=0;i<GX;i++){ k=j*GX+i; if(!M[k]){ U2[k]=V2[k]=0; T2[k]=TL[k]; continue; }
        var x=GX0+(i+0.5)*CS-U[k]*dt, y=Y0+(j+0.5)*CS-V[k]*dt; U2[k]=bil(U,x,y); V2[k]=bil(V,x,y); T2[k]=bil(TL,x,y); }
      U.set(U2); V.set(V2); TL.set(T2); project();
      var kap=1.4*dt/(CS*CS), qb=P*QB*dt;
      for(j=0;j<GY;j++) for(i=0;i<GX;i++){ k=j*GX+i; if(!M[k]){ T2[k]=TL[k]; continue; }
        var tl=TL[k], L2=i>0&&M[k-1]?TL[k-1]:tl, R2=i<GX-1&&M[k+1]?TL[k+1]:tl, Uu=j>0&&M[k-GX]?TL[k-GX]:tl, Dd=j<GY-1&&M[k+GX]?TL[k+GX]:tl;
        T2[k]=tl+kap*(L2+R2+Uu+Dd-4*tl) + qb*BOT[k]/CC - (EDGE[k]*LSIDE + (j===0?LTOP:0))*(tl-TROOM)*dt; }
      TL.set(T2);
      for(j=0;j<GY;j++){ for(i=0;i<GX/2;i++){ k=j*GX+i; if(!M[k]){ var kk=k; while(kk<j*GX+GX-1 && !M[kk]) kk++; TL[k]=TL[kk]; } }
        for(i=GX-1;i>=GX/2;i--){ k=j*GX+i; if(!M[k]){ var k2=k; while(k2>j*GX && !M[k2]) k2--; TL[k]=TL[k2]; } } }
    }
    // QB bulb into the liquid; LSIDE, LTOP losses to the room; KT neck force scale; BL the liquid's expansion
    // over the wax's; KC, DF, FE, FW the coil (contact, how much hotter than the liquid, share at its
    // edge, width); HX wax to liquid; TEN neck tension; KN, KF heat shared inside the pool, inside a moving blob
    var QB=120, LSIDE=0.035, LTOP=0.12, KT=12, BL=0.35, KC=0.26, DF=16, FE=0.05, FW=7, HX=0.09, TEN=2.4, KN=0.03, KF=0.8;
    function project(){
      var i, j, k, it, h=CS;
      for(j=0;j<GY;j++) for(i=0;i<GX;i++){ k=j*GX+i; if(!M[k]){ DV[k]=0; PR[k]=0; continue; }
        var uR=i<GX-1&&M[k+1]?U[k+1]:-U[k], uL=i>0&&M[k-1]?U[k-1]:-U[k], vD=j<GY-1&&M[k+GX]?V[k+GX]:-V[k], vU=j>0&&M[k-GX]?V[k-GX]:-V[k];
        DV[k]=(uR-uL+vD-vU)/(2*h); }
      for(it=0;it<20;it++){ for(j=0;j<GY;j++) for(i=0;i<GX;i++){ k=j*GX+i; if(!M[k]) continue;
        var pL=i>0&&M[k-1]?PR[k-1]:PR[k], pR=i<GX-1&&M[k+1]?PR[k+1]:PR[k], pU=j>0&&M[k-GX]?PR[k-GX]:PR[k], pD=j<GY-1&&M[k+GX]?PR[k+GX]:PR[k];
        PR[k]=(pL+pR+pU+pD-DV[k]*h*h)/4; } }
      for(j=0;j<GY;j++) for(i=0;i<GX;i++){ k=j*GX+i; if(!M[k]) continue;
        var qL=i>0&&M[k-1]?PR[k-1]:PR[k], qR=i<GX-1&&M[k+1]?PR[k+1]:PR[k], qU=j>0&&M[k-GX]?PR[k-GX]:PR[k], qD=j<GY-1&&M[k+GX]?PR[k+GX]:PR[k];
        U[k]-=(qR-qL)/(2*h); V[k]-=(qD-qU)/(2*h); }
    }

    function stats(){
      var vt=0, et=0, ft=0, up=0, top=1e9, tb=0, nb=0, tt=0, nt=0; blobsOf(); var bl={};
      for(var i=0;i<L.length;i++){ var o=L[i]; vt+=o.v; et+=o.T*o.v; ft+=o.f*o.v; if(o.y<(Y0+Y1)/2) up+=o.v; if(o.y-o.r<top) top=o.y-o.r; if(o.v>4) bl[o.blob]=1; }
      for(i=0;i<GX;i++){ var kb=(GY-2)*GX+i, kt=GX+i; if(M[kb]){ tb+=TL[kb]; nb++; } if(M[kt]){ tt+=TL[kt]; nt++; } }
      return { t:S.t, lobes:L.length, links:LINKS.length, blobs:Object.keys(bl).length, waxT:et/vt, melt:ft/vt, up:up/vt, top:(Y1-top)/(Y1-Y0), tBot:tb/nb, tTop:tt/nt, vol:vt };
    }
    reset();
    return { S:S, L:L, LINKS:LINKS, TL:TL, U:U, V:V, M:M, DT:DT, step:step, reset:reset, stats:stats, inner:inner, outer:outer, floorY:floorY,
      sampleTL:function(x,y){ return bil(TL,x,y); },
      geo:{ CX:CX, Y0:Y0, Y1:Y1, CS:CS, GX:GX, GY:GY, GX0:GX0, TM:TM, TX:TX, TROOM:TROOM } };
  }

  // ---- the lava lamp: state, clock, painter ----
  // Same 120 x 200 logical space as the tube. The lamp stands on the floor at y=190: a spun-metal
  // cone base (190..126) with the bulb inside, the glass bottle (128..26, its outline is the
  // simulation's), and a cone cap (31..8). The wax is a distance field over the parcels and necks,
  // shaded cell by cell (one device pixel per cell while the budget allows; the canvas itself is
  // devicePixelRatio). Its outline is traced from the field as a path and the shading is drawn through
  // it, so the edge is sharp at any zoom instead of a scaled-up blur.
  var LCX=60, LFLOOR=190, LBASE=126;
  var LAMP={ sim:null, last:0, acc:0, warming:true, stat:null, statT:0, music:0, seed:0, F:{} };
  function lampSim(){ if(!LAMP.sim){ LAMP.seed=(Math.random()*4294967296)>>>0; LAMP.sim=makeLava(LAMP.seed); LAMP.warming=true; LAMP.stat=LAMP.sim.stats(); } return LAMP.sim; }
  function lampRestart(seed){ LAMP.seed = seed==null ? (Math.random()*4294967296)>>>0 : seed>>>0; LAMP.sim=makeLava(LAMP.seed); LAMP.warming=true; LAMP.acc=0; LAMP.stat=LAMP.sim.stats(); syncLampStat(); }
  // advance the simulation to wall-clock time; the first warm-up runs at 3x
  function lampAdvance(sec){ var sim=lampSim(), n=Math.round(sec/sim.DT); for(var i=0;i<n;i++){ sim.step(); if(i%60===0) lampWatch(); } lampWatch(); }
  function lampWatch(){ var sim=LAMP.sim, st=LAMP.stat=sim.stats();
    // Warm-up is over when the wax is molten and some of it has risen. On a weak bulb it never rises, so it
    // is also over once the wax has been molten for a quarter of an hour: that lamp is lazy, not warming,
    // and should not be run at 3x and called "warming up" for the rest of the evening.
    if(st.melt>0.9){ if(sim.moltenT==null) sim.moltenT=st.t; } else sim.moltenT=null;
    if(LAMP.warming && ADV.lampOn && st.melt>0.9 && (st.up>0.12 || st.t-sim.moltenT>900)) LAMP.warming=false;
    if(!LAMP.warming && st.melt<0.1) LAMP.warming=true; }
  function lampTick(now){
    var sim=lampSim(), dt=LAMP.last ? Math.min(0.1,(now-LAMP.last)/1000) : 0; LAMP.last=now; if(dt<=0) return;
    sim.S.on=!!ADV.lampOn; sim.S.power=clampN(ADV.lampW,15,40)/25;
    var lv = ADV.lampMusic ? (TV.lvOverride!=null ? TV.lvOverride : level()) : 0;
    LAMP.music += (lv-LAMP.music)*(1-Math.exp(-dt/1.5)); sim.S.music = ADV.lampMusic ? clampN(LAMP.music*1.6,0,1) : 0;
    var spd = LAMP.warming && ADV.lampOn ? Math.max(3, ADV.lampTime) : ADV.lampTime;
    LAMP.acc += dt*spd; var n=0; while(LAMP.acc>=sim.DT && n<16){ sim.step(); LAMP.acc-=sim.DT; n++; } if(n>=16) LAMP.acc=0;
    sim.alpha=clampN(LAMP.acc/sim.DT,0,1);   // how far between the last step and the next this frame falls
    if(now-LAMP.statT>500){ LAMP.statT=now; lampWatch(); syncLampStat(); }
  }
  function lampStatus(){
    var st=LAMP.stat; if(!st) return ''; var w=Math.round(st.waxT)+'°C';
    if(!ADV.lampOn) return st.melt>0.1 || st.waxT>27 ? 'off, cooling · wax '+w : 'off · the wax has set';
    if(LAMP.warming) return 'warming up'+(ADV.lampTime<3?' (shown 3x)':'')+' · wax '+w;
    var s = st.up>0.85 && st.tTop>45 ? 'running hot: the wax stays up' : st.up<0.04 && ADV.lampW<20 ? 'lazy: barely warm enough' : 'flowing';
    return s+' · wax '+w+(ADV.lampMusic && LAMP.sim.S.music>0.05 ? ' · ♪ +'+Math.round(LAMP.sim.S.music*60)+'% heat' : '');
  }
  function syncLampStat(){ var t=lampStatus(); if($('lampStat').textContent!==t) $('lampStat').textContent=t; if(tvIsOpen() && TVZ.subj==='lamp' && $('tvStat').textContent!==t) $('tvStat').textContent=t; }

  // glass outline (outer, minus inset) between y0 (top) and y1 (bottom)
  function lampGlass(c, sim, inset, y0, y1, open){
    var cx=LCX, y; c.beginPath(); c.moveTo(cx-(sim.outer(y1)-inset), y1);
    for(y=y1-1.5; y>y0; y-=1.5) c.lineTo(cx-(sim.outer(y)-inset), y);
    c.lineTo(cx-(sim.outer(y0)-inset), y0); c.lineTo(cx+(sim.outer(y0)-inset), y0);
    for(y=y0+1.5; y<y1; y+=1.5) c.lineTo(cx+(sim.outer(y)-inset), y);
    c.lineTo(cx+(sim.outer(y1)-inset), y1); if(!open) c.closePath();
  }
  function lampWall(c, sim, side, y0, y1, inset){ c.beginPath(); for(var y=y0; y<=y1+0.01; y+=1.5){ var x=LCX+side*(sim.outer(y)-inset); if(y===y0) c.moveTo(x,y); else c.lineTo(x,y); } }
  // metal: a horizontal sweep for spun metal, from the finish's five tones
  function metalGrad(c, x0, x1, m){ var g=c.createLinearGradient(x0,0,x1,0); g.addColorStop(0,m[0]); g.addColorStop(0.18,m[1]); g.addColorStop(0.34,m[3]); g.addColorStop(0.46,m[2]); g.addColorStop(0.75,m[1]); g.addColorStop(1,m[0]); return g; }

  // wax primitives, as shapes with a distance: each parcel an ellipse (flattened on the floor and under
  // the cap, and a little across its motion, the way a drop pushing through a liquid flattens; a long
  // tail is a neck, never speed), each neck a rod between the two parcels' centres, as thick as the neck
  // at its ends and drawn in at the waist as it nears the length at which it parts.
  // Parcels of one blob are melted together with a smooth minimum, so where they meet, and where a neck
  // joins a blob, the surface rounds into a fillet instead of adding up into a bump; different blobs are
  // only ever touching, never blended, so each keeps its own outline.
  var WAX_GROW=1.0, WAX_KA=0.6, WAX_KB=1.9, WAX_KN=2.2, WAX_KMAX=6, WAX_REACH=0.75;   // blend widths: a parcel melts into its blob over about its own radius, and is sampled out to WAX_REACH of that
  // The physics changes its mind in a single step: a neck is there and then it is not, two blobs are two
  // and then one, two parcels are two and then one bigger one. The picture takes a moment over each
  // (seconds of lamp time): WAX_JOIN for two blobs that have joined to flow into one (and for two that
  // have come apart while still pressed together to become two again), WAX_SNAP for a parted neck to
  // pinch through and draw back into its blobs, WAX_FUSE for a parcel that has swallowed its neighbour
  // to round off. WAX_WAIST is how far a neck draws in at its middle before it parts, and WAX_NEAR the
  // spacing (in radii) below which a neck is wholly inside its two parcels and is not drawn. From a gap
  // of WAX_GAP0 between two linked parcels to WAX_GAP1, their neck takes over as the only thing joining
  // them (see the note in waxPrims).
  var WAX_JOIN=1.2, WAX_SNAP=0.7, WAX_FUSE=0.8, WAX_WAIST=0.6, WAX_NEAR=0.40, WAX_GAP0=2.5, WAX_GAP1=4.5;
  function waxEase(u){ return u<=0 ? 0 : u>=1 ? 1 : u*u*(3-2*u); }
  function waxKey(a,b){ return a.id<b.id ? a.id+':'+b.id : b.id+':'+a.id; }
  // the radius of a neck at its waist: its own radius while it is short, less as it nears the length at
  // which the physics breaks it (longer than its own circumference)
  function waxWaist(l){ var a=l.a, b=l.b, dx=b.x-a.x, dy=b.y-a.y, rn=Math.max(0.45,l.rn), q=(Math.sqrt(dx*dx+dy*dy)-(a.r+b.r)*0.8)/(2*Math.PI*rn); q=q<0?0:q>1?1:q; return rn*(1-WAX_WAIST*q*q); }
  // Compare this step with the last one the picture saw, and note what happened in between: links that
  // are new between blobs that were apart (a join), links that have gone while both their parcels are
  // still there (a parted neck if the two are apart, a parting if they are still pressed together),
  // parcels that have grown by swallowing a neighbour (a fusion). A join or a parting is a bond: m runs
  // from 0 (two bodies) to 1 (one), up while the link is there and down once it is not, so a pair that
  // joins and parts and joins again never jumps. Kept on the simulation, so every view of the lamp sees
  // the same thing; the physics never reads any of it.
  function waxWatch(sim){
    var V=sim.pic||(sim.pic={ t:-1, links:{}, bonds:{}, ghosts:[], was:{} }), L=sim.L, K=sim.LINKS, t=sim.S.t, i, j, l, o, key, bd;
    if(t===V.t) return V;                                              // another view has already looked at this step
    var dt=t-V.t, live=V.t>=0 && dt>0 && dt<0.5, now={}, here={}, gone=[];   // after a jump in time (a restart, a fast-forward) nothing is eased
    if(!live){ V.bonds={}; V.ghosts.length=0; }
    for(i=0;i<L.length;i++) here[L[i].id]=L[i];
    if(live){
      for(key in V.was) if(!here[key]) gone.push(V.was[key]);
      for(i=0;i<L.length && gone.length;i++){ o=L[i]; var w=V.was[o.id]; if(!w || o.v<=w.v*1.03) continue;
        var best=null, bv=1e9; for(j=0;j<gone.length;j++){ var dv=Math.abs(gone[j].v-(o.v-w.v)); if(dv<bv){ bv=dv; best=gone[j]; } }
        // as long as the two were, end to end, along the line between them
        var fx=best.x-w.x, fy=best.y-w.y, half=(Math.sqrt(fx*fx+fy*fy)+Math.sqrt(w.v/Math.PI)+Math.sqrt(best.v/Math.PI))/2;
        o.fs=Math.max(0,Math.min(0.35, half/o.r-1)); o.fa=Math.atan2(fy,fx); o.ft=t; }
    }
    for(i=0;i<K.length;i++){ l=K[i]; key=waxKey(l.a,l.b); now[key]=l; bd=V.bonds[key];
      if(bd) bd.on=true;                                               // (joined again while still parting)
      else if(live && !V.links[key] && l.a.pb!=null && l.b.pb!=null && l.a.pb!==l.b.pb) V.bonds[key]={ a:l.a, b:l.b, m:0, on:true }; }
    for(key in V.links){ if(now[key]) continue; var k0=V.links[key], A=here[k0.a], B=here[k0.b]; bd=V.bonds[key];
      if(!live || !A || !B){ delete V.bonds[key]; continue; }
      if(bd){ bd.on=false; continue; }                                 // it had not finished joining: it eases back the way it came
      var gx=B.x-A.x, gy=B.y-A.y, gd=Math.sqrt(gx*gx+gy*gy);
      // Still pressed together: one body eases into two. A neck: it leaves a tail on each blob, and if the
      // two blobs it joined are pressed together somewhere else as well, they ease apart there too (far:
      // everywhere but round the place the neck parted, where the two tails must not melt into each other).
      if(gd<(A.r+B.r)*0.95) V.bonds[key]={ a:A, b:B, m:1, on:false };
      else { V.ghosts.push({ a:A, b:B, rn:Math.max(0.45,k0.rn), rm:k0.rm, t:t }); V.bonds[key]={ a:A, b:B, m:1, on:false, far:3+2.5*Math.max(0.45,k0.rn) }; } }
    V.links={}; for(key in now){ l=now[key]; V.links[key]={ a:l.a.id, b:l.b.id, rn:l.rn, rm:waxWaist(l) }; }
    for(key in V.bonds){ bd=V.bonds[key]; if(here[bd.a.id]!==bd.a || here[bd.b.id]!==bd.b){ delete V.bonds[key]; continue; }
      bd.m+=(bd.on ? dt : -dt)/WAX_JOIN; if(bd.on ? bd.m>=1 : bd.m<=0) delete V.bonds[key]; }
    for(i=V.ghosts.length-1;i>=0;i--){ var gh=V.ghosts[i]; if(t-gh.t>=WAX_SNAP || here[gh.a.id]!==gh.a || here[gh.b.id]!==gh.b || now[waxKey(gh.a,gh.b)]) V.ghosts.splice(i,1); }
    V.was={}; for(i=0;i<L.length;i++){ o=L[i]; V.was[o.id]={ x:o.x, y:o.y, v:o.v }; }
    V.t=t; return V;
  }
  function waxPrims(sim){
    var out=[], L=sim.L, K=sim.LINKS, n=L.length, i, o, l, key, bd, al=sim.alpha||0, V=waxWatch(sim), tn=sim.S.t+al*sim.DT, par=[], sub=[], yg=[], JE={}, JK={}, JH={};
    function top(P,a){ while(P[a]!==a){ P[a]=P[P[a]]; a=P[a]; } return a; }
    function tie(P,a,b){ a=top(P,a); b=top(P,b); if(a!==b) P[a]=b; }
    // a bond, on the two bodies it is between: how far they are melted together, and over what width
    function bond(a, b, e, far){ var jk=Math.min(WAX_KMAX, WAX_KA+WAX_KB*Math.min(a.r,b.r)), gs=[a.g,b.g], hole=null;
      if(far){ var hx=b.rx-a.rx, hy=b.ry-a.ry, hd=Math.sqrt(hx*hx+hy*hy)||1e-6, ha=(hd+a.r-b.r)/2; ha=ha<0.1?0.1:ha>hd-0.1?hd-0.1:ha; hole={ x:a.rx+hx/hd*ha, y:a.ry+hy/hd*ha, r:far }; }
      for(var s=0;s<2;s++) if(!(JE[gs[s]]>=e)){ JE[gs[s]]=e; JK[gs[s]]=jk; JH[gs[s]]=hole; } }
    for(i=0;i<n;i++){ var o0=L[i]; o0.ix=i; par[i]=i; sub[i]=i; o0.rx = o0.px!=null ? o0.px+(o0.x-o0.px)*al : o0.x; o0.ry = o0.py!=null ? o0.py+(o0.y-o0.py)*al : o0.y; }
    // which parcels make one blob (every link, and every pair still parting), and inside a blob which
    // make one body already (every link but the ones still joining); read from the links as they are
    // now, not from the physics' own blob numbers, which are a step behind
    for(i=0;i<K.length;i++){ l=K[i]; bd=V.bonds[waxKey(l.a,l.b)]; tie(par,l.a.ix,l.b.ix); if(bd) yg[i]=waxEase(bd.m); else { yg[i]=-1; tie(sub,l.a.ix,l.b.ix); } }
    for(key in V.bonds){ bd=V.bonds[key]; if(!bd.on) tie(par,bd.a.ix,bd.b.ix); }
    for(i=0;i<n;i++){ o=L[i]; o.vb=L[top(par,i)].id; o.g=L[top(sub,i)].id; }
    for(i=0;i<K.length;i++) if(yg[i]>=0) bond(K[i].a, K[i].b, yg[i]);
    // Two linked parcels that have drawn apart are joined by their neck and by nothing else. Left to the
    // smooth minimum they also reach for each other across the gap: close to, that fills the neck out, but
    // from about three units apart the two reaches no longer meet and show as a notch each side of the
    // neck. So each keeps, for every such partner, the direction it lies in and how far this has gone
    // (0 up to WAX_GAP0 apart, 1 from WAX_GAP1), and melts onto nothing that way.
    for(i=0;i<n;i++) L[i].cn=null;
    for(i=0;i<K.length;i++){ l=K[i]; var ca0=l.a, cb0=l.b, cx=cb0.rx-ca0.rx, cy=cb0.ry-ca0.ry, cd=Math.sqrt(cx*cx+cy*cy)||1e-6, cg=waxEase((cd-ca0.r-cb0.r-WAX_GAP0)/(WAX_GAP1-WAX_GAP0)); if(cg<=0) continue;
      (ca0.cn||(ca0.cn=[])).push({ ux:cx/cd, uy:cy/cd, s:cg }); (cb0.cn||(cb0.cn=[])).push({ ux:-cx/cd, uy:-cy/cd, s:cg }); }
    for(key in V.bonds){ bd=V.bonds[key]; if(!bd.on) bond(bd.a, bd.b, waxEase(bd.m), bd.far); }
    for(i=0;i<n;i++){ o=L[i]; var ee=o.el*(1-o.rest)*(1-o.sq), a=o.r*WAX_GROW/(1+0.8*ee), b=o.r*WAX_GROW*(1+ee), ca=Math.cos(o.ang), sa=Math.sin(o.ang);
      var sx=1+0.32*o.rest+0.22*o.sq, sy=1-0.38*o.rest-0.28*o.sq, n00=ca*a, n01=-sa*b, n10=sa*a, n11=ca*b;
      // a parcel that has just swallowed its neighbour is still as long as the two were, and rounds off
      if(o.ft!=null){ var fu=(tn-o.ft)/WAX_FUSE; if(fu>=1 || fu<0) o.ft=null; else { var st=1+o.fs*(1-waxEase(fu)), si=1/st, cf=Math.cos(o.fa), sf=Math.sin(o.fa), s00=st*cf*cf+si*sf*sf, s01=(st-si)*cf*sf, s11=st*sf*sf+si*cf*cf;
          var t00=s00*n00+s01*n10, t01=s00*n01+s01*n11, t10=s01*n00+s11*n10, t11=s01*n01+s11*n11; n00=t00; n01=t01; n10=t10; n11=t11; } }
      // M = diag(sx,sy) (stretch) R diag(a,b) maps the unit circle onto the parcel; keep its inverse and its extents
      var m00=sx*n00, m01=sx*n01, m10=sy*n10, m11=sy*n11, det=m00*m11-m01*m10, kk=Math.min(WAX_KMAX, WAX_KA+WAX_KB*o.r), fro=m00*m00+m01*m01+m10*m10+m11*m11;
      out.push({ n:0, b:o.vb, g:o.g, je:JE[o.g], jk:JK[o.g], jh:JH[o.g], x:o.rx, y:o.ry, i00:m11/det, i01:-m01/det, i10:-m10/det, i11:m00/det, ex:Math.sqrt(m00*m00+m01*m01)+WAX_REACH*kk, ey:Math.sqrt(m10*m10+m11*m11)+WAX_REACH*kk, k:kk, cn:o.cn, ir:Math.sqrt(Math.max(0,(fro-Math.sqrt(Math.max(0,fro*fro-4*det*det)))/2)), T:o.T, f:o.f });   // ir: its shorter radius
    }
    // a rod from P toward the other parcel: radius rn at its ends, rm at its waist, which is sp of the way along
    function rod(P, bx, by, rn, rm, sp, T0, T1, f, show){ var kn=Math.min(WAX_KMAX, WAX_KA+WAX_KN*rn)*show, pad; rn*=show; rm*=show; pad=rn+WAX_REACH*kn;
      out.push({ n:1, b:P.vb, g:P.g, je:JE[P.g], jk:JK[P.g], jh:JH[P.g], x:P.rx+bx/2, y:P.ry+by/2, ax:P.rx, ay:P.ry, bx:bx, by:by, bb:bx*bx+by*by||1e-9, rm:rm, dr:rn-rm, sp:sp, ia:1/sp, ib:sp<1?1/(1-sp):0, k:kn, ex:Math.abs(bx)/2+pad, ey:Math.abs(by)/2+pad, T:(T0+T1)/2, T0:T0, T1:T1, f:f }); }
    // A neck between two parcels that have closed up on each other is inside them and is not drawn. It
    // comes in gradually as they part (thickness and blend width together), not all at once at one spacing:
    // a thick neck arriving in a single step makes the whole blob jump.
    for(i=0;i<K.length;i++){ if(yg[i]>=0) continue; l=K[i]; var A=l.a, Bq=l.b, dx=Bq.rx-A.rx, dy=Bq.ry-A.ry, d=Math.sqrt(dx*dx+dy*dy), show=waxEase((d/(A.r+Bq.r)-WAX_NEAR)/(0.55-WAX_NEAR)); if(show<=0) continue;
      var sp=(d+A.r-Bq.r)/(2*d); rod(A, dx, dy, Math.max(0.45,l.rn), waxWaist(l), sp<0.05?0.05:sp>0.95?0.95:sp, A.T, Bq.T, Math.min(A.f,Bq.f), show); }
    // a neck that has parted: a tail on each blob, thinning to a point where the neck was thinnest, then drawing back in
    for(i=0;i<V.ghosts.length;i++){ var gh=V.ghosts[i], u=(tn-gh.t)/WAX_SNAP; if(u>=1) continue; if(u<0) u=0;
      var P=gh.a, Q=gh.b, ex=Q.rx-P.rx, ey=Q.ry-P.ry, dd=Math.sqrt(ex*ex+ey*ey)||1e-6, hP=(dd+P.r-Q.r)/2; hP=hP<0.1?0.1:hP>dd-0.1?dd-0.1:hP;
      var hQ=dd-hP, tip=Math.max(0.04, gh.rm*(1-waxEase(u/0.3))), back=waxEase((u-0.12)/0.88), lp=hP+(Math.min(hP,P.r*0.5)-hP)*back, lq=hQ+(Math.min(hQ,Q.r*0.5)-hQ)*back;
      rod(P, ex/dd*lp, ey/dd*lp, gh.rn, tip, 1, P.T, P.T, P.f, 1); rod(Q, -ex/dd*lq, -ey/dd*lq, gh.rn, tip, 1, Q.T, Q.T, Q.f, 1); }
    for(i=0;i<n;i++) L[i].pb=L[i].vb;
    return out;
  }
  // signed distance (lamp units, negative inside) from a point to one primitive
  function waxDist(p, x, y){
    if(p.n){ var px=x-p.ax, py=y-p.ay, t=(px*p.bx+py*p.by)/p.bb; t=t<0?0:t>1?1:t; var qx=px-p.bx*t, qy=py-p.by*t, u=t<p.sp ? (p.sp-t)*p.ia : (t-p.sp)*p.ib; return Math.sqrt(qx*qx+qy*qy)-p.rm-p.dr*u*u; }
    var rx=x-p.x, ry=y-p.y, qx=p.i00*rx+p.i01*ry, qy=p.i10*rx+p.i11*ry, ql=Math.sqrt(qx*qx+qy*qy); if(ql<1e-4){ qx=1e-4; qy=0; ql=1e-4; }   // (dead centre: step off it, or the distance is 0/0)
    var gx=(p.i00*qx+p.i10*qy)/ql, gy=(p.i01*qx+p.i11*qy)/ql;                     // gradient of |q|: (|q|-1)/|grad| is the distance near the edge
    return (ql-1)/Math.sqrt(gx*gx+gy*gy);
  }
  function smin(a, b, k){ var h=k-Math.abs(a-b); return h<=0 ? Math.min(a,b) : Math.min(a,b)-h*h*0.25/k; }
  var WAX_FAR=50, WAX_SEAM=0.06;
  // Two bodies of wax pressed together do not overlap: each flattens against the other along the line
  // where they meet. lo is the distance to the nearer body and hi to the farther; the depth falls to
  // almost nothing (WAX_SEAM) along the line where the two are equal, so the shading shows a crease
  // between two rounded bodies. The bottom of the crease is rounded over sw, or it would show the grid
  // when the picture is scaled up, and it reaches two units out from the other body and no further
  // (a part is only sampled so far from itself, and beyond that its distance is not known).
  function waxCrease(lo, hi, sw){ var hs=(hi-lo)*0.5, v=sw-WAX_SEAM-Math.sqrt(hs*hs+sw*sw); return v<=lo ? lo : hi>1 ? lo+(v-lo)*(2-hi) : v; }
  // the cells one body of wax can reach
  function waxReach(S, W, H, x0, y0, cs){ var grp=S.prims, ga0=W, ga1=-1, gb0=H, gb1=-1, m=2*cs, i, p;
    for(i=0;i<grp.length;i++){ p=grp[i]; if(!p.n){ var crr=Math.max(p.ex,p.ey)+m; p.cr=crr*crr; }
      p.a0=Math.max(0,Math.floor((p.x-p.ex-m-x0)/cs)); p.a1=Math.min(W-1,Math.ceil((p.x+p.ex+m-x0)/cs)); p.b0=Math.max(0,Math.floor((p.y-p.ey-m-y0)/cs)); p.b1=Math.min(H-1,Math.ceil((p.y+p.ey+m-y0)/cs));
      if(p.a1<p.a0 || p.b1<p.b0) continue;
      if(p.a0<ga0) ga0=p.a0; if(p.a1>ga1) ga1=p.a1; if(p.b0<gb0) gb0=p.b0; if(p.b1>gb1) gb1=p.b1; }
    S.a0=ga0; S.a1=ga1; S.b0=gb0; S.b1=gb1; return ga1>=ga0 && gb1>=gb0; }
  // its parts melted together into FB, and its temperature, melt and half-thickness into the weighted sums
  // (the half-thickness is how deep the wax can get there: a parcel's shorter radius, a neck's own). This is where
  // the time goes (every part, every cell it can reach), so the two distance functions are written out
  // in line with everything that does not change along a row lifted out of it; waxDist is the same sum.
  // The blend fades to nothing between kf and the edge of a part's reach (the farther of the two
  // distances decides, and the fade is eased at both ends), so the field has no step and no crease
  // where a part stops being sampled.
  function waxMelt(S, FB, FT, FF, FR, FW, W, x0, y0, cs){ var grp=S.prims, i, p, a, b, q, d, w, f, h, lo, hi, fo;
    for(b=S.b0;b<=S.b1;b++) FB.fill(WAX_FAR, b*W+S.a0, b*W+S.a1+1);
    for(i=0;i<grp.length;i++){ p=grp[i]; var k=p.k, ik=k>0?1/k:0, k4=k>0?0.25/k:0, kf=k*(WAX_REACH-0.25), ikf=k>0?4/k:0, pf=p.f, pT=p.T;
      if(p.n){ var ax=p.ax, ay=p.ay, bx=p.bx, by=p.by, ibb=1/p.bb, sp=p.sp, ia=p.ia, ib=p.ib, rm=p.rm, dr=p.dr, T0=p.T0, dT=p.T1-p.T0;
        for(b=p.b0;b<=p.b1;b++){ var py=y0+b*cs-ay; q=b*W+p.a0;
          for(a=p.a0;a<=p.a1;a++,q++){ var px=x0+a*cs-ax, t=(px*bx+py*by)*ibb; t=t<0?0:t>1?1:t; var qx=px-bx*t, qy=py-by*t, u=t<sp ? (sp-t)*ia : (t-sp)*ib, rl=rm+dr*u*u; d=Math.sqrt(qx*qx+qy*qy)-rl;
            f=FB[q]; if(f<d){ lo=f; hi=d; } else { lo=d; hi=f; } h=k-hi+lo; if(h>0 && hi>kf){ fo=(hi-kf)*ikf; h= fo>=1 ? 0 : h*(1-fo*fo*(3-2*fo)); } FB[q]= h<=0 ? lo : lo-h*h*k4;
            if(d<k){ w=d<0 ? (d<-1.5 ? 2.5 : 1-d) : (1-d*ik)*(1-d*ik); FW[q]+=w; FT[q]+=w*(T0+dT*t); FF[q]+=w*pf; FR[q]+=w*(rl>0.05?rl:0.05); } } } }
      else { var cx=p.x, cy=p.y, i00=p.i00, i01=p.i01, i10=p.i10, i11=p.i11, cr=p.cr, ir=p.ir, cn=p.cn, nc=cn ? cn.length : 0, c;
        for(b=p.b0;b<=p.b1;b++){ var ry=y0+b*cs-cy, r2=cr-ry*ry; if(r2<=0) continue;
          var hw=Math.sqrt(r2), sa=Math.ceil((cx-hw-x0)/cs), ea=Math.floor((cx+hw-x0)/cs), c0=i01*ry, c1=i11*ry; if(sa<p.a0) sa=p.a0; if(ea>p.a1) ea=p.a1; q=b*W+sa;
          for(a=sa;a<=ea;a++,q++){ var rx=x0+a*cs-cx, ex=i00*rx+c0, ey=i10*rx+c1, ql=Math.sqrt(ex*ex+ey*ey); if(ql<1e-4){ ex=1e-4; ey=0; ql=1e-4; }
            var gx=i00*ex+i10*ey, gy=i01*ex+i11*ey; d=(ql-1)*ql/Math.sqrt(gx*gx+gy*gy);
            f=FB[q]; if(f<d){ lo=f; hi=d; } else { lo=d; hi=f; } h=k-hi+lo; if(h>0 && hi>kf){ fo=(hi-kf)*ikf; h= fo>=1 ? 0 : h*(1-fo*fo*(3-2*fo)); }
            // toward a linked parcel it has drawn away from (within about 30 degrees, fading out by 55) it melts onto nothing
            if(nc && h>0){ var rr=Math.sqrt(rx*rx+ry*ry)||1e-6, off=0; for(c=0;c<nc;c++){ var cz=(rx*cn[c].ux+ry*cn[c].uy)/rr; if(cz>0.574){ var cw=cz>=0.866 ? 1 : (cz-0.574)/0.292; cw=cw*cw*(3-2*cw)*cn[c].s; if(cw>off) off=cw; } } h*=1-off; }
            FB[q]= h<=0 ? lo : lo-h*h*k4;
            if(d<k){ w=d<0 ? (d<-1.5 ? 2.5 : 1-d) : (1-d*ik)*(1-d*ik); FW[q]+=w; FT[q]+=w*pT; FF[q]+=w*pf; FR[q]+=w*ir; } } } } } }
  // one blob laid over the others: the nearest wins, and the next nearest is remembered
  function waxLay(A, F, F2, W, a0, a1, b0, b1){ var a, b, q;
    for(b=b0;b<=b1;b++){ for(a=a0, q=b*W+a0; a<=a1; a++, q++){ var v=A[q]; if(v<F[q]){ F2[q]=F[q]; F[q]=v; } else if(v<F2[q]) F2[q]=v; } } }
  function lampField(view, sim, vis, ppu, cover){
    // Sample the part of the bottle that is on screen, on a grid that does not follow the wax. A window
    // hugged to the blobs moves its origin and changes its cell size as they move, and the picture shimmers.
    // (cover asked for the whole inside for Thermal; the window is always that now, so it is not read.)
    var prims=waxPrims(sim), g=sim.geo, i, j, p;
    var x0=Math.max(LCX-23, vis.x0), x1=Math.min(LCX+23, vis.x1), y0=Math.max(g.Y0-1, vis.y0), y1=Math.min(g.Y1+2, vis.y1);
    if(x1<=x0 || y1<=y0) return null;
    // One device pixel per cell. If that would be more than the cell budget, coarsen (the outline is traced
    // from the field as a path, so it stays sharp whatever the cell size). Two cells of margin all round,
    // so an outline cut off by the edge of the view closes outside it.
    var cs=Math.max(0.05, 1.0/ppu), area=(x1-x0)*(y1-y0), budget=48000;
    if(area/(cs*cs)>budget) cs=Math.sqrt(area/budget);
    x0=(Math.floor(x0/cs)-2)*cs; y0=(Math.floor(y0/cs)-2)*cs; x1=(Math.ceil(x1/cs)+2)*cs; y1=(Math.ceil(y1/cs)+2)*cs;
    var W=Math.round((x1-x0)/cs)+1, H=Math.round((y1-y0)/cs)+1, N=W*H, st=LAMP.F[view]||(LAMP.F[view]={});
    if(!st.F || st.F.length<N){ st.F=new Float32Array(N); st.F2=new Float32Array(N); st.FB=new Float32Array(N); st.FA=new Float32Array(N); st.FT=new Float32Array(N); st.FF=new Float32Array(N); st.FR=new Float32Array(N); st.FW=new Float32Array(N); st.Z=new Float32Array(N); }
    var F=st.F, F2=st.F2, FB=st.FB, FA=st.FA, FT=st.FT, FF=st.FF, FR=st.FR, FW=st.FW; F.fill(WAX_FAR,0,N); F2.fill(WAX_FAR,0,N); FT.fill(0,0,N); FF.fill(0,0,N); FR.fill(0,0,N); FW.fill(0,0,N);
    // One blob at a time: melt its parts together, then lay it over the others as a hard union, keeping
    // the distance to the next nearest blob as well. A blob that two bodies have just joined to make is
    // built body by body and eased from the two pressed together to the two melted into one.
    var blobs={}, border=[], ua0=W, ua1=-1, ub0=H, ub1=-1, a, b, q, B, S, sw=Math.max(0.25, 1.2*cs);
    for(i=0;i<prims.length;i++){ p=prims[i]; B=blobs[p.b]; if(!B){ B=blobs[p.b]={ subs:{}, order:[] }; border.push(p.b); }
      S=B.subs[p.g]; if(!S){ S=B.subs[p.g]={ prims:[], je:p.je==null?1:p.je, jk:p.jk||WAX_KMAX, jh:p.jh }; B.order.push(p.g); } S.prims.push(p); }
    for(j=0;j<border.length;j++){ B=blobs[border[j]];
      if(B.order.length===1){ S=B.subs[B.order[0]]; if(!waxReach(S, W, H, x0, y0, cs)) continue; waxMelt(S, FB, FT, FF, FR, FW, W, x0, y0, cs); waxLay(FB, F, F2, W, S.a0, S.a1, S.b0, S.b1);
        if(S.a0<ua0) ua0=S.a0; if(S.a1>ua1) ua1=S.a1; if(S.b0<ub0) ub0=S.b0; if(S.b1>ub1) ub1=S.b1; continue; }
      var ba0=W, ba1=-1, bb0=H, bb1=-1, live=[];
      for(i=0;i<B.order.length;i++){ S=B.subs[B.order[i]]; if(!waxReach(S, W, H, x0, y0, cs)) continue; live.push(S); if(S.a0<ba0) ba0=S.a0; if(S.a1>ba1) ba1=S.a1; if(S.b0<bb0) bb0=S.b0; if(S.b1>bb1) bb1=S.b1; }
      if(!live.length) continue;
      for(b=bb0;b<=bb1;b++) FA.fill(WAX_FAR, b*W+ba0, b*W+ba1+1);
      for(i=0;i<live.length;i++){ S=live[i]; waxMelt(S, FB, FT, FF, FR, FW, W, x0, y0, cs); var e=S.je, kj=S.jk, jh=S.jh, ir2=jh ? 1/(jh.r*jh.r) : 0;
        for(b=S.b0;b<=S.b1;b++){ var hy=jh ? y0+b*cs-jh.y : 0; for(a=S.a0, q=b*W+S.a0; a<=S.a1; a++, q++){ var fa=FA[q], fb=FB[q];
          if(!i || fa>=WAX_FAR){ if(fb<fa) FA[q]=fb; continue; } if(fb>=WAX_FAR) continue;
          // pressed together (a crease along the line where they meet) at one end, melted into one at the
          // other; round the place a neck has just parted, pressed together whatever the bond says
          var lo=fa<fb?fa:fb, hi=fa<fb?fb:fa, hg=hi<2 ? waxCrease(lo, hi, sw) : lo, hh=kj-hi+lo, sm=hh<=0 ? lo : lo-hh*hh*0.25/kj, el=e;
          if(jh){ var hx=x0+a*cs-jh.x, h2=(hx*hx+hy*hy)*ir2; if(h2<1) el=e*h2*h2; }
          FA[q]=hg+(sm-hg)*el; } } }
      waxLay(FA, F, F2, W, ba0, ba1, bb0, bb1);
      if(ba0<ua0) ua0=ba0; if(ba1>ua1) ua1=ba1; if(bb0<ub0) ub0=bb0; if(bb1>ub1) ub1=bb1;
    }
    // Blobs pressed together: the crease between them (and a dimple where it reaches the outline) until
    // the film drains and they join. F2 is then done with as a second distance and keeps the depth below
    // the outline, crease or no crease.
    for(b=ub0;b<=ub1;b++){ for(a=ua0, q=b*W+ua0; a<=ua1; a++, q++){ var f1=F[q], f2=F2[q]; F2[q]=f1; if(f2<2) F[q]=waxCrease(f1, f2, sw); } }
    st.pxPerCell = cs * ppu; st.cs = cs;
    return { F:F, FO:F2, FT:FT, FF:FF, FR:FR, FW:FW, Z:st.Z, W:W, H:H, x0:x0, y0:y0, cs:cs, st:st, prims:prims, a0:ua0, a1:ua1, b0:ub0, b1:ub1 };
  }
  // How much wax lies between each part of the bottle and the bulb. The wax is lit from underneath, so
  // the underside of a blob is bright, its top sits in its own shade, and a blob above another is dimmer
  // still. A coarse map of the whole bottle (it does not depend on the view): every parcel and neck is
  // stamped in, the thickness is summed up from the floor, then spread sideways a little, because the
  // liquid and the wax scatter the light.
  var WAX_SC=1.25;
  function waxShade(sim, prims){
    var g=sim.geo, sc=WAX_SC, x0=LCX-23, y0=g.Y0-1, W=Math.ceil(46/sc)+1, H=Math.ceil((g.Y1+2-y0)/sc)+1, N=W*H, S=LAMP.SH||(LAMP.SH={});
    if(!S.C || S.C.length!==N){ S.C=new Float32Array(N); S.O=new Float32Array(N); }
    var C=S.C, O=S.O, i, a, b, q; C.fill(0);
    for(i=0;i<prims.length;i++){ var p=prims[i], ex=p.ex-WAX_REACH*p.k+sc, ey=p.ey-WAX_REACH*p.k+sc, a0=Math.max(0,Math.floor((p.x-ex-x0)/sc)), a1=Math.min(W-1,Math.ceil((p.x+ex-x0)/sc)), b0=Math.max(0,Math.floor((p.y-ey-y0)/sc)), b1=Math.min(H-1,Math.ceil((p.y+ey-y0)/sc));
      for(b=b0;b<=b1;b++) for(a=a0;a<=a1;a++){ var d=waxDist(p, x0+a*sc, y0+b*sc); if(d<sc*0.5){ var cv=d<-sc*0.5 ? 1 : 0.5-d/sc; q=b*W+a; if(cv>C[q]) C[q]=cv; } } }
    for(a=0;a<W;a++){ var acc=0; for(b=H-1;b>=0;b--){ q=b*W+a; var cc=C[q]*sc; O[q]=acc+0.5*cc; acc+=cc; } }
    for(var pass=0;pass<3;pass++) for(b=0;b<H;b++){ var row=b*W, prev=O[row]; for(a=0;a<W;a++){ q=row+a; var cur=O[q], nxt=a<W-1?O[q+1]:cur; O[q]=(prev+2*cur+nxt)*0.25; prev=cur; } }
    S.W=W; S.H=H; S.x0=x0; S.y0=y0; return S;
  }
  // The outline of the wax as a path: where the field crosses zero, cell by cell (marching squares), the
  // crossings joined up into closed loops. Drawn through this as a clip, the wax has a sharp anti-aliased
  // edge at any zoom, however coarse the field under it. Samples off the grid count as liquid, so every
  // loop closes.
  var WAX_MS=(function(){ var from=[], to=[], c, e;   // for each corner pattern: the side the outline comes in by and the side it leaves by (0 top, 1 right, 2 bottom, 3 left)
    for(c=0;c<16;c++){ var bit=[c&1, c&2, c&4, c&8], fi=-1, ti=-1; for(e=0;e<4;e++){ var p0=bit[e], p1=bit[(e+1)&3]; if(!p0 && p1) fi=e; if(p0 && !p1) ti=e; } from.push(fi); to.push(ti); }
    return { from:from, to:to }; })();
  function waxOutline(c, fd, a0, a1, b0, b1){
    var F=fd.F, W=fd.W, H=fd.H, cs=fd.cs, x0=fd.x0, y0=fd.y0, st=fd.st, PW=W+2, NE=2*PW*(H+2), a, b, i;
    if(!st.NX || st.NX.length<NE){ st.NX=new Int32Array(NE); st.NX.fill(-1); st.EX=new Float32Array(NE); st.EY=new Float32Array(NE); st.ES=new Int32Array(NE); }
    var NX=st.NX, EX=st.EX, EY=st.EY, ES=st.ES, ns=0, FAR=WAX_FAR, MF=WAX_MS.from, MT=WAX_MS.to;
    // side e of the cell whose top-left sample is (a,b): its id, and where the outline crosses it
    function seg(a, b, e0, e1, f00, f10, f11, f01){
      var base=2*((b+1)*PW+(a+1)), id0, id1, x, y;
      if(e0===0){ id0=base; x=a+f00/(f00-f10); y=b; } else if(e0===1){ id0=base+3; x=a+1; y=b+f10/(f10-f11); } else if(e0===2){ id0=base+2*PW; x=a+f01/(f01-f11); y=b+1; } else { id0=base+1; x=a; y=b+f00/(f00-f01); }
      id1 = e1===0 ? base : e1===1 ? base+3 : e1===2 ? base+2*PW : base+1;
      NX[id0]=id1; EX[id0]=x0+x*cs; EY[id0]=y0+y*cs; ES[ns++]=id0;
    }
    for(b=b0-1;b<=b1;b++){ var rowA=b>=0 && b<H, rowB=b+1>=0 && b+1<H, ra=b*W, rb=(b+1)*W, f00=FAR, f01=FAR;
      if(a0-1>=0){ if(rowA) f00=F[ra+a0-1]; if(rowB) f01=F[rb+a0-1]; }
      for(a=a0-1;a<=a1;a++){ var in1=a+1<W, f10=rowA && in1 ? F[ra+a+1] : FAR, f11=rowB && in1 ? F[rb+a+1] : FAR;
        var code=(f00<0?1:0)|(f10<0?2:0)|(f11<0?4:0)|(f01<0?8:0);
        if(code!==0 && code!==15){
          if(code===5){ if(f00+f10+f11+f01<0){ seg(a,b,3,2,f00,f10,f11,f01); seg(a,b,1,0,f00,f10,f11,f01); } else { seg(a,b,3,0,f00,f10,f11,f01); seg(a,b,1,2,f00,f10,f11,f01); } }
          else if(code===10){ if(f00+f10+f11+f01<0){ seg(a,b,0,3,f00,f10,f11,f01); seg(a,b,2,1,f00,f10,f11,f01); } else { seg(a,b,0,1,f00,f10,f11,f01); seg(a,b,2,3,f00,f10,f11,f01); } }
          else seg(a,b,MF[code],MT[code],f00,f10,f11,f01);
        }
        f00=f10; f01=f11; } }
    c.beginPath();
    for(i=0;i<ns;i++){ var e=ES[i], nx=NX[e]; if(nx<0) continue;
      c.moveTo(EX[e],EY[e]); NX[e]=-1; var guard=ns;
      while(nx!==e && nx>=0 && guard-->0){ var n2=NX[nx]; if(n2<0) break; c.lineTo(EX[nx],EY[nx]); NX[nx]=-1; nx=n2; }
      c.closePath(); }
  }
  // How the molten wax takes the light. WAX_AMB: what reaches it from the glowing liquid all round, less
  // toward the edge of a blob by WAX_CORE (the thicker it is the more it glows). WAX_DIR: what comes up
  // from the bulb; WAX_LEN: how far that carries through wax; WAX_LIMB: how much of it an edge that does
  // not face the bulb loses; WAX_BED: how much is held back from wax lying on the bottom, which the bulb
  // already shines through. WAX_RIM: how deep the translucent edge is; WAX_RIMK: how much of the liquid's
  // light comes through it.
  var WAX_AMB=0.48, WAX_DIR=0.66, WAX_LEN=20, WAX_RIM=0.5, WAX_RIMK=0.15, WAX_CORE=0.45, WAX_LIMB=0.4, WAX_BED=0.4;
  var WAX_EXP=(function(){ var t=new Float32Array(2050), i; for(i=0;i<2050;i++) t[i]=Math.exp(-i/256); return t; })();   // exp(-x) for x from 0 to 8, in steps of 1/256
  function lampPaintWax(c, view, sim, look, o, lit){
    var thermal=look==='thermal', neon=look==='neon', uvL=look==='blacklight', xray=look==='xray', vec=!thermal && !neon;
    var fd=lampField(view, sim, o.vis, o.ppu, thermal); if(!fd) return;
    // A hair of glow, in source pixels. The old blur(1.6/cs) was several device pixels once the
    // coarse field was scaled up, which is what made the wax look fuzzy.
    fd.st.bloomPx = 0.55;
    if(!thermal && fd.a1<fd.a0) return;                                 // no wax in view
    var F=fd.F, FO=fd.FO, FT=fd.FT, FF=fd.FF, FR=fd.FR, FW=fd.FW, Z=fd.Z, W=fd.W, H=fd.H, cs=fd.cs, st=fd.st, col=LCOL_BY[ADV.lampCol]||LAMP_COLS[0], g=sim.geo;
    if(!st.cv){ st.cv=document.createElement('canvas'); }
    if(st.cv.width!==W || st.cv.height!==H || !st.px){ st.cv.width=W; st.cv.height=H; st.cx=st.cv.getContext('2d'); st.img=st.cx.createImageData(W,H); st.px=new Uint32Array(st.img.data.buffer); }
    var D=st.img.data; st.px.fill(0);
    var a0=thermal?0:Math.max(0,fd.a0-2), a1=thermal?W-1:Math.min(W-1,fd.a1+2), b0=thermal?0:Math.max(0,fd.b0-2), b1=thermal?H-1:Math.min(H-1,fd.b1+2), a, b, k;
    // A rounded profile across the wax for its shading: steep at the outline and level once the wax is as
    // deep as it gets there (its half-thickness), so a droplet is a dome, a neck is half a cylinder, a big
    // blob is flat in the middle, and there is no ridge down the middle of anything.
    for(b=b0;b<=b1;b++) for(a=a0, k=b*W+a0; a<=a1; a++, k++){ var zt=-F[k]; if(zt<=0){ Z[k]=0; continue; } var zr=FR[k]/(FW[k]||1e-6); if(zr<0.3) zr=0.3; Z[k]= zt>=zr ? zr : Math.sqrt(zt*(2*zr-zt)); }
    var wc=uvL ? col.uv : col.wax, solidC=mix(col.wax,[226,218,206],0.35), lim=cs*(neon?2.5:vec?2:1.5);
    var hx=-0.38, hy=-0.52, hz=0.76;                                   // the room light, up and to the left
    // Molten wax does not reflect much (it is barely denser optically than the liquid); it glows. It is lit
    // from underneath and it scatters the light, so each blob is brightest along its underside and deepest
    // at its top, a blob in the shade of another is dimmer, and the thin edge lets the liquid's light through.
    // It is brightest near the bulb, where it goes nearly white, and it is lit by light that has come up
    // through the coloured liquid, so it takes on the liquid's tint the higher it is (white wax in blue
    // liquid glows pale blue).
    // th is how thick the wax is at a point, from 0 at the outline to 1 where it is 7.5 deep; like the
    // profile, it levels off at the middle of a blob instead of meeting itself in a ridge.
    // Past its nominal setting the bulb brightens the liquid faster than the wax: the liquid lets the light
    // through and the wax does not, so a hot lamp shows its wax darker against the liquid, not washed into it.
    var liqN=col.liq.map(function(v){ return v/255; }), tintK=col.clear ? 0.35 : 1, litW=lit<=1 ? lit : 1+(lit-1)*0.35;
    var SH=vec && !uvL && !xray ? waxShade(sim, fd.prims) : null, SO=SH&&SH.O, SW=SH?SH.W:0, SHh=SH?SH.H:0, isc=1/WAX_SC, iLen=1/WAX_LEN, iRim=1/WAX_RIM, i2c=1/(2*cs), EX=WAX_EXP;
    for(b=b0;b<=b1;b++){ var y=fd.y0+b*cs, wIn=sim.inner(Math.min(y,g.Y1)), above=g.Y1-y, Lb=lit*(0.45+0.55*Math.exp(-above/55))+0.1;
      var Lw=litW*(0.62+0.38*Math.exp(-above/70))+0.08, tint=tintK*(0.3+0.45*(1-Math.exp(-above/45))), hotW=0.35+0.65*Math.exp(-above/38), Lr=litW*(0.45+0.55*Math.exp(-above/60));
      var w0=wc[0]*(1-tint*(1-liqN[0]))/255, w1=wc[1]*(1-tint*(1-liqN[1]))/255, w2=wc[2]*(1-tint*(1-liqN[2]))/255, gain=3.2+2.2*hotW, lk=1/(g.Y1+16-y), top=g.Y0-y, bed=above>=5 ? 1 : 1-WAX_BED*(1-above*0.2)*(1-above*0.2);
      var sy=0, sy1=0, sv=0; if(SH){ var fy=(y-SH.y0)*isc; if(fy<0) fy=0; else if(fy>SHh-1.001) fy=SHh-1.001; sy=(fy|0)*SW; sy1=sy+SW; sv=fy-(fy|0); }
      for(a=a0;a<=a1;a++){ k=b*W+a; var x=fd.x0+a*cs, dd=F[k], pi=k*4;
        var A=0, R=0, G=0, Bc=0;
        if(vec){ var cut=Math.abs(x-LCX)-wIn; if(top>cut) cut=top; if(cut>dd) F[k]=cut; }   // the outline stops at the glass and at the surface (the shading above has already been read from the uncut field)
        if(dd>=lim && !thermal) continue;
        if(dd<lim){
          A = vec ? 1 : Math.max(0,Math.min(1,0.5-dd/(cs*0.55)));
          if(A>0 || neon){ var fw=FW[k]||1e-6, T=FT[k]/fw, mf=FF[k]/fw, dp=dd<0?-dd:0, h=Math.min(1,dp/2.5);
            var zl=Z[a>a0?k-1:k], zr=Z[a<a1?k+1:k], zu=Z[b>b0?k-W:k], zd=Z[b<b1?k+W:k];
            var nx=-(zr-zl)*i2c, ny=-(zd-zu)*i2c, nl=1/Math.sqrt(nx*nx+ny*ny+1), nz=nl; nx*=nl; ny*=nl;
            var dl=0.5+0.5*ny, sp=Math.max(0,nx*hx+ny*hy+nz*hz), spec=sp*sp; spec*=spec; spec*=spec; spec*=spec;   // ^16
            if(thermal){ var tc=thermRGB((T-22)/45), sh=0.7+0.3*dl; R=tc[0]*sh; G=tc[1]*sh; Bc=tc[2]*sh; }
            else if(uvL){ var em=(0.55+0.6*(1-h))*(0.55+0.45*Math.min(1.4,lit+0.3)); R=wc[0]*em; G=wc[1]*em; Bc=wc[2]*em; }
            else if(neon){ var e2=Math.exp(-Math.pow(dd/(cs*1.6+0.02),2)), nc=col.neon; A=Math.max(A,e2); R=nc[0]*e2+20*(1-e2); G=nc[1]*e2; Bc=nc[2]*e2+40*(1-e2); A*=0.35+0.65*e2; }
            else if(xray){ var xi=0.3+0.7*h; R=150*xi+60; G=195*xi+50; Bc=235*xi+20; A*=0.55+0.4*h; }
            else { var ms=mf<=0.45 ? 0 : mf>=0.75 ? 1 : (mf-0.45)/0.3; ms=ms*ms*(3-2*ms);     // how molten: the two looks melt into each other
              if(ms<1){ var li=Lb*(0.42+0.58*dl)*0.4, rim=(1-h)*0.13*Lb, sb=0.16+0.95*li+rim;   // solid wax: dull and opaque
                R=solidC[0]*sb+255*spec*0.25; G=solidC[1]*sb+245*spec*0.25; Bc=solidC[2]*sb+235*spec*0.25; }
              if(ms>0){
                // the wax under this point, toward the bulb
                var fx=(x-SH.x0)*isc; if(fx<0) fx=0; else if(fx>SW-1.001) fx=SW-1.001; var sa=fx|0, su=fx-sa;
                var occ=(SO[sy+sa]*(1-su)+SO[sy+sa+1]*su)*(1-sv)+(SO[sy1+sa]*(1-su)+SO[sy1+sa+1]*su)*sv;
                var ndl=ny+nx*(LCX-x)*lk; if(ndl>1) ndl=1; else if(ndl<-1) ndl=-1;
                var hr=FR[k]/fw, hu=dp<hr ? dp/hr : 1, hd=dp>hr ? dp : hr, th=hu*(2-hu)*(hd>=7.5 ? 1 : Math.sqrt(hd/7.5)), so=occ*iLen*256, se=FO[k]<0 ? -FO[k]*iRim*256 : 0, E=Lw*(WAX_AMB*(1-WAX_CORE*(1-th))+WAX_DIR*bed*EX[so<2048?so|0:2048]*(0.45+0.275*(1+ndl))*(1-WAX_LIMB*(1-th)*(ndl>0?1-ndl:1))), edge=EX[se<2048?se|0:2048], X=(E*gain+WAX_RIMK*Lr*edge)*256, hot=Math.max(0,T-50)*0.01*lit;
                // exposed like the glow it is: bright colours run toward white near the bulb, deeper and more saturated up high
                var u0=w0*X, u1=w1*X, u2=w2*X, mr=255*(1-EX[u0<2048?u0|0:2048])+255*hot*0.4, mg=255*(1-EX[u1<2048?u1|0:2048])+150*hot*0.4, mb=255*(1-EX[u2<2048?u2|0:2048])+60*hot*0.4;
                R+=(mr-R)*ms; G+=(mg-G)*ms; Bc+=(mb-Bc)*ms; A*=1-0.1*edge*ms; } }   // the thin edge lets the liquid show through
          }
        }
        if(thermal && A<1){ var tl=sim.sampleTL(x,y), lc=thermRGB((tl-22)/45); R=R*A+lc[0]*0.55*(1-A); G=G*A+lc[1]*0.55*(1-A); Bc=Bc*A+lc[2]*0.55*(1-A); A=1; }
        if(!vec){ var eg=(wIn-Math.abs(x-LCX))/cs+0.5; if(eg<=0 || y<g.Y0-0.2){ D[pi+3]=0; continue; } A*=Math.min(1,eg); }
        D[pi]=R>255?255:R; D[pi+1]=G>255?255:G; D[pi+2]=Bc>255?255:Bc; D[pi+3]=A*255;
      } }
    st.cx.putImageData(st.img,0,0);
    c.save();
    // the wax is cut out along its traced outline; the picture under the cut is smooth, so scaling it up
    // costs nothing in sharpness
    if(vec){ waxOutline(c, fd, a0, a1, b0, b1); c.clip(); }
    c.imageSmoothingEnabled=true; c.drawImage(st.cv, fd.x0-cs/2, fd.y0-cs/2, W*cs, H*cs);
    if((look==='natural'||look==='night'||look==='vintage'||look==='blacklight') && lit>0.01 && st.cx && ('filter' in st.cx)){
      if(!st.bcv){ st.bcv=document.createElement('canvas'); }
      if(st.bcv.width!==W || st.bcv.height!==H){ st.bcv.width=W; st.bcv.height=H; st.bcx=st.bcv.getContext('2d'); }
      st.bcx.clearRect(0,0,W,H); st.bcx.filter='blur('+st.bloomPx.toFixed(2)+'px)'; st.bcx.drawImage(st.cv,0,0); st.bcx.filter='none';
      c.globalCompositeOperation='lighter'; c.globalAlpha=clampN(0.16*lit,0,0.22); c.drawImage(st.bcv, fd.x0-cs/2, fd.y0-cs/2, W*cs, H*cs); }
    c.restore();
  }

  // a colour seen through more of itself, or by less light: each channel falls off faster the weaker it is
  function lampDeep(c0, ii){ return c0.map(function(v){ var t=v/255; return Math.round(255*t*Math.pow(Math.max(0,ii), 1+1.1*(1-t))+3); }); }
  function paintLamp(c, now, o){
    var sim=lampSim(), g=sim.geo, L=curLook(), look=L.id, P=L.p, col=LCOL_BY[ADV.lampCol]||LAMP_COLS[0], fin=(LBASE_BY[ADV.lampBase]||LAMP_BASES[0]).m, cx=LCX, d=o.detail||1;
    var B=clampN(ADV.lampBright,0,200)/100, on=!!ADV.lampOn, pw=on ? clampN(ADV.lampW,15,40)/25*(1+0.25*sim.S.music) : 0;
    var warm=LAMP.stat ? clampN((LAMP.stat.tBot-22)/28,0,1) : 0, lit=on ? Math.min(1.5,pw)*B*(0.55+0.45*Math.min(1,warm+0.5)) : 0;
    var thermal=look==='thermal', uv=look==='blacklight', neon=look==='neon', xray=look==='xray';
    var add=function(fn){ c.save(); c.globalCompositeOperation='lighter'; fn(); c.restore(); };
    var liq= uv ? [96,30,190] : xray ? [90,140,200] : neon ? [40,0,70] : col.liq, glowC=mix(liq, uv?col.uv:col.wax, 0.3);
    var mt= xray ? ['#0d1620','#1d3040','#6a8aa8','#a8c8e8','#2a4050'] : neon ? ['#0a0414','#14081e','#3a1050','#ff28c8','#1a0828'] : thermal ? ['#06041e','#120a40','#2a1a70','#3a2a90','#160c50'] : uv ? ['#120822','#2a1648','#5a3a90','#9a7ae0','#2a1848'] : fin;
    var Y0=g.Y0, Y1=g.Y1;

    // the room: the lamp lights the wall behind it and pools on the table (none of it on its own on black)
    var slide=o.view==='slide', room=o.view!=='solo' && !slide, radio=radioOn() && !slide, tableY=LFLOOR+(radio?RAD.extra:0);
    if(room && lit>0.01 && !thermal && !xray){ var br=110, bl=c.createRadialGradient(cx,92,4,cx,92,br); bl.addColorStop(0,rgba(glowC,clampN(0.2*lit,0,0.5))); bl.addColorStop(0.5,rgba(glowC,clampN(0.06*lit,0,0.2))); bl.addColorStop(1,rgba(glowC,0));
      c.fillStyle=bl; c.beginPath(); c.arc(cx,92,br,0,Math.PI*2); c.fill(); }
    if(room && P.synth){ c.save(); c.strokeStyle='rgba(255,40,200,0.22)'; c.lineWidth=0.5;
      for(var gx=-6; gx<=6; gx++){ c.beginPath(); c.moveTo(cx+gx*6, tableY); c.lineTo(cx+gx*40, tableY+120); c.stroke(); } c.restore(); }
    if(room){ var tg=c.createLinearGradient(0,tableY,0,tableY+30); tg.addColorStop(0,P.chassisCol[0]); tg.addColorStop(1,P.chassisCol[1]); c.fillStyle=tg; c.fillRect(-TW,tableY,TW*3,TH);
      c.fillStyle=P.chassisEdge; c.fillRect(-TW,tableY,TW*3,0.6); }
    if(room && lit>0.01) add(function(){ var pr=c.createRadialGradient(cx,tableY+3,1,cx,tableY+3,56); pr.addColorStop(0,rgba(glowC,clampN((radio?0.18:0.3)*lit,0,0.6))); pr.addColorStop(1,rgba(glowC,0));
      c.save(); c.translate(cx,tableY+3); c.scale(1,0.2); c.translate(-cx,-(tableY+3)); c.fillStyle=pr; c.fillRect(cx-60,tableY-60,120,120); c.restore(); });
    if(radio) paintRadio(c, now, o, lit, glowC, add);

    // ---- the bottle: liquid, coil, wax, glass ----
    lampGlass(c, sim, 0, 26, 128); c.fillStyle= xray ? 'rgba(120,170,220,0.06)' : 'rgba(205,220,230,0.035)'; c.fill();
    // the liquid, lit from the bulb underneath (Thermal draws the liquid's own temperature instead)
    var ins=function(){ c.beginPath(); var y; c.moveTo(cx-sim.inner(Y1),Y1); for(y=Y1-1.5;y>Y0;y-=1.5) c.lineTo(cx-sim.inner(y),y); c.lineTo(cx-sim.inner(Y0),Y0); c.lineTo(cx+sim.inner(Y0),Y0); for(y=Y0+1.5;y<Y1;y+=1.5) c.lineTo(cx+sim.inner(y),y); c.lineTo(cx+sim.inner(Y1),Y1); c.closePath(); };
    // the liquid: the bulb's light carries most of the way up the bottle, and where it is weaker the colour
    // deepens (the liquid soaks up its weaker colours first, so yellow goes amber) instead of going grey
    if(!thermal){ var lg=c.createLinearGradient(0,Y0,0,Y1+1), k0=col.clear&&!uv&&!neon&&!xray ? 0.35 : 1;
      [0,0.2,0.45,0.7,0.88,1].forEach(function(s){ var ii=clampN(0.08+lit*k0*(0.6+0.34*Math.exp(-(1-s)*93/50)),0,1); lg.addColorStop(s, rgba(lampDeep(liq, ii), 1)); });
      ins(); c.fillStyle=lg; c.fill();
      if(lit>0.01) add(function(){ var cg=c.createRadialGradient(0,0,0,0,0,1); cg.addColorStop(0,rgba(liq,clampN(0.5*lit*k0,0,0.8))); cg.addColorStop(0.45,rgba(liq,clampN(0.14*lit*k0,0,0.3))); cg.addColorStop(1,rgba(liq,0));
        ins(); c.translate(cx,Y1+6); c.scale(26,70); c.fillStyle=cg; c.fill(); });
    }
    // headspace under the cap, and the meniscus
    lampGlass(c, sim, 1.4, 30, Y0); c.fillStyle= thermal ? '#05031a' : 'rgba(12,10,9,0.92)'; c.fill();
    c.strokeStyle= rgba(xray?[170,210,255]:[255,255,255], 0.18+0.15*Math.min(1,lit)); c.lineWidth=0.5; c.beginPath(); c.ellipse(cx, Y0, sim.inner(Y0), sim.inner(Y0)*0.12, 0, 0, Math.PI); c.stroke();
    // the coil lying on the bottom (a flat spring that spreads the heat and breaks the wax's grip)
    c.save(); c.strokeStyle= xray ? 'rgba(220,240,255,0.9)' : thermal ? thermCol(0.55+0.4*warm) : neon ? 'rgba(0,240,255,0.8)' : 'rgba(170,165,160,0.75)'; c.lineWidth=0.75; c.beginPath();
    for(var a=0; a<=Math.PI*2*3.2; a+=0.2){ var rr=2.5+a*0.42, px=cx+Math.cos(a)*rr, py=Y1-1.1+Math.sin(a)*rr*0.16; if(a===0) c.moveTo(px,py); else c.lineTo(px,py); } c.stroke(); c.restore();
    // the wax
    lampPaintWax(c, o.view, sim, look, o, lit);
    // the bulb shining up through the bottom of the glass and the pool
    if(lit>0.01 && !thermal) add(function(){ var bg=c.createRadialGradient(cx,Y1+2,0,cx,Y1+2,18); bg.addColorStop(0,rgba(mix(liq,[255,240,210],0.5),clampN(0.55*lit,0,0.9))); bg.addColorStop(1,rgba(liq,0));
      c.save(); c.translate(cx,Y1+2); c.scale(1,0.45); c.translate(-cx,-(Y1+2)); c.fillStyle=bg; c.fillRect(cx-20,Y1-20,40,40); c.restore(); });
    // glass: Fresnel edges, wall thickness, outline, highlights that follow the bottle
    var fr=c.createLinearGradient(cx-22,0,cx+22,0), gt= xray ? [150,200,255] : uv ? [190,150,255] : [215,225,235], ea= uv||neon ? 0.3 : 0.15;
    fr.addColorStop(0,rgba(gt,ea)); fr.addColorStop(0.12,rgba(gt,ea*0.35)); fr.addColorStop(0.3,rgba(gt,0)); fr.addColorStop(0.7,rgba(gt,0)); fr.addColorStop(0.88,rgba(gt,ea*0.35)); fr.addColorStop(1,rgba(gt,ea));
    lampGlass(c, sim, 0, 26, 127); c.fillStyle=fr; c.fill();
    if(neon) add(function(){ lampGlass(c, sim, 0, 27, 126, true); c.strokeStyle='rgba(0,240,255,0.25)'; c.lineWidth=3; c.stroke(); });
    lampGlass(c, sim, 0, 27, 126, true); c.strokeStyle= neon ? 'rgba(0,240,255,0.95)' : xray ? 'rgba(170,215,255,0.6)' : 'rgba(255,255,255,0.2)'; c.lineWidth=0.7; c.stroke();
    if(!thermal){ var ra=uv||neon ? 0.3 : 0.22; c.lineCap='round';
      lampWall(c, sim, -1, 36, 118, 4.5); c.strokeStyle=rgba([255,255,255],ra*0.35); c.lineWidth=3.2; c.stroke();
      lampWall(c, sim, -1, 38, 115, 4.6); c.strokeStyle=rgba([255,255,255],ra*0.9); c.lineWidth=0.8; c.stroke();
      lampWall(c, sim, 1, 44, 110, 2.6); c.strokeStyle=rgba([255,255,255],ra*0.45); c.lineWidth=1; c.stroke(); }

    // ---- the cap ----
    var capPath=function(){ c.beginPath(); c.moveTo(cx-13.9,31.2); c.quadraticCurveTo(cx-11.2,19,cx-7.8,9.2); c.lineTo(cx+7.8,9.2); c.quadraticCurveTo(cx+11.2,19,cx+13.9,31.2); c.ellipse(cx,31.2,13.9,1.9,0,0,Math.PI,false); c.closePath(); };
    capPath(); c.fillStyle=metalGrad(c,cx-14,cx+14,mt); c.fill();
    c.beginPath(); c.ellipse(cx,9.2,7.8,1.25,0,0,Math.PI*2); c.fillStyle=mt[1]; c.fill(); c.strokeStyle='rgba(255,255,255,0.22)'; c.lineWidth=0.4; c.stroke();
    c.beginPath(); c.ellipse(cx,31.2,13.9,1.9,0,0,Math.PI); c.strokeStyle='rgba(255,255,255,0.28)'; c.lineWidth=0.5; c.stroke();
    if(lit>0.01) add(function(){ c.beginPath(); c.ellipse(cx,31.6,13,1.6,0,0,Math.PI); c.strokeStyle=rgba(glowC,clampN(0.25*lit,0,0.5)); c.lineWidth=1; c.stroke(); });

    // ---- the base: a spun cone with the bulb inside ----
    var basePath=function(){ c.beginPath(); c.moveTo(cx-19.6,LBASE); c.bezierCurveTo(cx-21,150,cx-24,176,cx-33,LFLOOR); c.ellipse(cx,LFLOOR,33,4.8,0,Math.PI,0,true); c.bezierCurveTo(cx+24,176,cx+21,150,cx+19.6,LBASE); c.ellipse(cx,LBASE,19.6,3.1,0,0,Math.PI,false); c.closePath(); };
    basePath(); c.fillStyle=metalGrad(c,cx-30,cx+30,mt); c.fill();
    var sg=c.createLinearGradient(0,LBASE,0,LFLOOR); sg.addColorStop(0,'rgba(0,0,0,0)'); sg.addColorStop(1,'rgba(0,0,0,0.45)'); c.fillStyle=sg; c.fill();
    if(lit>0.01) add(function(){ var rg=c.createLinearGradient(0,LBASE,0,LBASE+22); rg.addColorStop(0,rgba(glowC,clampN(0.16*lit,0,0.4))); rg.addColorStop(1,rgba(glowC,0)); basePath(); c.fillStyle=rg; c.fill(); });
    // a rolled band near the top of the base
    c.beginPath(); c.ellipse(cx,LBASE+6,20.2,3.2,0,0,Math.PI); c.strokeStyle='rgba(255,255,255,0.16)'; c.lineWidth=0.6; c.stroke();
    c.beginPath(); c.ellipse(cx,LBASE+6.8,20.3,3.2,0,0,Math.PI); c.strokeStyle='rgba(0,0,0,0.35)'; c.lineWidth=0.5; c.stroke();
    // light leaking between the glass and the collar
    c.beginPath(); c.ellipse(cx,LBASE,19.6,3.1,0,0,Math.PI); c.strokeStyle= lit>0.01 ? rgba(mix(glowC,[255,240,200],0.4),clampN(0.35+0.4*lit,0,1)) : 'rgba(255,255,255,0.18)'; c.lineWidth=0.8; c.stroke();
    if(lit>0.01) add(function(){ c.beginPath(); c.ellipse(cx,LBASE+0.4,19,2.7,0,0,Math.PI); c.strokeStyle=rgba(glowC,clampN(0.22*lit,0,0.5)); c.lineWidth=2.6; c.stroke(); });
    c.beginPath(); c.ellipse(cx,LFLOOR,33,4.8,0,0,Math.PI); c.strokeStyle='rgba(255,255,255,0.12)'; c.lineWidth=0.5; c.stroke();
    if(o.view==='rack' && !on && LAMP.stat && LAMP.stat.melt<0.1){ c.fillStyle='#6a6a6a'; c.font='9px '+(FONT||getComputedStyle(document.body).fontFamily); c.textAlign='center'; c.fillText('OFF', cx, TH-3+(radio?RAD.extra:0)); c.textAlign='start'; }
  }
  function renderLamp(cv, now, view, z, px, py, q){
    var f=fitCanvas(cv, q); if(!f) return null; lampTick(now);
    var c=f.c, r=f.r, L=curLook(), W=cv.width, H=cv.height;
    // with the radio the big view keeps the strip under the zoom buttons clear, so they never sit on its controls.
    // The slideshow view is the lamp alone, transparent, so a room picture can sit behind it.
    var solo=view==='solo', slide=view==='slide', SH=slide?TH:lampSceneH(), hh=f.h-(view==='big' && radioOn() ? Math.min(56, f.h*0.11) : 0);
    var s=Math.min(f.w/TW, hh/SH)*(view==='big'?0.94:solo?0.96:1)*(z||1), tx=f.w/2-(TW/2+(px||0))*s, ty=hh/2-(SH/2+(py||0))*s;
    if(slide){ if(cv.style.filter) cv.style.filter=''; }
    else if(cv.style.filter!==(L.css||'')) cv.style.filter=L.css||'';
    c.setTransform(1,0,0,1,0,0);
    var bg = slide ? null : (solo ? '#000' : L.p.bg || (view==='big' ? '#060504' : null)); if(bg){ c.fillStyle=bg; c.fillRect(0,0,W,H); } else c.clearRect(0,0,W,H);
    c.setTransform(r*s,0,0,r*s,r*tx,r*ty);
    paintLamp(c, now, { detail:r*s, view:view, ppu:r*s, vis:{ x0:-tx/s, y0:-ty/s, x1:(f.w-tx)/s, y1:(f.h-ty)/s } });
    c.setTransform(1,0,0,1,0,0); if(!solo && !slide) lookOverlay(c, W, H, L, now);
    return { s:s, tx:tx, ty:ty, w:f.w, h:hh };
  }
  function drawLamp(now){ renderLamp($('lampCv'), now, 'rack'); }

// ---- copied block ends ----

// ======================================================================
// ---- Filament additions (not in /otr) ----
// /otr keeps the lamp's settings in its rack state (ADV), reads the music level
// from its player, and can stand the lamp on a mini radio. The synth has no radio
// and keeps the lamp's settings as a page setting (localStorage filament_lamp,
// like the tube show and the face), never in a patch or a project. The names the
// copied block expects are defined here; the radio is always absent.
// The lamp is a picture: nothing here touches the audio path. "Music warms the
// bulb" reads the output level the page's frame loop already measures.
// ======================================================================
import { LOOK_BY, TUBE_LOOKS, fitCanvas, rgba, mix, mulberry32, clampN, thermCol, thermRGB, lookOverlay, TW, TH } from './tubepaint.js';

var LAMP_KEY = 'filament_lamp';
var LAMP_DEF = { lampOn:true, lampCol:'classic', lampBase:'gold', lampW:25, lampMusic:false, lampBright:100, lampTime:1, lampRadio:false };
var ADV = Object.assign({ look:'natural' }, LAMP_DEF);
var TV = { lvOverride:null };            // a test can hold the music level here
var TVZ = { subj:'lamp' };
var RAD = { extra:0 };                   // no radio under the synth's lamp
var FONT = null;
var LVL = 0;                             // the output level, 0 to 1, as /otr's level() reads it
var NODES = {};
var NIL = { textContent:'' };
function $(id){ return NODES[id] || NIL; }
function level(){ return LVL; }
function radioOn(){ return false; }
function lampSceneH(){ return TH; }   // /otr adds the radio's height here
function paintRadio(){}
function tvIsOpen(){ return false; }
function curLook(){ return LOOK_BY[ADV.look] || TUBE_LOOKS[0]; }

function normLamp(d){
  d = d && typeof d === 'object' ? d : {};
  var o = {};
  o.lampOn = d.lampOn !== false;
  // own keys only, so a stored "__proto__" or "toString" is not taken for a colourway
  o.lampCol = typeof d.lampCol === 'string' && Object.prototype.hasOwnProperty.call(LCOL_BY, d.lampCol) ? d.lampCol : LAMP_DEF.lampCol;
  o.lampBase = typeof d.lampBase === 'string' && Object.prototype.hasOwnProperty.call(LBASE_BY, d.lampBase) ? d.lampBase : LAMP_DEF.lampBase;
  o.lampW = clampN(Math.round(+d.lampW || LAMP_DEF.lampW), 15, 40);
  o.lampTime = clampN(Math.round(+d.lampTime || 1), 1, 8);
  o.lampMusic = !!d.lampMusic;
  return o;
}

// The wax lamp module (0.3 Delight, the brief's lava lamp module): a section on the Rack tab. o: { makeKnob, reduceMotion }.
// frame(now, lv) is called from the page's 30 fps loop only while the section is on screen, so a
// hidden lamp costs nothing; lampTick() caps its step at 0.1 s, so the wax picks up where it was.
export function createLamp(o){
  o = o || {};
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(LAMP_KEY) || 'null'); } catch (e) { saved = null; }
  // Reduced motion: a fresh page starts with the lamp off (its switch turns it on), and the warm-up
  // is not sped up and the speed knob stays at 1x, so the wax only ever moves at its own slow pace.
  var still = !!o.reduceMotion;
  Object.assign(ADV, normLamp(saved || (still ? { lampOn:false } : null)));
  if (still) ADV.lampTime = 1;
  var cv = document.getElementById('lampCv');
  NODES.lampStat = document.getElementById('lampStat');
  var onBtn = document.getElementById('lampOnBtn'), pilot = document.getElementById('lampPilot'), sec = document.getElementById('mLamp');
  var musBtn = document.getElementById('lampMusicBtn'), colSel = document.getElementById('lampColSel'), baseSel = document.getElementById('lampBaseSel');
  var newBtn = document.getElementById('lampNewBtn');
  var T = { frames:0, drawMs:0, worstMs:0, last:0 };
  // on screen: the page calls frame() whenever the Rack tab shows this section, and on a wide screen every section
  // shows, so the lamp also watches whether its canvas is in view and paints (and runs) only while it is
  var vis = true;
  if (cv && typeof IntersectionObserver !== 'undefined') { vis = false;
    new IntersectionObserver(function(es){ vis = es[es.length - 1].isIntersecting; }).observe(cv); }
  // a box that changes size gets its bitmap fitted and one picture at once, in view or not, so the canvas is
  // never left stretched (the browser's 300 x 150 default) under a section that is off screen
  if (cv && typeof ResizeObserver !== 'undefined') { var rw = 0, rh = 0;
    new ResizeObserver(function(){ var w = cv.clientWidth, h = cv.clientHeight; if (!w || !h || (w === rw && h === rh)) return; rw = w; rh = h;
      try { renderLamp(cv, performance.now(), 'rack'); } catch (e) {} }).observe(cv); }
  function save(){ try { localStorage.setItem(LAMP_KEY, JSON.stringify(normLamp(ADV))); } catch (e) {} }
  function sync(){
    if (onBtn) { onBtn.setAttribute('aria-pressed', String(ADV.lampOn)); onBtn.textContent = ADV.lampOn ? 'on' : 'off'; }
    if (pilot) pilot.classList.toggle('off', !ADV.lampOn);
    if (sec) sec.classList.toggle('off', !ADV.lampOn);
    if (musBtn) musBtn.setAttribute('aria-pressed', String(ADV.lampMusic));
    if (colSel && colSel.value !== ADV.lampCol) colSel.value = ADV.lampCol;
    if (baseSel && baseSel.value !== ADV.lampBase) baseSel.value = ADV.lampBase;
    if (kW) kW.set(ADV.lampW); if (kT) kT.set(ADV.lampTime);
    if (LAMP.sim) { LAMP.statT = 0; lampWatch(); syncLampStat(); }
  }
  function set(k, v){ ADV[k] = v; Object.assign(ADV, normLamp(ADV)); if (still) ADV.lampTime = 1; save(); sync(); }
  if (colSel) { LAMP_COLS.forEach(function(x){ var op = document.createElement('option'); op.value = x.id; op.textContent = x.name; colSel.appendChild(op); });
    colSel.addEventListener('change', function(){ set('lampCol', colSel.value); }); }
  if (baseSel) { LAMP_BASES.forEach(function(x){ var op = document.createElement('option'); op.value = x.id; op.textContent = x.name; baseSel.appendChild(op); });
    baseSel.addEventListener('change', function(){ set('lampBase', baseSel.value); }); }
  if (onBtn) onBtn.addEventListener('click', function(){ set('lampOn', !ADV.lampOn); });
  if (musBtn) musBtn.addEventListener('click', function(){ set('lampMusic', !ADV.lampMusic); });
  if (newBtn) newBtn.addEventListener('click', function(){ lampRestart(); });
  var kHost = document.getElementById('kLamp'), kW = null, kT = null;
  if (kHost && o.makeKnob) {
    kW = o.makeKnob(kHost, { label:'bulb', min:15, max:40, step:1, value:ADV.lampW, def:25, fmt:function(v){ return Math.round(v) + ' W'; },
      title:'The bulb under the glass: more watts run the lamp hotter (the wax stays up), fewer make it lazy', onChange:function(v){ set('lampW', v); } });
    kT = o.makeKnob(kHost, { label:'speed', min:1, max:8, step:1, value:ADV.lampTime, def:1, fmt:function(v){ return Math.round(v) + 'x'; },
      title:still ? 'Speed: held at 1x while the system asks for reduced motion' : 'Speed: 1x is a real lamp\'s pace; the first warm-up is always shown at 3x or more', onChange:function(v){ set('lampTime', v); } });
    kW.el.setAttribute('aria-label', 'Wax lamp bulb'); kT.el.setAttribute('aria-label', 'Wax lamp speed');
  }
  sync();
  return {
    // lv: the louder output side's RMS (0 to 1); /otr's level() is the same RMS times 2.2, capped at 1
    frame: function(now, lv, face){
      LVL = clampN((+lv || 0) * 2.2, 0, 1);
      ADV.look = face === 'blacklight' ? 'blacklight' : 'natural';
      // the wax moves slowly, so the picture is painted at about 15 frames a second (the simulation keeps
      // its own clock, so it runs at the same speed whatever the paint rate)
      if (!cv || !vis || now - T.last < 60) return;
      var t0 = performance.now();
      renderLamp(cv, now, 'rack');
      var ms = performance.now() - t0;
      T.frames++; T.drawMs += (ms - T.drawMs) * (T.frames < 5 ? 0.5 : 0.1); if (T.frames > 20 && ms > T.worstMs) T.worstMs = ms; T.last = now;
    },
    test: {
      state: function(){ var s = LAMP.sim; return { set:normLamp(ADV), look:ADV.look, warming:LAMP.warming, stat:s ? s.stats() : null,
        music:s ? s.S.music : 0, power:s ? (s.S.on ? s.S.power * (1 + 0.6 * s.S.music) : 0) : 0, seed:LAMP.seed, status:lampStatus(),
        frames:T.frames, drawMs:T.drawMs, worstMs:T.worstMs, still:still, level:LVL, inView:vis }; },
      // run the wax for sec simulated seconds at the current settings (and music level), as the frame loop would
      advance: function(sec, lv){ var sim = lampSim(); sim.S.on = !!ADV.lampOn; sim.S.power = clampN(ADV.lampW,15,40)/25;
        var n = Math.round(sec / sim.DT), m = ADV.lampMusic ? clampN((lv == null ? LVL : lv) * 1.6, 0, 1) : 0;
        for (var i = 0; i < n; i++) { sim.S.music = m; sim.step(); } lampWatch(); return sim.stats(); },
      restart: function(seed){ lampRestart(seed); return LAMP.seed; },
      set: function(k, v){ set(k, v); return normLamp(ADV); },
      hold: function(lv){ TV.lvOverride = lv == null ? null : clampN(+lv, 0, 1); },
    },
  };
}
