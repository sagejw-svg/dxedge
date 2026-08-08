import * as C from '../public/morse/core.js'
let pass=0, fail=0
const ok=(n,c,extra='')=>{ if(c){pass++} else {fail++; console.log('  FAIL:',n,extra)} }

// timing
ok('dit at 12wpm = 100ms', Math.abs(C.ditSeconds(12)*1000-100)<0.01)
ok('dit at 20wpm = 60ms', Math.abs(C.ditSeconds(20)*1000-60)<0.01)
const g=C.farnsworthGaps(12,5)
ok('farns char gap 12/5 ~1405ms', Math.abs(g.charGapMs-1405)<2)
ok('farns word gap > char gap', g.wordGapMs>g.charGapMs)
const g2=C.farnsworthGaps(20,20)
ok('no farnsworth when eff==char: gap==3 dits', Math.abs(g2.charGapMs-3*60)<0.5)
ok('eff clamped above char', C.farnsworthGaps(12,30).charGapMs===C.farnsworthGaps(12,12).charGapMs)
ok('codeMs E@12 =100', Math.abs(C.codeMs('.',12)-100)<0.01)
ok('codeMs O@12 =1100', Math.abs(C.codeMs('---',12)-1100)<0.01)

// morse table integrity
const codes=Object.entries(C.MORSE)
ok('all codes are dot/dash only', codes.every(([k,v])=>/^[.-]+$/.test(v)))
ok('26 letters present', C.LETTERS.every(c=>C.MORSE[c]))
ok('10 digits present', C.DIGITS.every(c=>C.MORSE[c]))
ok('prosigns present', C.PROSIGNS.every(c=>C.MORSE[c]))
// ambiguity check within the full drill pool
const pool=C.POOLS.full, seen={}
let dupe=null
for(const c of pool){ const v=C.MORSE[c]; if(seen[v]) dupe=[seen[v],c]; seen[v]=c }
ok('no two full-pool chars share a code', !dupe, dupe?dupe.join('/'):'')

// tokenize
ok('tokenize basic', JSON.stringify(C.tokenize('CQ DE K6WRJ'))===JSON.stringify(['C','Q',' ','D','E',' ','K','6','W','R','J']))
ok('tokenize prosign key +', C.tokenize('AB+').includes('AR'))
ok('tokenize = to BT', C.tokenize('A=B').includes('BT'))
ok('tokenize drops unknown', C.tokenize('A@B').join('')==='AB')

// koch
ok('koch order has 39', C.KOCH_ORDER.length===39)
ok('koch 2 gives K,M', JSON.stringify(C.activePool('letters',2))===JSON.stringify(['K','M']))
ok('koch 0 gives full pool', C.activePool('letters',0).length===26)
ok('koch never returns <2', C.activePool('letters',1).length>=2)

// weighting
const now=Date.now()
ok('unseen weight high', C.weightFor(null,now)===4)
const solid={seen:20,correct:20,recentMiss:0,lastSeen:now,rtMs:500}
const weak={seen:20,correct:8,recentMiss:3,lastSeen:now,rtMs:2000}
ok('weak > solid', C.weightFor(weak,now)>C.weightFor(solid,now))
ok('solid never zero', C.weightFor(solid,now)>=0.12)

// applyResult
let s=C.blankStat()
s=C.applyResult(s,false,0); s=C.applyResult(s,false,0)
ok('recentMiss climbs', s.recentMiss===2)
s=C.applyResult(s,true,900)
ok('recentMiss decays on correct', s.recentMiss===1)
ok('rt recorded', s.rtMs===900)
for(let i=0;i<10;i++) s=C.applyResult(s,false,0)
ok('recentMiss capped at 4', s.recentMiss===4)

// alignment scoring
const a1=C.alignCopy('CQ DE K6WRJ','CQ DE K6WRJ')
ok('perfect copy = 100%', a1.accuracy===1)
const a2=C.alignCopy('ABCDE','ABDE')   // dropped C
ok('one drop scores 4/5 not 1/5', a2.hits===4 && a2.total===5)
ok('drop flagged as miss', a2.ops.some(o=>o.op==='miss'&&o.sent==='C'))
const a3=C.alignCopy('ABCDE','ABXDE')
ok('substitution detected', a3.ops.some(o=>o.op==='sub'&&o.sent==='C'&&o.typed==='X'))
const a4=C.alignCopy('ABCDE','ABCXDE')
ok('extra char detected', a4.ops.some(o=>o.op==='extra'&&o.typed==='X') && a4.hits===5)
ok('case + whitespace normalized', C.alignCopy('cq   de','CQ DE').accuracy===1)
ok('empty typed = 0%', C.alignCopy('ABC','').accuracy===0)

// generators produce only sendable characters
const sendable=new Set([...Object.keys(C.MORSE),' '])
const checkText=(label,t)=>{
  const bad=[...t.toUpperCase()].filter(ch=>!sendable.has(ch)&&!Object.values(C.PROSIGN_KEYS).includes(ch))
  ok(label+' fully sendable', bad.length===0, [...new Set(bad)].join(''))
}
for(let i=0;i<200;i++){
  checkText('callsigns',C.randomCallsigns(8))
  checkText('groups',C.randomGroups())
  checkText('words',C.randomWords())
  checkText('qso',C.randomQSO())
}
ok('callsign looks like a callsign', /^[A-Z]{1,2}[0-9][A-Z]{1,3}$/.test(C.randomCallsign()))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail?1:0)
