// Filament rack: tube voicings, effects chain, cabinets, rooms, width, limiter.
// COPIED from /otr/index.html at commit f9f5d2b (lines 1466-1467, 2623-2652, 2679-2700, 2792-2837, 2840-3047), per the Filament
// design brief, decision 5: the synth carries its own copy of the /otr tube code
// instead of sharing it through /lib/. The copied block is verbatim; anything the
// synth adds is below the "Filament additions" line. If the two ever need to be
// merged into /lib/, diff the copied block against /otr at that commit first.

// ---- copied block starts ----
  function hashStr(str){ var h=2166136261>>>0; for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return h; }
  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  var TUBES = [
    { id:'12AX7', kind:'preamp triode', shape:'mini', twin:true, gain:0.774, b0:0.25, kp:1.00, kn:0.55, h:1.8, hp:25, lp:17000, blue:0,
      note:'High gain. The classic preamp tube: warm, even-order harmonics that bloom early.' },
    { id:'12AT7', kind:'preamp triode', shape:'mini', twin:true, gain:0.701, b0:0.25, kp:0.90, kn:0.60, h:2.0, hp:25, lp:18000, blue:0,
      note:'Medium gain. Cleaner than a 12AX7, with a little sparkle when pushed.' },
    { id:'12AU7', kind:'preamp triode', shape:'mini', twin:true, gain:0.433, b0:0.3, kp:0.80, kn:0.66, h:2.2, hp:25, lp:19000, blue:0,
      note:'Low gain and very linear. Gentle warmth with lots of headroom.' },
    { id:'300B', kind:'directly heated triode', shape:'globe', gain:0.445, b0:0.55, kp:0.85, kn:0.50, h:1.6, hp:30, lp:16000, blue:0, filament:true,
      note:'The audiophile single-ended triode. Low gain, very soft knee, rich second harmonic. Watch the filament.' },
    { id:'EL84', kind:'power pentode', shape:'mini', gain:1.625, b0:0.12, kp:1.05, kn:0.90, h:2.6, hp:60, lp:11000, blue:0.5,
      note:'Small power pentode. Chimey, compresses early, more odd-order bite.' },
    { id:'6V6', kind:'beam power tetrode', shape:'octal', gain:1.354, b0:0.15, kp:1.00, kn:0.80, h:2.4, hp:50, lp:12000, blue:0.4,
      note:'Sweet and round. Breaks up early with a smooth top end.' },
    { id:'EL34', kind:'power pentode', shape:'tall', gain:2.253, b0:0.06, kp:1.00, kn:0.95, h:3.0, hp:45, lp:13000, blue:0.7,
      note:'Mid-forward and gritty. Strong odd harmonics when driven.' },
    { id:'6L6', kind:'beam power tetrode', shape:'bottle', gain:2.099, b0:0.05, kp:0.90, kn:0.88, h:3.2, hp:40, lp:14000, blue:0.6,
      note:'Big clean headroom and firm lows. Stays tidy until pushed hard.' },
    { id:'KT88', kind:'beam power tetrode', shape:'big', gain:2.184, b0:0.04, kp:0.80, kn:0.78, h:3.6, hp:35, lp:15000, blue:0.9,
      note:'The biggest bottle here. Tight and wide, with the most headroom of the set.' }
  ];
  var TUBE_BY = {}; TUBES.forEach(function(t){ TUBE_BY[t.id]=t; });
  var ISO = {
    31: [20,25,31.5,40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000,5000,6300,8000,10000,12500,16000,20000],
    15: [25,40,63,100,160,250,400,630,1000,1600,2500,4000,6300,10000,16000],
    10: [31.5,63,125,250,500,1000,2000,4000,8000,16000]
  };
  var BPO = { 31:3, 15:1.5, 10:1 };                               // bands per octave
  function bandQ(n){ var N=1/BPO[n], p=Math.pow(2,N); return Math.sqrt(p)/(p-1); }   // 4.32 / 2.15 / 1.41
  function dB2lin(d){ return Math.pow(10, d/20); }
  function clampN(v,a,b){ return Math.max(a, Math.min(b, v)); }
  // ---- speakers, rooms and scenes for the second row of the rack ----
  // Speaker cabinets: the same seven filters for every cabinet (HP, HP, peak, peak, peak, LP, LP)
  // plus a short "box" echo that adds the comb colour of a cabinet. HP/LP Q is Web Audio's
  // resonance in dB (-3.01 is Butterworth); peaking Q is linear. Values are at full intensity.
  var CABS = [
    { id:'console', name:"Console radio '40s", note:'A floor console with a 12-inch field-coil speaker in an open-back wooden cabinet: warm boom around 140 Hz, soft top end.',
      f:[['highpass',70,2.0],['highpass',70,-3.01],['peaking',140,1.1,4.5],['peaking',450,1.0,1.5],['peaking',2400,1.2,2.5],['lowpass',5200,1.0],['lowpass',5200,-3.01]], box:[1.1,0.22] },
    { id:'bakelite', name:"Tabletop Bakelite '50s", note:'A kitchen-table set with a 5-inch speaker in a small plastic box: no bass, a forward nasal midrange.',
      f:[['highpass',180,3.0],['highpass',180,-3.01],['peaking',420,1.6,3],['peaking',1500,1.2,5],['peaking',3000,2.0,2],['lowpass',3800,2.0],['lowpass',3800,-3.01]], box:[0.45,0.30] },
    { id:'horn', name:"Theater horn '30s", note:'A movie-palace horn: honky, projecting midrange that cuts across a big room.',
      f:[['highpass',110,1.0],['highpass',110,-3.01],['peaking',300,1.0,-3],['peaking',950,0.9,4.5],['peaking',2800,1.5,3],['lowpass',7000,1.0],['lowpass',7000,-3.01]], box:[2.2,0.15] },
    { id:'monitor', name:"Studio monitor '40s", note:'A broadcast studio monitor: the widest range of the four, just a little rounded at each end.',
      f:[['highpass',55,1.0],['highpass',55,-3.01],['peaking',100,1.0,2],['peaking',800,1.0,-1],['peaking',3000,1.0,1.5],['lowpass',9500,0.5],['lowpass',9500,-3.01]], box:[0.8,0.10] }
  ];
  var CAB_BY={}; CABS.forEach(function(c){ CAB_BY[c.id]=c; });
  var ROOMS = [
    { id:'living',  name:"Living room '40s", decay:0.55, pre:3,  span:22,  er:7,  tone:4, mix:20, note:'Rugs, drapes and a sofa: short and soft.' },
    { id:'studio',  name:'Radio studio',     decay:0.9,  pre:6,  span:40,  er:9,  tone:6, mix:15, note:'A treated broadcast studio: a little air, no echo.' },
    { id:'theater', name:'Theater',          decay:1.8,  pre:16, span:70,  er:10, tone:5, mix:22, note:'A plaster movie palace with balcony reflections.' },
    { id:'hall',    name:'Grand hall',       decay:3.4,  pre:28, span:110, er:12, tone:4, mix:25, note:'Stone and height: a long, dark tail.' }
  ];
  var ROOM_BY={}; ROOMS.forEach(function(r){ ROOM_BY[r.id]=r; });
  // The tube's transfer curve. g() is a soft clipper whose knee hardness is h and whose
  // positive and negative halves saturate at 1/kp and 1/kn. Re-centred on the bias point
  // and normalised to unity small-signal slope, then scaled by the drive.
  function tubeCurve(t, drive, bias){
    var n=4096, c=new Float32Array(n), G=t.gain*Math.pow(2,(drive-3)*0.5), b=bias*0.08+(t.b0||0);
    var g=function(u){ var k=u>=0?t.kp:t.kn; return u/Math.pow(1+Math.pow(Math.abs(k*u),t.h),1/t.h); };
    var e=1e-4, sl=(g(b+e)-g(b-e))/(2*e), g0=g(b);
    for(var i=0;i<n;i++){ var v=i/(n-1)*2-1; c[i]=(g(2*G*v+b)-g0)/sl; }   // node input is pre-padded by 0.5
    var A=0.18, M=256, ys=[], dc=0, si=0, so=0, j, x;
    for(j=0;j<M;j++){ x=A*Math.sin(2*Math.PI*j/M); ys.push(curveAt(c,0.5*x)); dc+=ys[j]; }
    dc/=M;
    for(j=0;j<M;j++){ x=A*Math.sin(2*Math.PI*j/M); si+=x*x; so+=(ys[j]-dc)*(ys[j]-dc); }
    return { curve:c, makeup: so>0 ? Math.sqrt(si/so) : 1, G:G, b:b };
  }
  function curveAt(c,v){ var p=(v+1)/2*(c.length-1); if(p<=0) return c[0]; if(p>=c.length-1) return c[c.length-1]; var i=Math.floor(p), f=p-i; return c[i]*(1-f)+c[i+1]*f; }
  // Static harmonic profile of a curve: a 0.25 amplitude sine through it, DFT at 1..5x.
  function harmonics(tc){
    var M=512, A=0.25, re=[0,0,0,0,0,0], im=[0,0,0,0,0,0];
    for(var j=0;j<M;j++){ var ph=2*Math.PI*j/M, y=curveAt(tc.curve, 0.5*A*Math.sin(ph))*tc.makeup;
      for(var k=1;k<=5;k++){ re[k]+=y*Math.cos(k*ph); im[k]+=y*Math.sin(k*ph); } }
    var mag=[0]; for(var k2=1;k2<=5;k2++) mag.push(Math.sqrt(re[k2]*re[k2]+im[k2]*im[k2]));
    var thd=Math.sqrt(mag[2]*mag[2]+mag[3]*mag[3]+mag[4]*mag[4]+mag[5]*mag[5])/(mag[1]||1);
    return { db:[2,3,4,5].map(function(k){ return 20*Math.log(Math.max(1e-9,mag[k]/(mag[1]||1)))/Math.LN10; }), thd:thd };
  }
  // RBJ peaking filter magnitude in dB, same maths as BiquadFilterNode 'peaking'.
  function peakDb(f, f0, Q, gdb, fs){
    if(!gdb || f0>=fs*0.5) return 0;
    var A=Math.pow(10,gdb/40), w0=2*Math.PI*f0/fs, al=Math.sin(w0)/(2*Q), cw=Math.cos(w0);
    var b0=1+al*A, b1=-2*cw, b2=1-al*A, a0=1+al/A, a1=-2*cw, a2=1-al/A, w=2*Math.PI*f/fs;
    var c1=Math.cos(w), s1=Math.sin(w), c2=Math.cos(2*w), s2=Math.sin(2*w);
    var nr=b0+b1*c1+b2*c2, ni=-(b1*s1+b2*s2), dr=a0+a1*c1+a2*c2, di=-(a1*s1+a2*s2);
    return 10*Math.log((nr*nr+ni*ni)/(dr*dr+di*di))/Math.LN10;
  }
  // RBJ high shelf, S=1 (BiquadFilterNode 'highshelf'). The top fader is a shelf from its lower band
  // edge: a peaking filter that close to Nyquist gets squeezed and leaves a ripple between 16k and 20k.
  function shelfDb(f, f0, gdb, fs){
    if(!gdb) return 0;
    var A=Math.pow(10,gdb/40), w0=2*Math.PI*f0/fs, cw=Math.cos(w0), al=Math.sin(w0)/2*Math.SQRT2, sA=2*Math.sqrt(A)*al;
    var b0=A*((A+1)+(A-1)*cw+sA), b1=-2*A*((A-1)+(A+1)*cw), b2=A*((A+1)+(A-1)*cw-sA), a0=(A+1)-(A-1)*cw+sA, a1=2*((A-1)-(A+1)*cw), a2=(A+1)-(A-1)*cw-sA;
    var w=2*Math.PI*f/fs, c1=Math.cos(w), s1=Math.sin(w), c2=Math.cos(2*w), s2=Math.sin(2*w);
    var nr=b0+b1*c1+b2*c2, ni=-(b1*s1+b2*s2), dr=a0+a1*c1+a2*c2, di=-(a1*s1+a2*s2);
    return 10*Math.log((nr*nr+ni*ni)/(dr*dr+di*di))/Math.LN10;
  }
  function topShelfF(n){ var c=ISO[n]; return c[c.length-1]*Math.pow(2,-1/(2*BPO[n])); }
  function bandDb(f, i, n, g, fs){ return i===ISO[n].length-1 ? shelfDb(f, Math.min(topShelfF(n), fs*0.45), g, fs) : peakDb(f, ISO[n][i], bandQ(n), g, fs); }
  function respFor(f, gains, n, fs){ var s=0; for(var i=0;i<gains.length;i++) s+=bandDb(f, i, n, gains[i], fs); return s; }
  // DynamicsCompressorNode applies a hidden makeup gain: 0.6 x the full-scale gain reduction (in dB).
  // This mirrors the shared Blink/WebKit/Gecko kernel (KneeCurve, KAtSlope, Saturate) so the chain
  // can take exactly that much back out and keep bypass and processing at the same level.
  function compMakeupDb(thrDb, kneeDb, ratio){
    var lin=function(d){ return Math.pow(10,d/20); }, db=function(x){ return 20*Math.log(Math.max(x,1e-12))/Math.LN10; };
    var lt=lin(thrDb), kt=lin(thrDb+kneeDb), slope=1/ratio;
    var knee=function(x,k){ return x<lt ? x : lt+(1-Math.exp(-k*(x-lt)))/k; };
    var slopeAt=function(x,k){ if(x<lt) return 1; var x2=x*1.001; return (db(knee(x2,k))-db(knee(x,k)))/(db(x2)-db(x)); };
    var mn=0.1, mx=10000, k=5; for(var i=0;i<15;i++){ if(slopeAt(kt,k)<slope) mx=k; else mn=k; k=Math.sqrt(mn*mx); }
    var yk=db(knee(kt,k)), full = 1<kt ? knee(1,k) : lin(yk+slope*(0-db(kt)));
    return -0.6*db(full);
  }


  // Web Audio BiquadFilterNode magnitude response in dB for any type we use (spec formulas).
  function bqDb(type, f, f0, Q, gdb, fs){
    f0=Math.min(f0, fs*0.49);
    var w0=2*Math.PI*f0/fs, cw=Math.cos(w0), sw=Math.sin(w0), A=Math.pow(10,(gdb||0)/40), b0,b1,b2,a0,a1,a2,al,sA;
    if(type==='lowpass'||type==='highpass'){ al=sw/(2*Math.pow(10,Q/20)); a0=1+al; a1=-2*cw; a2=1-al;
      if(type==='lowpass'){ b0=(1-cw)/2; b1=1-cw; b2=(1-cw)/2; } else { b0=(1+cw)/2; b1=-(1+cw); b2=(1+cw)/2; } }
    else if(type==='peaking'){ if(!gdb) return 0; al=sw/(2*Q); b0=1+al*A; b1=-2*cw; b2=1-al*A; a0=1+al/A; a1=-2*cw; a2=1-al/A; }
    else { if(!gdb) return 0; al=sw/2*Math.SQRT2; sA=2*Math.sqrt(A)*al;
      if(type==='highshelf'){ b0=A*((A+1)+(A-1)*cw+sA); b1=-2*A*((A-1)+(A+1)*cw); b2=A*((A+1)+(A-1)*cw-sA); a0=(A+1)-(A-1)*cw+sA; a1=2*((A-1)-(A+1)*cw); a2=(A+1)-(A-1)*cw-sA; }
      else { b0=A*((A+1)-(A-1)*cw+sA); b1=2*A*((A-1)-(A+1)*cw); b2=A*((A+1)-(A-1)*cw-sA); a0=(A+1)+(A-1)*cw+sA; a1=-2*((A-1)+(A+1)*cw); a2=(A+1)+(A-1)*cw-sA; } }
    var w=2*Math.PI*f/fs, c1=Math.cos(w), s1=Math.sin(w), c2=Math.cos(2*w), s2=Math.sin(2*w);
    var nr=b0+b1*c1+b2*c2, ni=-(b1*s1+b2*s2), dr=a0+a1*c1+a2*c2, di=-(a1*s1+a2*s2);
    return 10*Math.log((nr*nr+ni*ni)/(dr*dr+di*di))/Math.LN10;
  }
  // A cabinet at an intensity (0..10): corners slide in from 20 Hz / 20 kHz, peaks and the box echo scale up.
  function cabParams(S){
    var cab=CAB_BY[S.cab]||CABS[0], k=clampN(S.spkInt,0,10)/10;
    var f=cab.f.map(function(x){ var t=x[0], fr=x[1];
      if(t==='highpass') fr=20*Math.pow(fr/20,k); else if(t==='lowpass') fr=20000*Math.pow(fr/20000,k);
      return { type:t, f:fr, Q:x[2], g:(x[3]||0)*k }; });
    return { f:f, boxMs:cab.box[0], boxG:cab.box[1]*k };
  }
  function cabDb(f, P, fs){
    var s=0; P.f.forEach(function(x){ s+=bqDb(x.type, f, x.f, x.Q, x.g, fs); });
    var w=2*Math.PI*f*P.boxMs/1000, re=1+P.boxG*Math.cos(w), im=-P.boxG*Math.sin(w);
    return s+10*Math.log(re*re+im*im)/Math.LN10;
  }
  // Level trim: average the cabinet's response over 200 Hz - 3 kHz (where voices live) and undo it.
  function cabTrimDb(P, fs){ var s=0, n=24; for(var i=0;i<n;i++){ s+=cabDb(200*Math.pow(15,i/(n-1)), P, fs); } return -s/n; }

  // Early reflections for a room: deterministic, so the drawing and the impulse response agree.
  function roomER(S){
    var R=ROOM_BY[S.room]||ROOMS[0], rnd=mulberry32(hashStr('er:'+R.id)), out=[];
    for(var k=0;k<R.er;k++){ out.push({ t:(R.span*(k+1)/(R.er+1))*(0.65+0.7*rnd())/1000, g:(0.55+0.4*rnd())*(1-0.5*k/R.er), side:rnd()<0.5?0:1, s:rnd()<0.5?-1:1 }); }
    return out;
  }
  // Stereo impulse response: lowpassed noise with an RT60 envelope whose top end decays faster
  // (the Tone knob sets where), decorrelated left and right, plus the early reflections.
  function genIR(ctx, S){
    var sr=ctx.sampleRate, dec=clampN(S.rmDecay,0.2,6), len=Math.ceil(sr*Math.min(6.5, dec*1.3+0.06)), buf=ctx.createBuffer(2,len,sr);
    var fc0=1500*Math.pow(8, clampN(S.rmTone,0,10)/10), er=roomER(S), step=Math.exp(-6.91/(dec*sr));
    for(var ch=0; ch<2; ch++){
      var d=buf.getChannelData(ch), rnd=mulberry32(hashStr('ir:'+ch+':'+S.room)), lp=0, env=1, a=0;
      for(var i=0;i<len;i++){
        if((i&63)===0){ var t=i/sr, fc=fc0*Math.exp(-t*2.5/dec)+250; a=Math.exp(-2*Math.PI*fc/sr); }
        lp=(1-a)*(rnd()*2-1)+a*lp; d[i]=lp*env*2.2; env*=step;
      }
      er.forEach(function(e){ var idx=Math.floor((e.t+(e.side===ch?0:0.0007))*sr); if(idx<len) d[idx]+=e.s*e.g*Math.exp(-6.91*e.t/dec)*(e.side===ch?1:0.6); });
      var fi=Math.floor(sr*0.0015); for(var j=0;j<fi&&j<len;j++) d[j]*=j/fi;
    }
    return buf;
  }

  // Build the chain in any BaseAudioContext (the live one, or an OfflineAudioContext for tests).
  // Order, as in a hardware channel strip: EQ > de-esser > tube > speaker > room > width > limiter.
  function makeChain(ctx){
    var live = !(window.OfflineAudioContext && ctx instanceof OfflineAudioContext);
    var C = { ctx:ctx, filters:[], live:live };
    function G(v){ var g=ctx.createGain(); g.gain.value=(v==null?1:v); return g; }
    function MONO(v){ var g=G(v); g.channelCount=1; g.channelCountMode='explicit'; g.channelInterpretation='speakers'; return g; }
    function BQ(type,f,q){ var b=ctx.createBiquadFilter(); b.type=type; b.frequency.value=f; if(q!=null) b.Q.value=q; return b; }
    function setP(p,v){ if(live){ try{ p.setTargetAtTime(v, ctx.currentTime, 0.015); return; }catch(e){} } p.value=v; }
    function chain(list){ for(var i=0;i<list.length-1;i++) list[i].connect(list[i+1]); }
    C.setP=setP;
    C.input=G(); C.output=G();
    // EQ
    C.eqIn=G(); C.eqOut=G();
    // De-esser: Linkwitz-Riley 4th-order split (flat when summed); only the top band is compressed.
    // DynamicsCompressorNode looks ahead 6 ms (Blink, WebKit and Gecko share the kernel), which delays
    // only the top band; the voice band gets the same delay so the two still sum flat at the crossover.
    C.deIn=G(); C.deOut=G(); C.deLowG=G(); C.deLowDel=ctx.createDelay(0.05); C.deLowDel.delayTime.value=0.006;
    C.deLp=[BQ('lowpass',6000,-3.0103),BQ('lowpass',6000,-3.0103)]; C.deHp=[BQ('highpass',6000,-3.0103),BQ('highpass',6000,-3.0103)];
    C.deComp=ctx.createDynamicsCompressor(); C.deComp.knee.value=3; C.deComp.attack.value=0.001; C.deComp.release.value=0.06; C.deTrim=G();
    chain([C.deIn, C.deLp[0], C.deLp[1], C.deLowDel, C.deLowG, C.deOut]); chain([C.deIn, C.deHp[0], C.deHp[1], C.deComp, C.deTrim, C.deOut]);
    // Tube
    C.tIn=G(0.5); C.shaper=ctx.createWaveShaper(); C.shaper.oversample='4x'; C.tMake=G();
    C.dc=BQ('highpass',12,0.707); C.xHp=BQ('highpass',40,0.6); C.xLp=BQ('lowpass',16000,0.6);
    C.toneLo=BQ('lowshelf',220); C.toneHi=BQ('highshelf',3500);
    C.sag=ctx.createDynamicsCompressor(); C.sag.knee.value=6; C.sag.attack.value=0.008; C.tOut=G();
    chain([C.tIn, C.shaper, C.tMake, C.dc, C.xHp, C.xLp, C.toneLo, C.toneHi, C.sag, C.tOut]);
    // Speaker: seven filters, then the dry signal plus a short box echo, then a level trim.
    C.spkIn=G(); C.spkF=CABS[0].f.map(function(x){ return BQ(x[0], x[1], x[2]); }); C.spkMix=G(); C.spkBox=ctx.createDelay(0.01); C.spkBoxG=G(0); C.spkOut=G();
    chain([C.spkIn].concat(C.spkF)); var lastF=C.spkF[C.spkF.length-1];
    lastF.connect(C.spkMix); lastF.connect(C.spkBox); C.spkBox.connect(C.spkBoxG); C.spkBoxG.connect(C.spkMix); C.spkMix.connect(C.spkOut);
    // Room: dry plus pre-delayed convolution with a generated stereo impulse response.
    C.rmIn=G(); C.rmDry=G(); C.rmPre=ctx.createDelay(0.2); C.rmWet=G(0); C.rmOut=G(); C.conv=null;
    C.rmIn.connect(C.rmDry); C.rmDry.connect(C.rmOut); C.rmIn.connect(C.rmPre); C.rmWet.connect(C.rmOut);
    // Width (mid/side): M=(L+R)/2 stays as is. S = the original side plus a synthetic side made from
    // M by a short delay, band-limited to 220 Hz - 7 kHz so the bass stays centred. L=M+S, R=M-S,
    // so folding back to mono gives exactly M: nothing cancels on a mono speaker.
    C.wIn=G(); C.wIn.channelCount=2; C.wIn.channelCountMode='explicit'; C.wIn.channelInterpretation='speakers';
    C.wSplit=ctx.createChannelSplitter(2); C.wM=MONO(); C.wSo=MONO(); C.wSL=MONO(0.5); C.wSR=MONO(-0.5);
    C.wDel=ctx.createDelay(0.05); C.wSh=BQ('highpass',220,-3.0103); C.wSl=BQ('lowpass',7000,-3.0103); C.wSyn=MONO(0.6);
    C.wS=MONO(); C.wSw=MONO(1); C.wNeg=MONO(-1); C.wL=MONO(); C.wR=MONO(); C.wMerge=ctx.createChannelMerger(2); C.wOut=G();
    C.wIn.connect(C.wM); C.wIn.connect(C.wSplit); C.wSplit.connect(C.wSL,0); C.wSplit.connect(C.wSR,1); C.wSL.connect(C.wSo); C.wSR.connect(C.wSo); C.wSo.connect(C.wS);
    chain([C.wM, C.wDel, C.wSh, C.wSl, C.wSyn, C.wS, C.wSw]);
    C.wM.connect(C.wL); C.wM.connect(C.wR); C.wSw.connect(C.wL); C.wSw.connect(C.wNeg); C.wNeg.connect(C.wR);
    C.wL.connect(C.wMerge,0,0); C.wR.connect(C.wMerge,0,1); C.wMerge.connect(C.wOut);
    // Limiter, then a soft clipper that only acts above 0.89 so nothing leaves the chain over 0 dBFS.
    // DynamicsCompressorNode adds its own makeup gain (0.6 x the full-scale reduction, in dB, in
    // Chromium, WebKit and Gecko alike); the trims take it back out so bypass and processing match.
    C.lim=ctx.createDynamicsCompressor();
    C.lim.threshold.value=-1; C.lim.knee.value=0; C.lim.ratio.value=20; C.lim.attack.value=0.002; C.lim.release.value=0.12;
    C.limTrim=G(dB2lin(-compMakeupDb(-1,0,20))); C.clipIn=G(1/1.5); C.clip=ctx.createWaveShaper(); C.clip.oversample='2x';
    C.clip.curve=(function(){ var n=8192, c=new Float32Array(n), k=0.89; for(var i=0;i<n;i++){ var x=(i/(n-1)*2-1)*1.5, a=Math.abs(x);
      c[i]= a<k ? x : (x<0?-1:1)*(k+0.1*Math.tanh((a-k)/0.1)); } return c; })();
    chain([C.lim, C.limTrim, C.clipIn, C.clip]);
    // Stereo taps on the final output for the goniometer and correlation meter.
    if(live){ C.gTap=G(); C.gTap.channelCount=2; C.gTap.channelCountMode='explicit'; C.gTap.channelInterpretation='speakers';
      C.gSplit=ctx.createChannelSplitter(2); C.anL=ctx.createAnalyser(); C.anR=ctx.createAnalyser(); C.anL.fftSize=C.anR.fftSize=1024;
      C.output.connect(C.gTap); C.gTap.connect(C.gSplit); C.gSplit.connect(C.anL,0); C.gSplit.connect(C.anR,1); }
    C.n=0;
    C.setBands=function(S){
      try{ C.eqIn.disconnect(); }catch(e){}
      C.filters.forEach(function(f){ try{ f.disconnect(); }catch(e){} });
      var fs=ctx.sampleRate, q=bandQ(S.bands);
      var last=ISO[S.bands].length-1;
      C.filters=ISO[S.bands].map(function(fc,i){ var b = i===last ? BQ('highshelf', Math.min(topShelfF(S.bands), fs*0.45)) : BQ('peaking', Math.min(fc, fs*0.45), q);
        b.gain.value=S.gains[i]||0; return b; });
      var prev=C.eqIn; C.filters.forEach(function(f){ prev.connect(f); prev=f; }); prev.connect(C.eqOut);
      C.n=S.bands;
    };
    C.setGain=function(i,g){ if(C.filters[i]) setP(C.filters[i].gain, g); };
    C.setTube=function(S){
      var t=TUBE_BY[S.tube]||TUBES[0], tc=tubeCurve(t, S.drive, S.bias);
      C.shaper.curve=tc.curve; setP(C.tMake.gain, tc.makeup);
      setP(C.xHp.frequency, t.hp); setP(C.xLp.frequency, Math.min(t.lp, ctx.sampleRate*0.45));
      setP(C.toneLo.gain, -S.tone*0.4); setP(C.toneHi.gain, S.tone*0.9);
      var sagMk=0;
      if(S.sag<=0){ setP(C.sag.threshold,0); setP(C.sag.ratio,1); }
      else { var T=-4-S.sag*2.6, R=1.5+S.sag*0.25; setP(C.sag.threshold, T); setP(C.sag.ratio, R); setP(C.sag.release, 0.2+S.sag*0.02); sagMk=compMakeupDb(T,6,R); }
      setP(C.tOut.gain, dB2lin(S.out - sagMk));
      return tc;
    };
    // De-esser: Amount 0..10 sets threshold (-30 to -66 dBFS in the top band) and ratio (3:1 to 8:1).
    // Measured on real archive.org transfers, S-band peaks sit around -47 to -33 dBFS, so the default 5
    // (-48 dBFS) trims typical peaks by a few dB and 10 cuts them by about 20.
    C.setDe=function(S){
      var f=Math.min(S.deFreq*1000, ctx.sampleRate*0.45);
      C.deLp.concat(C.deHp).forEach(function(b){ setP(b.frequency, f); });
      var a=clampN(S.deAmt,0,10), T=a>0 ? -30-a*3.6 : 0, R=a>0 ? 3+a*0.5 : 1;
      setP(C.deComp.threshold, T); setP(C.deComp.ratio, R);
      setP(C.deTrim.gain, dB2lin(-(a>0 ? compMakeupDb(T,3,R) : compMakeupDb(0,3,1))) * (S.deListen ? 2 : 1));
      setP(C.deLowG.gain, S.deListen ? 0 : 1);
    };
    C.setSpk=function(S){
      var P=cabParams(S), fs=ctx.sampleRate;
      P.f.forEach(function(x,i){ var b=C.spkF[i]; if(b.type!==x.type) b.type=x.type; setP(b.frequency, Math.min(x.f, fs*0.45)); setP(b.Q, x.Q); setP(b.gain, x.g); });
      setP(C.spkBox.delayTime, P.boxMs/1000); setP(C.spkBoxG.gain, P.boxG);
      setP(C.spkMix.gain, dB2lin(cabTrimDb(P, fs)));
      return P;
    };
    // Room: equal-power dry/wet. A new impulse response gets a new ConvolverNode, faded in.
    C.setRoom=function(S, regen){
      var R=ROOM_BY[S.room]||ROOMS[0], m=clampN(S.rmMix,0,100)/100;
      setP(C.rmPre.delayTime, R.pre/1000);
      var dry=Math.cos(m*Math.PI/2), wet=Math.sin(m*Math.PI/2)*1.0;
      setP(C.rmDry.gain, dry);
      if(regen || !C.conv){
        var nc=ctx.createConvolver(); nc.normalize=true; nc.buffer=genIR(ctx,S);
        var old=C.conv; C.conv=nc; C.rmPre.connect(nc);
        if(old && live){ var t=ctx.currentTime; C.rmWet.gain.cancelScheduledValues(t); C.rmWet.gain.setTargetAtTime(0,t,0.02);
          setTimeout(function(){ try{ old.disconnect(); C.rmPre.disconnect(old); }catch(e){} nc.connect(C.rmWet); C.rmWet.gain.cancelScheduledValues(ctx.currentTime); C.rmWet.gain.setTargetAtTime(wetNow(), ctx.currentTime, 0.03); }, 90);
          return; }
        if(old){ try{ old.disconnect(); C.rmPre.disconnect(old); }catch(e){} }
        nc.connect(C.rmWet);
      }
      setP(C.rmWet.gain, wet);
      function wetNow(){ return Math.sin(clampN(S.rmMix,0,100)/100*Math.PI/2); }
    };
    // Width 0..200%: 0 folds to mono; the original side scales with it and the synthetic side tops out
    // at 0.9 of the mid at 200%, so neither channel ever flips polarity (no hollow, phasey sound).
    C.setWidth=function(S){ var w=clampN(S.width,0,200)/100; setP(C.wSo.gain, w); setP(C.wSyn.gain, 0.45*w); setP(C.wDel.delayTime, clampN(S.wChar,3,20)/1000); };
    C.route=function(S){
      [C.input, C.eqOut, C.deOut, C.tOut, C.spkOut, C.rmOut, C.wOut, C.clip].forEach(function(n){ try{ n.disconnect(); }catch(e){} });
      if(!S.on){ C.input.connect(C.output); return; }
      var cur=C.input;
      [['eqOn',C.eqIn,C.eqOut],['deOn',C.deIn,C.deOut],['tubeOn',C.tIn,C.tOut],['spkOn',C.spkIn,C.spkOut],['roomOn',C.rmIn,C.rmOut],['wOn',C.wIn,C.wOut]]
        .forEach(function(s){ if(S[s[0]]){ cur.connect(s[1]); cur=s[2]; } });
      cur.connect(C.lim); C.clip.connect(C.output);
    };
    C.apply=function(S){
      if(C.n!==S.bands) C.setBands(S); else S.gains.forEach(function(g,i){ C.setGain(i,g); });
      setP(C.eqIn.gain, dB2lin(S.pre));
      C.setTube(S); C.setDe(S); C.setSpk(S); C.setRoom(S, true); C.setWidth(S); C.route(S);
    };
    // Re-route with a 15 ms dip so switching sections never clicks.
    C.reroute=function(S, fn){
      if(!live){ if(fn) fn(); C.route(S); return; }
      var t=ctx.currentTime; C.output.gain.cancelScheduledValues(t); C.output.gain.setTargetAtTime(0, t, 0.004);
      setTimeout(function(){ if(fn) fn(); C.route(S); C.output.gain.cancelScheduledValues(ctx.currentTime); C.output.gain.setTargetAtTime(1, ctx.currentTime, 0.008); }, 22);
    };
    return C;
  }
// ---- copied block ends ----

// ======================================================================
// ---- Filament additions (not in /otr) ----
// The output stage as a pair of tubes. Single ended is the /otr stage as is.
// Push-pull drives a second shaper with the inverted signal and subtracts it:
// 0.5 * (T(x) - T(-x)) keeps only the odd part of the curve, so the even
// harmonics cancel the way they do in a real push-pull output transformer.
// ======================================================================
function ppMakeup(c){
  var A=0.18, M=256, si=0, so=0, j, x, y;
  for(j=0;j<M;j++){ x=A*Math.sin(2*Math.PI*j/M); y=0.5*(curveAt(c,0.5*x)-curveAt(c,-0.5*x)); si+=x*x; so+=y*y; }
  return so>0 ? Math.sqrt(si/so) : 1;
}
function makeSynthChain(ctx){
  var C = makeChain(ctx);
  function G(v){ var g=ctx.createGain(); g.gain.value=v; return g; }
  // rewire the tube stage: tIn -> shaper -> A -> sum ; tIn -> invert -> shaperB -> B -> sum ; sum -> tMake
  C.tIn.disconnect(); C.shaper.disconnect();
  C.ppA=G(1); C.ppInv=G(-1); C.shaperB=ctx.createWaveShaper(); C.shaperB.oversample='4x'; C.ppB=G(0); C.ppSum=G(1);
  C.tIn.connect(C.shaper); C.shaper.connect(C.ppA); C.ppA.connect(C.ppSum);
  C.tIn.connect(C.ppInv); C.ppInv.connect(C.shaperB); C.shaperB.connect(C.ppB); C.ppB.connect(C.ppSum);
  C.ppSum.connect(C.tMake);
  var setTube0 = C.setTube;
  // Single-ended, the B side's gain is exactly 0, yet its 4x oversampled shaper still ran. Its feed is
  // unplugged then, the same way and for the same reason as the ensemble's wet side (see makeEnsemble):
  // at once offline, live once ppB has faded (time constant 15 ms, 0.2 s is 13 of them).
  var bFed = true, bT = null;
  function feedB(want){
    if(want){ if(bT){ clearTimeout(bT); bT=null; } if(!bFed){ C.tIn.connect(C.ppInv); bFed=true; } return; }
    if(!bFed || bT) return;
    var cut=function(){ bT=null; if(bFed){ try{ C.tIn.disconnect(C.ppInv); }catch(e){} bFed=false; } };
    if(C.live) bT=setTimeout(cut, 200); else cut();
  }
  C.bFed = function(){ return bFed; };
  C.setTube = function(S){
    var tc = setTube0(S), pp = S.topology==='pp';
    C.shaperB.curve = tc.curve;
    feedB(pp);
    C.setP(C.ppA.gain, pp ? 0.5 : 1); C.setP(C.ppB.gain, pp ? -0.5 : 0);
    if(pp){ tc.makeup = ppMakeup(tc.curve); C.setP(C.tMake.gain, tc.makeup); }
    return tc;
  };
  // Mono check at the very end: (L+R)/2 on both channels, switched by two gains.
  C.monoIn=G(1); C.monoIn.channelCount=2; C.monoIn.channelCountMode='explicit'; C.monoIn.channelInterpretation='speakers';
  C.stG=G(1); C.moG=G(0); C.moSum=G(0.5); C.moSum.channelCount=1; C.moSum.channelCountMode='explicit'; C.moSum.channelInterpretation='speakers';
  C.moSplit=ctx.createChannelSplitter(2); C.moMerge=ctx.createChannelMerger(2); C.final=G(1);
  C.output.connect(C.monoIn); C.monoIn.connect(C.stG); C.stG.connect(C.final);
  C.monoIn.connect(C.moSplit); C.moSplit.connect(C.moSum,0); C.moSplit.connect(C.moSum,1);
  C.moSum.connect(C.moMerge,0,0); C.moSum.connect(C.moMerge,0,1); C.moMerge.connect(C.moG); C.moG.connect(C.final);
  // A last ceiling. The copied clipper stops at 0.99, but its 2x oversampling filter can ring a
  // percent past that on a hard transient; this unoversampled stage only touches those overshoots.
  C.ceil=ctx.createWaveShaper(); C.ceil.oversample='none';
  C.ceil.curve=(function(){ var n=4097, c=new Float32Array(n), k=0.97, r=0.0285; for(var i=0;i<n;i++){ var x=(i/(n-1)*2-1)*1.25, a=Math.abs(x);
    c[i]= a<k ? x : (x<0?-1:1)*(k+r*Math.tanh((a-k)/r)); } return c; })();
  // A WaveShaper reads its curve over an input of -1..1, so the curve (drawn over -1.25..1.25)
  // needs the input scaled by 1/1.25 to stay unity gain below the knee.
  C.ceilIn=G(1/1.25); C.final.connect(C.ceilIn); C.ceilIn.connect(C.ceil); C.out=C.ceil;
  C.setMono=function(on){ C.setP(C.stG.gain, on?0:1); C.setP(C.moG.gain, on?1:0); };   // moSum already halves: (L+R)/2, the mid
  // The EQ's spectrum tap (live only). The copied route() disconnects the chain's input and the
  // EQ's output each time it runs, so the tap is plugged back in after every route.
  addEqTap(C);
  var route0 = C.route;
  C.route = function(S){ route0(S); if(C.eqAn){ C.input.connect(C.eqTapIn); C.eqOut.connect(C.eqAn); } };
  return C;
}
// ======================================================================
// Ensemble: the bucket brigade chorus before the output tubes (brief: ENSEMBLE > ... > V3/V4).
//   I, II   one triangle LFO sweeps two delay lines in antiphase, one per side (0.513 / 0.863 Hz,
//           1.66 to 5.35 ms), the classic 1980s polysynth chorus.
//   I+II    the same lines swept fast and shallow (9.75 Hz, 3.3 to 3.7 ms): a shimmering vibrato.
//   strings three lines, each swept by a slow and a fast sine 120 degrees apart, mixed two to a
//           side: the three-phase string ensemble of the 1970s string machines.
// The delay lines read the mid (L+R)/2; the dry signal keeps its own stereo. Left and right wet
// are the same signal at slightly different delays, so folding to mono combs a little but never
// cancels. Lowpasses before and after stand in for the bucket brigade's own filters.
// ======================================================================
var ENS_MODES = {
  'I':       { rate: 0.513, center: 0.003505, depth: 0.001845, juno: 1, str: 0 },
  'II':      { rate: 0.863, center: 0.003505, depth: 0.001845, juno: 1, str: 0 },
  'I+II':    { rate: 9.75,  center: 0.0035,   depth: 0.0002,   juno: 1, str: 0 },
  'strings': { rate: 0,     center: 0.006,    depth: 0,        juno: 0, str: 1 }
};
function makeEnsemble(ctx){
  var live = !(window.OfflineAudioContext && ctx instanceof OfflineAudioContext);
  function G(v){ var g=ctx.createGain(); g.gain.value=v; return g; }
  function ST(n){ n.channelCount=2; n.channelCountMode='explicit'; n.channelInterpretation='speakers'; return n; }
  function LP(f){ var b=ctx.createBiquadFilter(); b.type='lowpass'; b.frequency.value=f; b.Q.value=0.6; return b; }
  function setP(p,v){ if(live){ try{ p.setTargetAtTime(v, ctx.currentTime, 0.03); return; }catch(e){} } p.value=v; }
  function sine(freq, deg){ var o=ctx.createOscillator(), ph=deg*Math.PI/180;
    o.setPeriodicWave(ctx.createPeriodicWave(new Float32Array([0, Math.sin(ph)]), new Float32Array([0, Math.cos(ph)]), { disableNormalization: true }));
    o.frequency.value=freq; return o; }
  var E = { oscs: [] };
  E.input=ST(G(1)); E.output=ST(G(1)); E.dry=ST(G(1)); E.input.connect(E.dry); E.dry.connect(E.output);
  E.mid=G(1); E.mid.channelCount=1; E.mid.channelCountMode='explicit'; E.mid.channelInterpretation='speakers';
  E.pre=LP(9000); E.input.connect(E.mid); E.mid.connect(E.pre);
  E.wetL=G(0); E.wetR=G(0); E.postL=LP(8000); E.postR=LP(8000); E.merge=ctx.createChannelMerger(2);
  E.wetL.connect(E.postL); E.wetR.connect(E.postR); E.postL.connect(E.merge,0,0); E.postR.connect(E.merge,0,1); E.merge.connect(E.output);
  // two antiphase lines
  E.dA=ctx.createDelay(0.05); E.dB=ctx.createDelay(0.05); E.dA.delayTime.value=E.dB.delayTime.value=0.0035;
  E.pre.connect(E.dA); E.pre.connect(E.dB);
  E.lfo=ctx.createOscillator(); E.lfo.type='triangle'; E.lfo.frequency.value=0.513;
  E.depA=G(0.001845); E.depB=G(-0.001845); E.lfo.connect(E.depA); E.lfo.connect(E.depB); E.depA.connect(E.dA.delayTime); E.depB.connect(E.dB.delayTime);
  E.jL=G(1); E.jR=G(1); E.dA.connect(E.jL); E.dB.connect(E.jR); E.jL.connect(E.wetL); E.jR.connect(E.wetR);
  E.oscs.push(E.lfo);
  // three-phase string lines
  E.sL=G(0); E.sR=G(0); E.sL.connect(E.wetL); E.sR.connect(E.wetR);
  E.sd=[0,1,2].map(function(k){
    var d=ctx.createDelay(0.05); d.delayTime.value=0.006; E.pre.connect(d);
    var slow=sine(0.63, k*120), fast=sine(5.3, k*120), gs=G(0.0012), gf=G(0.00025);
    slow.connect(gs); fast.connect(gf); gs.connect(d.delayTime); gf.connect(d.delayTime); E.oscs.push(slow, fast);
    if(k===0){ d.connect(E.sL); } else if(k===2){ d.connect(E.sR); } else { var h=G(0.5); d.connect(h); h.connect(E.sL); h.connect(E.sR); }
    return d; });
  E.oscs.forEach(function(o){ o.start(0); });
  // Idle wet side. With the ensemble off (or its mix at 0) the wet gains sit at exactly 0, but the
  // seven LFOs, five swept delay lines and three lowpasses still ran on every render quantum.
  // So the mid feed is unplugged while the wet is not wanted: the lines drain to silence, the
  // browser stops processing them once their tails pass (it skips a node whose inputs are silent,
  // and with it the oscillators that only drive its delay time), and the output is the dry path
  // alone, which is what it already was. Offline the graph is fixed before the render, so it
  // unplugs at once; live it waits until the wet gains have faded (time constant 30 ms, 0.3 s is
  // 10 of them), so switching the ensemble off never cuts a tail. On is replugged before the fade-in.
  E.fed=true; var unplugT=null;
  function feed(want){
    if(want){ if(unplugT){ clearTimeout(unplugT); unplugT=null; } if(!E.fed){ E.mid.connect(E.pre); E.fed=true; } return; }
    if(!E.fed || unplugT) return;
    var cut=function(){ unplugT=null; if(E.fed){ try{ E.mid.disconnect(E.pre); }catch(e){} E.fed=false; } };
    if(live) unplugT=setTimeout(cut, 300); else cut();
  }
  E.set=function(ens){
    ens=ens||{}; var on=!!ens.on, m=ENS_MODES[ens.mode]||ENS_MODES['I'], mix=Math.max(0, Math.min(1, (+ens.mix||0)/100));
    feed(on && mix > 0);
    if(m.juno){ setP(E.lfo.frequency, m.rate); setP(E.depA.gain, m.depth); setP(E.depB.gain, -m.depth); setP(E.dA.delayTime, m.center); setP(E.dB.delayTime, m.center); }
    setP(E.jL.gain, m.juno); setP(E.jR.gain, m.juno); setP(E.sL.gain, m.str*0.8); setP(E.sR.gain, m.str*0.8);
    // equal-loudness blend: the wet adds energy, so the dry comes down a little as the mix rises
    setP(E.wetL.gain, on ? mix*0.85 : 0); setP(E.wetR.gain, on ? mix*0.85 : 0);
    setP(E.dry.gain, on ? 1 - 0.32*mix : 1);
  };
  E.stop=function(){ E.oscs.forEach(function(o){ try{ o.stop(); }catch(e){} }); };
  return E;
}

// ======================================================================
// Graphic EQ, rack-wide (the first stage of makeChain: ensemble > EQ > output tubes).
// The chain's EQ (ISO band centres, 1/1, 2/3 and 1/3 octave peaking filters, the top band a
// shelf) and its response maths are in the copied block above. Here: the band counts a patch may
// use, the presets, and fitting a preset onto the faders. eqFit is copied from /otr/index.html at
// f9f5d2b (presetGains, lines 2670-2677); the preset shapes are new, voiced for a synthesizer.
// ======================================================================
var EQ_N = [10, 15, 31];
function eqLg2(x){ return Math.log(x)/Math.LN2; }
function eqBell(f,fc,oct,db){ var o=eqLg2(f/fc)/oct; return db*Math.exp(-o*o*1.4); }
function eqHi(f,fc,db){ return db/(1+Math.pow(2,-eqLg2(f/fc)*2.5)); }
function eqLo(f,fc,db){ return db/(1+Math.pow(2, eqLg2(f/fc)*2.5)); }
var EQ_PRESETS = [
  { id:'flat',     name:'flat',      f:function(){ return 0; } },
  { id:'warm',     name:'warm',      f:function(f){ return eqBell(f,160,1.3,3) + eqBell(f,500,1.2,1) + eqHi(f,7000,-4); } },
  { id:'smile',    name:'smile',     f:function(f){ return eqLo(f,120,6) + eqHi(f,8000,4) + eqBell(f,1000,1.5,-1); } },
  { id:'bass',     name:'bass lift', f:function(f){ return eqLo(f,150,7) + eqBell(f,400,1,-1); } },
  { id:'presence', name:'presence',  f:function(f){ return eqBell(f,2500,1.2,4) + eqLo(f,80,-2); } },
  { id:'air',      name:'air',       f:function(f){ return eqHi(f,10000,6); } },
  { id:'scoop',    name:'mid scoop', f:function(f){ return eqBell(f,800,1.5,-6); } },
  { id:'lowcut',   name:'low cut',   f:function(f){ return eqLo(f,150,-12); } },
  { id:'radio',    name:'AM radio',  f:function(f){ return eqLo(f,250,-12) + eqHi(f,3500,-12) + eqBell(f,1300,1.2,3); } }
];
var EQ_PRESET_BY = {}; EQ_PRESETS.forEach(function(p){ EQ_PRESET_BY[p.id]=p; });
function eqBandsOf(n){ return ISO[n] ? n : 10; }
function eqCentres(n){ return ISO[eqBandsOf(n)].slice(); }
// The summed response in dB of n faders at gains (the same filters the chain builds).
function eqResponse(f, gains, n, fs){ return respFor(f, gains, eqBandsOf(n), fs||48000); }
// Neighbouring bands overlap, so faders set straight to a shape overshoot it. A few relaxation
// passes pick fader positions whose summed curve lands on the preset's shape.
function eqFit(id, n){
  n=eqBandsOf(n);
  var p=EQ_PRESET_BY[id]||EQ_PRESET_BY.flat, c=ISO[n], tg=c.map(function(fc){ return clampN(p.f(fc),-12,12); }), g=tg.slice();
  for(var it=0; it<10; it++){ var r=c.map(function(fc){ return respFor(fc, g, n, 48000); });
    g=g.map(function(x,i){ return clampN(x+0.7*(tg[i]-r[i]), -12, 12); }); }
  return g.map(function(x){ x=Math.round(x*2)/2; return Math.abs(x)<0.5?0:x; });
}
// The target shape of a preset at a frequency (what eqFit aims for), for the tests and the plot.
function eqTarget(id, f){ var p=EQ_PRESET_BY[id]||EQ_PRESET_BY.flat; return clampN(p.f(f),-12,12); }
// A new band count keeps the shape: a preset is fitted again; custom faders read the old curve
// (interpolated on a log frequency axis) at their new centres. Copied from /otr setBandCount.
function eqResample(gains, from, to, preset){
  from=eqBandsOf(from); to=eqBandsOf(to);
  if(preset && preset!=='custom') return eqFit(preset, to);
  var old=ISO[from], og=gains;
  return ISO[to].map(function(fc){
    var x=eqLg2(fc), i=0; while(i<old.length-1 && eqLg2(old[i+1])<x) i++;
    if(x<=eqLg2(old[0])) return og[0]||0; if(i>=old.length-1) return og[old.length-1]||0;
    var f=(x-eqLg2(old[i]))/(eqLg2(old[i+1])-eqLg2(old[i])); return Math.round(((og[i]||0)*(1-f)+(og[i+1]||0)*f)*2)/2; });
}
// Live only: an analyser for the EQ's LED ladders. It hears the EQ's output when the EQ is in
// circuit and the chain's input when it is bypassed (setEqTap), so the ladders always move.
function addEqTap(C){
  var ctx=C.ctx; if(!C.live) return C;
  C.eqAn=ctx.createAnalyser(); C.eqAn.fftSize=8192; C.eqAn.smoothingTimeConstant=0;
  C.eqTapIn=ctx.createGain(); C.eqTapIn.gain.value=1; C.input.connect(C.eqTapIn); C.eqTapIn.connect(C.eqAn);
  C.eqOut.connect(C.eqAn);
  C.setEqTap=function(eqOn){ C.setP(C.eqTapIn.gain, eqOn?0:1); };
  return C;
}

// The tube voicings the worklet needs (it cannot import this module in every browser).
function tubeData(){ return TUBES.map(function(t){ return { id:t.id, gain:t.gain, b0:t.b0, kp:t.kp, kn:t.kn, h:t.h, hp:t.hp, kind:t.kind }; }); }

export { TUBES, TUBE_BY, CABS, CAB_BY, ROOMS, ROOM_BY, tubeCurve, curveAt, harmonics, makeChain, makeSynthChain,
         compMakeupDb, dB2lin, clampN, hashStr, mulberry32, ppMakeup, tubeData, makeEnsemble, ENS_MODES,
         ISO, EQ_N, EQ_PRESETS, EQ_PRESET_BY, eqCentres, eqResponse, eqFit, eqTarget, eqResample, addEqTap };
