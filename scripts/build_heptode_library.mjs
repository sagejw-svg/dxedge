// Sequences Heptode's song folder. Every file is written here.
// The showpieces are public-domain compositions in an original reduction.
// Glass Arcade is an original tune. The density file is generated.
// Nothing here is copied from another MIDI file.
//
// Run: node scripts/build_heptode_library.mjs
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Midi } from '../frontend/public/synth/vendor/tonejs-midi.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'public', 'synth', 'heptode', 'midi');
const PPQ = 480;

function n(name) {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(name);
  if (!m) throw new Error('bad note ' + name);
  const pc = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1].toLowerCase()];
  const semi = pc + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return (Number(m[3]) + 1) * 12 + semi;
}
function add(track, midi, beat, dur, vel) {
  track.addNote({
    midi, ticks: Math.round(beat * PPQ),
    durationTicks: Math.max(1, Math.round(dur * 0.92 * PPQ)),
    velocity: vel,
  });
}
function play(track, start, items, vel) {
  let b = start;
  for (const it of items) {
    if (it[0] != null) add(track, typeof it[0] === 'number' ? it[0] : n(it[0]), b, it[1], vel);
    b += it[1];
  }
  return b;
}
function chord(track, names, beat, dur, vel) {
  names.forEach(name => add(track, n(name), beat, dur, vel));
}
function track(midi, name, channel, program) {
  const tr = midi.addTrack();
  tr.name = name;
  tr.channel = channel;
  if (program != null) tr.instrument.number = program;
  return tr;
}
function song({ title, bpm, sig, notice, tempos, build }) {
  const midi = new Midi();
  midi.name = title;
  midi.header.tempos = tempos || [{ ticks: 0, bpm }];
  midi.header.timeSignatures = [{ ticks: 0, timeSignature: sig || [4, 4] }];
  midi.header.meta.push({ text: notice, type: 'copyrightNotice', ticks: 0 });
  midi.header.update();
  build(midi);
  return Buffer.from(midi.toArray());
}

const PD = 'CC0 1.0. MIDI sequence written for DX Edge, 14 Oct 2026. The composition is public domain. This arrangement was not copied from another MIDI file.';
const ORIG = 'CC0 1.0. Original composition and MIDI sequence by DX Edge, 14 Oct 2026.';

function bumblebee(midi) {
  const lead = track(midi, 'Flight', 0, 0);
  const bass = track(midi, 'Motor', 1, 32);
  lead.addCC({ number: 10, ticks: 0, value: 0.62 });
  lead.addCC({ number: 11, ticks: 0, value: 0.9 });
  bass.addCC({ number: 10, ticks: 0, value: 0.28 });
  bass.addCC({ number: 7, ticks: 0, value: 0.8 });
  // Chromatic semiquavers in A minor: an original reduction of the 1900 scherzo.
  const run = [];
  for (let bar = 0; bar < 16; bar++) {
    const dir = bar % 2 === 0 ? 1 : -1;
    let pitch = dir > 0 ? 69 : 69 + 15;
    for (let s = 0; s < 16; s++) {
      run.push([pitch, 0.25]);
      pitch += dir;
    }
  }
  play(lead, 0, run, 0.72);
  for (let bar = 0; bar < 16; bar++) {
    add(bass, n(bar % 2 ? 'E2' : 'A2'), bar * 4, 1, 0.7);
    add(bass, n(bar % 2 ? 'E3' : 'A2'), bar * 4 + 2, 1, 0.55);
  }
  lead.addPitchBend({ ticks: 8 * PPQ, value: 0.15 });
  lead.addPitchBend({ ticks: 8 * PPQ + 240, value: 0 });
}

function campanella(midi) {
  const bell = track(midi, 'Bells', 0, 14);
  const tune = track(midi, 'Theme', 1, 0);
  const bass = track(midi, 'Bass', 2, 32);
  bell.addCC({ number: 10, ticks: 0, value: 0.78 });
  tune.addCC({ number: 10, ticks: 0, value: 0.42 });
  bass.addCC({ number: 10, ticks: 0, value: 0.2 });
  // Repeated D#6, the bell of the 1851 etude, over a short G# minor line.
  for (let bar = 0; bar < 8; bar++) {
    for (let s = 0; s < 8; s++) add(bell, n('D#6'), bar * 4 + s * 0.5, 0.22, s % 2 ? 0.35 : 0.62);
    add(bass, n('G#2'), bar * 4, 2, 0.7);
    add(bass, n('D#3'), bar * 4 + 2, 2, 0.55);
  }
  play(tune, 0, [
    ['G#4', 1], ['B4', 1], ['C#5', 1], ['D#5', 1],
    ['F#5', 1], ['E5', 1], ['D#5', 2],
    ['B4', 1], ['C#5', 1], ['D#5', 1], ['B4', 1],
    ['G#4', 4],
  ], 0.66);
}

function fugue(midi) {
  // Little Fugue in G minor, BWV 578. Subject, answer, and a third entry.
  const subject = [
    ['G4', 1], ['D5', 1], ['Bb4', 0.5], ['A4', 0.5], ['G4', 1],
    ['A4', 0.5], ['Bb4', 0.5], ['A4', 0.5], ['G4', 1.5],
    ['D4', 0.5], ['Eb4', 0.5], ['D4', 0.5], ['C4', 0.5], ['Bb3', 0.5], ['A3', 0.5], ['G3', 2],
  ];
  const answer = [
    ['D4', 1], ['A4', 1], ['F4', 0.5], ['E4', 0.5], ['D4', 1],
    ['E4', 0.5], ['F4', 0.5], ['E4', 0.5], ['D4', 1.5],
    ['A3', 0.5], ['Bb3', 0.5], ['A3', 0.5], ['G3', 0.5], ['F3', 0.5], ['E3', 0.5], ['D3', 2],
  ];
  const low = [
    ['G3', 1], ['D4', 1], ['Bb3', 0.5], ['A3', 0.5], ['G3', 1],
    ['A3', 0.5], ['Bb3', 0.5], ['A3', 0.5], ['G3', 1.5],
    ['D3', 0.5], ['Eb3', 0.5], ['D3', 0.5], ['C3', 0.5], ['Bb2', 0.5], ['A2', 0.5], ['G2', 2],
  ];
  const a = track(midi, 'Subject', 0, 19);
  const b = track(midi, 'Answer', 1, 19);
  const c = track(midi, 'Bass entry', 2, 19);
  a.addCC({ number: 10, ticks: 0, value: 0.35 });
  b.addCC({ number: 10, ticks: 0, value: 0.65 });
  c.addCC({ number: 10, ticks: 0, value: 0.5 });
  play(a, 0, subject, 0.75);
  play(b, 8, answer, 0.7);
  play(c, 16, low, 0.72);
  // The first voice holds a counterline under the answer.
  play(a, 8, [
    ['Bb4', 2], ['A4', 2], ['G4', 2], ['F4', 2],
  ], 0.4);
}

function valkyries(midi) {
  const horn = track(midi, 'Call', 0, 60);
  const low = track(midi, 'Pulse', 1, 58);
  const high = track(midi, 'Answer', 2, 60);
  horn.addCC({ number: 10, ticks: 0, value: 0.3 });
  low.addCC({ number: 10, ticks: 0, value: 0.5 });
  high.addCC({ number: 10, ticks: 0, value: 0.72 });
  // 9/8 dotted-quarter rising call. An eighth is half a quarter-beat.
  const figure = [
    ['B3', 1.5], ['D4', 1.5], ['F#4', 1.5],
    ['B3', 1.5], ['D4', 1.5], ['F#4', 1.5],
    ['B3', 1.5], ['D4', 1.5], ['B4', 1.5],
  ];
  for (let i = 0; i < 4; i++) play(horn, i * 13.5, figure, 0.78);
  for (let i = 0; i < 4; i++) play(high, 13.5 + i * 13.5, [
    ['F#4', 1.5], ['A4', 1.5], ['C#5', 1.5],
    ['F#4', 1.5], ['A4', 1.5], ['C#5', 1.5],
    ['F#4', 1.5], ['A4', 1.5], ['F#5', 1.5],
  ], 0.62);
  for (let bar = 0; bar < 16; bar++) add(low, n('B2'), bar * 4.5, 1.5, 0.6);
}

function rhapsody(midi) {
  const tune = track(midi, 'Lassan', 0, 0);
  const left = track(midi, 'Stride', 1, 0);
  tune.addCC({ number: 10, ticks: 0, value: 0.58 });
  left.addCC({ number: 10, ticks: 0, value: 0.4 });
  tune.addCC({ number: 11, ticks: 0, value: 0.7 });
  // Slow C# minor opening, then a faster friska. The tempo map carries the change.
  play(tune, 0, [
    ['G#4', 1], ['B4', 0.5], ['C#5', 1.5], ['E5', 1],
    ['D#5', 1], ['C#5', 1], ['B4', 2],
    ['A4', 1], ['G#4', 1], ['F#4', 1], ['E4', 1],
    ['D#4', 2], ['C#4', 2],
  ], 0.7);
  chord(left, ['C#3', 'G#3'], 0, 4, 0.45);
  chord(left, ['F#2', 'C#3'], 4, 4, 0.45);
  chord(left, ['G#2', 'D#3'], 8, 4, 0.45);
  chord(left, ['C#2', 'G#2'], 12, 4, 0.5);
  const frisk = [];
  const scale = [61, 63, 64, 66, 68, 69, 71, 73];
  for (let bar = 0; bar < 8; bar++) {
    for (let s = 0; s < 8; s++) frisk.push([scale[(bar + s) % scale.length], 0.5]);
  }
  play(tune, 16, frisk, 0.74);
  for (let bar = 0; bar < 8; bar++) add(left, n(bar % 2 ? 'G#2' : 'C#2'), 16 + bar * 4, 1, 0.65);
}

function arcade(midi) {
  // Original multitrack in D major. A straight pop hook, not a film theme.
  const lead = track(midi, 'Lead', 0, 81);
  const bass = track(midi, 'Bass', 1, 38);
  const stab = track(midi, 'Chords', 2, 52);
  const arp = track(midi, 'Arp', 3, 11);
  const pad = track(midi, 'Pad', 4, 88);
  const kit = track(midi, 'Kit', 9, 0);
  lead.addCC({ number: 10, ticks: 0, value: 0.7 });
  bass.addCC({ number: 10, ticks: 0, value: 0.5 });
  stab.addCC({ number: 10, ticks: 0, value: 0.32 });
  arp.addCC({ number: 10, ticks: 0, value: 0.84 });
  pad.addCC({ number: 10, ticks: 0, value: 0.18 });
  kit.addCC({ number: 10, ticks: 0, value: 0.5 });
  const hook = [
    ['D5', 1], ['F#5', 1], ['A5', 1], ['F#5', 1],
    ['G5', 1], ['F#5', 1], ['E5', 1], ['D5', 1],
  ];
  for (let i = 0; i < 4; i++) play(lead, i * 8, hook, 0.8);
  for (let bar = 0; bar < 16; bar++) {
    const root = [n('D2'), n('G2'), n('A2'), n('D2')][bar % 4];
    const fifth = root + 7;
    for (let s = 0; s < 4; s++) add(bass, s % 2 ? fifth : root, bar * 2 + s * 0.5, 0.45, 0.75);
  }
  const chords = [
    ['D4', 'F#4', 'A4'],
    ['G3', 'B3', 'D4'],
    ['A3', 'C#4', 'E4'],
    ['D4', 'F#4', 'A4'],
  ];
  for (let bar = 0; bar < 8; bar++) chord(stab, chords[bar % 4], bar * 4, 1.6, 0.55);
  const arpNotes = [n('D4'), n('F#4'), n('A4'), n('F#4')];
  for (let bar = 0; bar < 16; bar++) {
    for (let s = 0; s < 8; s++) add(arp, arpNotes[s % 4] + (bar % 4 === 2 ? 2 : 0), bar * 2 + s * 0.25, 0.22, 0.45);
  }
  for (let bar = 0; bar < 4; bar++) chord(pad, ['D3', 'A3', 'F#4'], bar * 8, 7.5, 0.4);
  for (let bar = 0; bar < 16; bar++) {
    add(kit, 36, bar * 2, 0.2, 0.9);
    add(kit, 38, bar * 2 + 1, 0.2, 0.7);
    for (let s = 0; s < 4; s++) add(kit, 42, bar * 2 + s * 0.5, 0.1, 0.35);
  }
}

function vlq(out, v) {
  v = Math.max(0, v | 0);
  const tmp = [v & 0x7f];
  v >>= 7;
  while (v > 0) { tmp.push((v & 0x7f) | 0x80); v >>= 7; }
  for (let i = tmp.length - 1; i >= 0; i--) out.push(tmp[i]);
}
function chunk(out, body) {
  const n = body.length;
  out.push(0x4d, 0x54, 0x72, 0x6b, (n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
  for (let i = 0; i < n; i++) out.push(body[i]);
}

// Sixteen channels, a note on every tick for eight seconds at 120 BPM.
// 7680 ticks × 16 = 122880 notes, plus bend, volume and a tempo change.
function blackDensity() {
  const ppq = 480;
  const ticks = 8 * ppq * 2; // 8 seconds at 120 BPM is 16 quarter notes
  const out = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 17, ppq >> 8, ppq & 255];
  const tempo = [];
  const notice = 'CC0 1.0. Generated density test by DX Edge, 14 Oct 2026.';
  tempo.push(0, 0xff, 0x03, 8, 0x44, 0x65, 0x6e, 0x73, 0x69, 0x74, 0x79, 0x00);
  // The name above included a trailing 0 by mistake in the length. Rewrite cleanly.
  tempo.length = 0;
  tempo.push(0, 0xff, 0x02);
  vlq(tempo, notice.length);
  for (let i = 0; i < notice.length; i++) tempo.push(notice.charCodeAt(i));
  tempo.push(0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20);
  vlq(tempo, 4 * ppq);
  tempo.push(0xff, 0x51, 3, 0x0a, 0x2c, 0x2a); // 90 BPM, 666666 us
  tempo.push(0, 0xff, 0x2f, 0);
  chunk(out, tempo);
  for (let ch = 0; ch < 16; ch++) {
    const body = [0, 0xff, 0x03, 1, 65 + ch];
    const status = 0x90 | ch;
    const off = 0x80 | ch;
    body.push(0, 0xc0 | ch, (ch * 8) & 127);
    body.push(0, 0xb0 | ch, 7, 100);
    body.push(0, 0xb0 | ch, 10, (ch * 8) & 127);
    body.push(0, 0xb0 | ch, 11, 100);
    let last = 0;
    const dur = 20;
    const span = ticks + dur;
    for (let t = 0; t < span; t++) {
      if (t < ticks && t % 480 === 0) {
        vlq(body, t - last);
        body.push(0xe0 | ch, 0x20, 0x50);
        last = t;
      }
      if (t >= dur) {
        const start = t - dur;
        const note = 36 + ((start + ch * 3) % 48);
        vlq(body, t - last);
        body.push(off, note, 0);
        last = t;
      }
      if (t < ticks) {
        const note = 36 + ((t + ch * 3) % 48);
        const vel = 40 + ((t * 5 + ch) % 70);
        vlq(body, t - last);
        body.push(status, note, vel);
        last = t;
      }
    }
    body.push(0, 0xff, 0x2f, 0);
    chunk(out, body);
  }
  return Uint8Array.from(out);
}

const files = [
  ['rimsky-korsakov-bumblebee.mid', song({ title: 'Flight of the Bumblebee', bpm: 168, notice: PD, build: bumblebee })],
  ['liszt-la-campanella.mid', song({ title: 'La Campanella', bpm: 132, notice: PD, build: campanella })],
  ['bach-fugue-gm.mid', song({ title: 'Little Fugue in G minor', bpm: 92, notice: PD, build: fugue })],
  ['wagner-ride-valkyries.mid', song({ title: 'Ride of the Valkyries', bpm: 108, sig: [9, 8], notice: PD, build: valkyries })],
  ['liszt-hungarian-rhapsody-2.mid', song({
    title: 'Hungarian Rhapsody No. 2',
    bpm: 66,
    notice: PD,
    tempos: [{ ticks: 0, bpm: 66 }, { ticks: 16 * PPQ, bpm: 144 }],
    build: rhapsody,
  })],
  ['dx-glass-arcade.mid', song({ title: 'Glass Arcade', bpm: 116, notice: ORIG, build: arcade })],
];

mkdirSync(root, { recursive: true });
const catalog = [
  { file: 'rimsky-korsakov-bumblebee.mid', title: 'Flight of the Bumblebee', composer: 'Nikolai Rimsky-Korsakov', year: 1900, status: 'Public domain composition, original reduction', note: 'Chromatic semiquavers in A minor.' },
  { file: 'liszt-la-campanella.mid', title: 'La Campanella', composer: 'Franz Liszt', year: 1851, status: 'Public domain composition, original reduction', note: 'Repeated high bells over a short G-sharp minor line.' },
  { file: 'bach-fugue-gm.mid', title: 'Little Fugue in G minor', composer: 'Johann Sebastian Bach', year: 1707, status: 'Public domain composition, original voicing', note: 'Subject, answer, and a third entry.' },
  { file: 'wagner-ride-valkyries.mid', title: 'Ride of the Valkyries', composer: 'Richard Wagner', year: 1856, status: 'Public domain composition, original reduction', note: 'The rising call in 9/8.' },
  { file: 'liszt-hungarian-rhapsody-2.mid', title: 'Hungarian Rhapsody No. 2', composer: 'Franz Liszt', year: 1847, status: 'Public domain composition, original excerpt', note: 'A slow opening, then a faster section. The file changes tempo.' },
  { file: 'dx-glass-arcade.mid', title: 'Glass Arcade', composer: 'DX Edge', year: 2026, status: 'Original', note: 'An original 1980s-style multitrack in D major.' },
  { file: 'black-density.mid', title: 'Density', composer: 'DX Edge', year: 2026, status: 'Generated', note: 'A generated stress file: sixteen channels and more than one hundred thousand notes.' },
];
for (const [name, bytes] of files) writeFileSync(join(root, name), bytes);
writeFileSync(join(root, 'black-density.mid'), blackDensity());
writeFileSync(join(root, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
console.log('wrote', catalog.length, 'entries to', root);
