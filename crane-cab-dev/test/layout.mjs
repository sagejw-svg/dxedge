// Console layout sweep. Every gauge value and label must fit its column, and
// the lamp row must be on screen, at every size and in both unit systems.
//
//   cd crane-cab-dev && python3 -m http.server 8080 &
//   node test/layout.mjs
//
// PAGE overrides the URL, CHROME the executable.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless:true, args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
let bad = 0;
const SIZES = [[900,900],[1024,900],[1152,900],[1280,900],[1366,900],[1440,900],
  [1680,1050],[1920,1080],[844,390],[926,428],[390,844]];
for (const [w, h] of SIZES) {
  const p = await b.newPage({ viewport:{ width:w, height:h } });
  await p.goto(process.env.PAGE || 'http://127.0.0.1:8080/index.html?debug',{waitUntil:'load'});
  await p.waitForFunction(()=>!!window.__cab,null,{timeout:15000});
  await p.click('#btn-start');
  // realistic mid-lift values, imperial and metric
  for (const units of ['imperial','metric']) {
    await p.evaluate((u)=>{ const s=window.__cab.state; s.settings.units=u;
      s.load.attached=true; s.load.mass=1800; s.load.size=[2.4,1.2,1.2];
      s.crane.radius=30.6; s.crane.line=38; }, units);
    await new Promise(r=>setTimeout(r,500));
    const r = await p.evaluate(()=>{
      const out=[];
      document.querySelectorAll('.gauge').forEach(g=>{
        const v=g.querySelector('.value'), l=g.querySelector('.label');
        if (v && v.scrollWidth > v.clientWidth+1) out.push(`VALUE ${v.id}="${v.textContent}"`);
        if (l && l.scrollWidth > l.clientWidth+1) out.push(`LABEL ${l.id||l.textContent}`);
      });
      return out;
    });
    const lamps = await p.evaluate(() => {
      const el = document.querySelector('.lamps').getBoundingClientRect();
      return el.bottom <= window.innerHeight + 1;
    });
    if (r.length || !lamps) { bad++; console.log(`FAIL ${w}x${h} ${units}: ${r.join(', ') || ''}${lamps ? '' : ' LAMPS OFF SCREEN'}`); }
    else console.log(`ok   ${w}x${h} ${units}`);
  }
  await p.close();
}
await b.close();
console.log(bad ? `\n${bad} layouts broken` : '\nno clipping and lamps on screen at every size, both unit systems');
process.exit(bad?1:0);
