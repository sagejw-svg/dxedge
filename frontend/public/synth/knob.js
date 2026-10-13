// Filament rotary knob: drag up/down (shift = fine), arrows, wheel, double-click resets.
// COPIED from /otr/index.html at commit f9f5d2b (lines 2652, 3049-3090), per the Filament
// design brief, decision 5: the synth carries its own copy of the /otr tube code
// instead of sharing it through /lib/. The copied block is verbatim; anything the
// synth adds is below the "Filament additions" line. If the two ever need to be
// merged into /lib/, diff the copied block against /otr at that commit first.

// ---- copied block starts ----
  function clampN(v,a,b){ return Math.max(a, Math.min(b, v)); }
  // ---- rotary knob: drag up/down (shift = fine), arrow keys, double-click resets ----
  function arcPath(cx,cy,r,a0,a1){
    var p=function(a){ var rad=(a-90)*Math.PI/180; return [cx+r*Math.cos(rad), cy+r*Math.sin(rad)]; };
    var s=p(a0), e=p(a1), big=Math.abs(a1-a0)>180?1:0, sw=a1>a0?1:0;
    return 'M'+s[0].toFixed(2)+' '+s[1].toFixed(2)+' A'+r+' '+r+' 0 '+big+' '+sw+' '+e[0].toFixed(2)+' '+e[1].toFixed(2);
  }
  function makeKnob(host, o){
    var el=document.createElement('div'); el.className='knob'; el.tabIndex=0; el.setAttribute('role','slider');
    el.setAttribute('aria-label',o.label); el.setAttribute('aria-valuemin',o.min); el.setAttribute('aria-valuemax',o.max);
    el.title=o.title||o.label;
    el.innerHTML='<svg viewBox="0 0 46 46" aria-hidden="true"><circle cx="23" cy="23" r="15.5" fill="#161616" stroke="#2e2e2e"/>'+
      '<path class="trk" fill="none" stroke="#262626" stroke-width="3.2" stroke-linecap="round"/>'+
      '<path class="val" fill="none" stroke="#ffb347" stroke-width="3.2" stroke-linecap="round"/>'+
      '<line class="ptr" x1="23" y1="23" x2="23" y2="11.5" stroke="#ffd08a" stroke-width="2.2" stroke-linecap="round"/></svg>'+
      '<span class="kv"></span><span class="kl">'+o.label+'</span>';
    host.appendChild(el);
    var trk=el.querySelector('.trk'), val=el.querySelector('.val'), ptr=el.querySelector('.ptr'), kv=el.querySelector('.kv');
    trk.setAttribute('d', arcPath(23,23,19.5,-135,135));
    var v=o.value, bip=o.min<0;
    function ang(x){ return -135+270*(x-o.min)/(o.max-o.min); }
    function render(){
      var a=ang(v), a0=bip?ang(0):-135;
      val.setAttribute('d', Math.abs(a-a0)<0.5 ? '' : arcPath(23,23,19.5,Math.min(a0,a),Math.max(a0,a)));
      ptr.setAttribute('transform','rotate('+a.toFixed(1)+' 23 23)');
      kv.textContent=o.fmt(v); el.setAttribute('aria-valuenow',v); el.setAttribute('aria-valuetext',o.fmt(v));
    }
    function set(nv, fire){ nv=Math.round(clampN(nv,o.min,o.max)/o.step)*o.step; nv=+nv.toFixed(3); if(nv===v && fire) return; v=nv; render(); if(fire) o.onChange(v); }
    var drag=null;
    el.addEventListener('pointerdown', function(e){ e.preventDefault(); el.focus(); el.setPointerCapture(e.pointerId); drag={y:e.clientY, v:v}; });
    el.addEventListener('pointermove', function(e){ if(!drag) return; var span=o.max-o.min, k=e.shiftKey?0.25:1; set(drag.v+(drag.y-e.clientY)/150*span*k, true); });
    el.addEventListener('pointerup', function(){ drag=null; }); el.addEventListener('pointercancel', function(){ drag=null; });
    el.addEventListener('dblclick', function(){ set(o.def, true); });
    el.addEventListener('wheel', function(e){ if(document.activeElement!==el) return; e.preventDefault(); set(v-(e.deltaY>0?1:-1)*o.step*(e.shiftKey?1:2), true); }, {passive:false});
    el.addEventListener('keydown', function(e){
      var st=o.step*(e.shiftKey?5:1), m={ArrowUp:st,ArrowRight:st,ArrowDown:-st,ArrowLeft:-st,PageUp:st*5,PageDown:-st*5}[e.key];
      if(m!==undefined){ e.preventDefault(); e.stopPropagation(); set(v+m,true); }
      else if(e.key==='Home'){ e.preventDefault(); set(o.min,true); } else if(e.key==='End'){ e.preventDefault(); set(o.max,true); }
      else if(e.key===' '){ e.stopPropagation(); }
    });
    render();
    return { el:el, set:function(nv){ set(nv,false); }, get:function(){ return v; } };
  }
// ---- copied block ends ----

// ---- Filament additions (not in /otr) ----
export { makeKnob, clampN };
