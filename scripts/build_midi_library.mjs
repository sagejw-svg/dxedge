// Builds the bundled MIDI library. Every file is sequenced here.
// Public-domain compositions get an original reduction. The three demo tunes
// are original. Nothing in this folder is copied from another MIDI file.
//
// Run: node scripts/build_midi_library.mjs
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Midi } from '../frontend/public/synth/vendor/tonejs-midi.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'public', 'synth', 'midi');
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
    durationTicks: Math.max(1, Math.round(dur * 0.9 * PPQ)),
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
function track(midi, name, channel) {
  const tr = midi.addTrack();
  tr.name = name;
  tr.channel = channel;
  return tr;
}
// One bass note per step, root on the first step of each bar, fifth on the rest.
function bass(tr, root, fifth, bars, barBeats, step, vel, bar0 = 0) {
  for (let i = 0; i < bars; i++) {
    for (let s = 0; s < barBeats; s += step) {
      const pitch = s === 0 ? root : fifth;
      add(tr, n(pitch), (bar0 + i) * barBeats + s, step, s === 0 ? vel : vel * 0.85);
    }
  }
}
function hats(midi, bars, barBeats) {
  const tr = track(midi, 'Clicks', 9);
  for (let i = 0; i < bars; i++) add(tr, 42, i * barBeats + barBeats / 2, 0.2, 0.35);
  return tr;
}
function song({ title, bpm, sig, notice, parts, hatsBars, barBeats }) {
  const midi = new Midi();
  midi.name = title;
  midi.header.tempos = [{ ticks: 0, bpm }];
  midi.header.timeSignatures = [{ ticks: 0, timeSignature: sig }];
  midi.header.meta.push({ text: notice, type: 'copyrightNotice', ticks: 0 });
  midi.header.update();
  parts(midi);
  if (hatsBars) hats(midi, hatsBars, barBeats);
  return Buffer.from(midi.toArray());
}

const PD = 'CC0 1.0. MIDI sequence written for DX Edge, 14 Oct 2026. The composition is public domain. This arrangement was not copied from another MIDI file.';
const ORIG = 'CC0 1.0. Original composition and MIDI sequence by DX Edge, 14 Oct 2026.';

function beethoven(midi) {
  const mel = track(midi, 'Melody', 0);
  const low = track(midi, 'Bass', 1);
  const harm = track(midi, 'Harmony', 2);
  // Opening of Symphony No. 5, mvt 1: the four-note motive, twice, then a short sequence.
  play(mel, 0, [
    ['G4', 0.5], ['G4', 0.5], ['G4', 0.5], ['Eb4', 2.5], [null, 1],
    ['F4', 0.5], ['F4', 0.5], ['F4', 0.5], ['D4', 2.5], [null, 1],
    ['Eb4', 0.5], ['Eb4', 0.5], ['Eb4', 0.5], ['C4', 1.5],
    ['D4', 0.5], ['D4', 0.5], ['D4', 0.5], ['B3', 1.5],
    ['C4', 0.5], ['C4', 0.5], ['C4', 0.5], ['Ab3', 1.5],
    ['G4', 0.5], ['G4', 0.5], ['G4', 0.5], ['Eb4', 1],
    ['F4', 0.5], ['F4', 0.5], ['F4', 0.5], ['D4', 1],
    ['G4', 0.5], ['G4', 0.5], ['G4', 0.5], ['Eb4', 0.5], ['C5', 2],
  ], 0.9);
  // Bass enters on the long notes of each statement.
  play(low, 1.5, [['C2', 2.5], [null, 1], ['G1', 0.5], ['G1', 0.5], ['G1', 0.5], ['G2', 2.5], [null, 1]], 0.8);
  play(low, 12, [
    ['Ab1', 2], ['G1', 2], ['F1', 2],
    ['C2', 1.5], ['G1', 1.5], ['C2', 2.5],
  ], 0.8);
  chord(harm, ['Eb4', 'G4'], 1.5, 2.2, 0.45);
  chord(harm, ['D4', 'F4'], 6.5, 2.2, 0.45);
  chord(harm, ['C4', 'Eb4'], 12, 1.4, 0.4);
  chord(harm, ['B3', 'D4'], 14, 1.4, 0.4);
  chord(harm, ['C4', 'Eb4', 'G4'], 22, 2, 0.5);
}
function bach(midi) {
  const mel = track(midi, 'Melody', 0);
  const ped = track(midi, 'Bass', 1);
  const harm = track(midi, 'Harmony', 2);
  // Toccata opening: mordent on A, a diminished flourish, a D minor chord.
  play(mel, 0, [
    ['A4', 1.5], ['G4', 0.25], ['A4', 1.25],
  ], 0.88);
  const run = ['A4', 'G4', 'A4', 'C5', 'D5', 'Eb5', 'G5', 'A5', 'C6', 'D6', 'Eb6', 'D6', 'C6', 'A5', 'G5', 'Eb5', 'D5', 'C5', 'A4', 'G4', 'F4', 'Eb4', 'D4', 'C#4', 'D4'];
  play(mel, 3, run.map(p => [p, 0.25]), 0.8);
  play(mel, 3 + run.length * 0.25, [['D4', 0.5], ['A4', 0.5], ['D5', 2]], 0.9);
  play(ped, 0, [['A1', 3], ['A1', 2], ['D2', 3]], 0.85);
  chord(harm, ['A3', 'E4'], 0, 2.5, 0.4);
  chord(harm, ['D3', 'A3', 'F4'], 3 + run.length * 0.25, 2.5, 0.5);
}
function maple(midi) {
  const mel = track(midi, 'Melody', 0);
  const low = track(midi, 'Bass', 1);
  const harm = track(midi, 'Harmony', 2);
  // Maple Leaf Rag, A strain, in Ab. Short stride reduction.
  const phrase = [
    ['C5', 0.25], ['Eb5', 0.25], ['Ab5', 0.5], ['C6', 0.5], ['Bb5', 0.25], ['Ab5', 0.25],
    ['C6', 0.5], ['Eb6', 0.5], ['C6', 0.25], ['Bb5', 0.25], ['Ab5', 0.5],
    ['Eb5', 0.5], ['Ab5', 0.5], ['Bb5', 0.5], ['Ab5', 0.5],
    ['G5', 0.5], ['Ab5', 1.5],
  ];
  const answer = [
    ['C5', 0.25], ['Eb5', 0.25], ['Ab5', 0.5], ['C6', 0.5], ['Db6', 0.5], ['C6', 0.5],
    ['Bb5', 0.5], ['Ab5', 0.5], ['G5', 0.5], ['Ab5', 0.5],
    ['Eb5', 0.5], ['F5', 0.5], ['G5', 0.5], ['Ab5', 1.5],
  ];
  let b = 0;
  b = play(mel, b, phrase, 0.86);
  b = play(mel, b, answer, 0.86);
  b = play(mel, b, phrase, 0.9);
  play(mel, b, [['Eb6', 0.5], ['C6', 0.5], ['Bb5', 0.5], ['Ab5', 2]], 0.9);
  bass(low, 'Ab1', 'Eb2', 16, 2, 1, 0.75);
  for (let i = 0; i < 16; i++) {
    const names = i % 4 === 3 ? ['G3', 'Bb3', 'Db4'] : (i % 2 ? ['Eb3', 'G3', 'Bb3'] : ['Ab3', 'C4', 'Eb4']);
    chord(harm, names, i * 2 + 1, 0.7, 0.4);
  }
}
function entertainer(midi) {
  const mel = track(midi, 'Melody', 0);
  const low = track(midi, 'Bass', 1);
  const harm = track(midi, 'Harmony', 2);
  // The Entertainer, the famous strain, in C.
  const theme = [
    ['D5', 0.5], ['E5', 0.5], ['C5', 0.5], ['A4', 0.5],
    ['C5', 1], ['E5', 1],
    ['G5', 0.5], ['E5', 0.5], ['C5', 1],
    ['D5', 0.5], ['C5', 0.5], ['A4', 1],
    ['C5', 0.5], ['D5', 0.5], ['E5', 0.5], ['C5', 0.5],
    ['A4', 1], ['G4', 1],
    ['C5', 2],
  ];
  let b = play(mel, 0, theme, 0.88);
  b = play(mel, b, [
    ['E5', 0.5], ['G5', 0.5], ['C6', 1], ['B5', 0.5], ['A5', 0.5],
    ['G5', 1], ['E5', 1],
    ['A5', 0.5], ['G5', 0.5], ['E5', 0.5], ['D5', 0.5],
    ['C5', 2],
  ], 0.88);
  play(mel, b, theme, 0.9);
  bass(low, 'C2', 'G2', 16, 2, 1, 0.74);
  for (let i = 0; i < 16; i++) {
    const names = i % 4 === 2 ? ['F3', 'A3', 'C4'] : (i % 2 ? ['G3', 'B3', 'D4'] : ['C4', 'E4', 'G4']);
    chord(harm, names, i * 2 + 1, 0.6, 0.38);
  }
}
function sousa(midi) {
  const mel = track(midi, 'Melody', 0);
  const low = track(midi, 'Bass', 1);
  const picc = track(midi, 'Descant', 2);
  // Stars and Stripes Forever, the trio tune, in Ab.
  const trio = [
    ['Ab4', 1.5], ['C5', 0.5], ['Bb4', 1], ['Ab4', 1],
    ['Eb5', 1.5], ['Eb5', 0.5], ['F5', 1], ['Eb5', 1],
    ['Ab5', 1], ['C6', 1], ['Bb5', 1], ['Ab5', 1],
    ['Eb5', 1.5], ['C5', 0.5], ['Bb4', 1], ['Ab4', 1],
    ['Ab4', 2], [null, 2],
  ];
  play(mel, 0, trio, 0.9);
  play(mel, 16, trio, 0.92);
  bass(low, 'Ab1', 'Eb2', 8, 4, 1, 0.78);
  // A plain descant over the repeat, written for this file, not a copied obbligato edition.
  play(picc, 16, [
    ['C6', 1], ['Eb6', 0.5], ['Ab6', 0.5], ['G6', 1], ['Eb6', 1],
    ['Ab6', 1.5], ['G6', 0.5], ['Ab6', 2],
    ['C6', 1], ['Eb6', 1], ['D6', 1], ['C6', 1],
    ['Bb5', 2], ['Ab5', 2],
  ], 0.55);
}
function greensleeves(midi) {
  const mel = track(midi, 'Melody', 0);
  const low = track(midi, 'Bass', 1);
  const harm = track(midi, 'Harmony', 2);
  // Greensleeves in E minor, 3/4.
  const a = [
    ['E4', 1], ['F#4', 0.5], ['G4', 0.5], ['A4', 2], ['B4', 0.5], ['G4', 0.5],
    ['A4', 1], ['B4', 0.5], ['C5', 0.5], ['B4', 1], ['A4', 0.5], ['G4', 0.5],
    ['E4', 3],
  ];
  const b = [
    ['G4', 1], ['A4', 0.5], ['B4', 0.5], ['C5', 1.5], ['B4', 0.5], ['A4', 1],
    ['B4', 1], ['G4', 0.5], ['E4', 0.5], ['D4', 2], ['E4', 1],
    ['E4', 1], ['F#4', 0.5], ['G4', 0.5], ['A4', 2], ['B4', 0.5], ['G4', 0.5],
    ['A4', 1], ['B4', 0.5], ['C5', 0.5], ['B4', 1], ['A4', 0.5], ['G4', 0.5],
    ['E4', 3],
  ];
  play(mel, 0, a, 0.84);
  play(mel, 12, b, 0.84);
  const roots = [['E2', 3], ['A2', 3], ['E2', 3], ['B1', 3], ['E2', 3], ['D2', 3], ['G2', 3], ['D2', 3], ['E2', 3], ['A2', 3], ['E2', 3]];
  let b0 = 0;
  roots.forEach(([p, d]) => { add(low, n(p), b0, d, 0.72); b0 += d; });
  chord(harm, ['G3', 'B3'], 0, 2.5, 0.35);
  chord(harm, ['A3', 'C4'], 3, 2.5, 0.35);
  chord(harm, ['E3', 'G3', 'B3'], 9, 2.5, 0.4);
  chord(harm, ['E3', 'G3', 'B3'], 30, 2.5, 0.4);
}
function susanna(midi) {
  const mel = track(midi, 'Melody', 0);
  const low = track(midi, 'Bass', 1);
  const harm = track(midi, 'Harmony', 2);
  // Oh! Susanna, Stephen Foster, in C.
  const verse = [
    ['C5', 1], ['E5', 1], ['G5', 1], ['G5', 1],
    ['A5', 1], ['G5', 1], ['E5', 1], ['C5', 1],
    ['D5', 1], ['E5', 1], ['F5', 1], ['A5', 1],
    ['G5', 2], [null, 2],
    ['C5', 1], ['E5', 1], ['G5', 1], ['G5', 1],
    ['A5', 1], ['G5', 1], ['E5', 1], ['C5', 1],
    ['D5', 1], ['E5', 1], ['D5', 1], ['B4', 1],
    ['C5', 4],
  ];
  play(mel, 0, verse, 0.88);
  bass(low, 'C2', 'G2', 8, 4, 1, 0.74);
  chord(harm, ['C4', 'E4', 'G4'], 0, 3, 0.35);
  chord(harm, ['F3', 'A3', 'C4'], 8, 3, 0.35);
  chord(harm, ['G3', 'B3', 'D4'], 12, 2, 0.35);
  chord(harm, ['C4', 'E4', 'G4'], 28, 3, 0.4);
}
function stlouis(midi) {
  const mel = track(midi, 'Melody', 0);
  const low = track(midi, 'Bass', 1);
  const harm = track(midi, 'Harmony', 2);
  // St. Louis Blues: a habanera bass and a short 12-bar chorus in G.
  // Habanera step: dotted quarter, eighth, quarter, quarter.
  for (let bar = 0; bar < 12; bar++) {
    const root = [0, 1, 2, 3].includes(bar % 12) || bar >= 8 ? 'G1' : (bar % 12 === 4 || bar % 12 === 5 ? 'C2' : 'D2');
    const fifth = root === 'G1' ? 'D2' : (root === 'C2' ? 'G2' : 'A2');
    add(low, n(root), bar * 4, 1.5, 0.8);
    add(low, n(root), bar * 4 + 1.5, 0.5, 0.55);
    add(low, n(fifth), bar * 4 + 2, 1, 0.7);
    add(low, n(root), bar * 4 + 3, 1, 0.65);
  }
  play(mel, 0, [
    ['D4', 1], ['D4', 0.5], ['Eb4', 0.5], ['D4', 1], ['C4', 1],
    ['Bb3', 1.5], ['C4', 0.5], ['D4', 2],
    ['F4', 1], ['Eb4', 0.5], ['D4', 0.5], ['C4', 1], ['Bb3', 1],
    ['G3', 4],
    ['D4', 1], ['F4', 1], ['G4', 1], ['Bb4', 1],
    ['A4', 1], ['G4', 1], ['F4', 1], ['D4', 1],
    ['Eb4', 1], ['D4', 0.5], ['C4', 0.5], ['Bb3', 2],
    ['D4', 1], ['C4', 1], ['Bb3', 1], ['G3', 1],
    ['G4', 4],
  ], 0.86);
  chord(harm, ['Bb3', 'D4'], 0, 3, 0.32);
  chord(harm, ['C4', 'Eb4', 'G4'], 16, 3, 0.32);
  chord(harm, ['G3', 'Bb3', 'D4'], 32, 3, 0.36);
}
function frankie(midi) {
  const mel = track(midi, 'Melody', 0);
  const low = track(midi, 'Bass', 1);
  const harm = track(midi, 'Harmony', 2);
  // Frankie and Johnny, traditional, in C.
  const line = [
    ['C4', 1], ['E4', 1], ['G4', 1], ['G4', 1],
    ['A4', 1], ['G4', 1], ['E4', 1], ['C4', 1],
    ['D4', 1], ['F4', 1], ['A4', 1], ['G4', 1],
    ['E4', 2], ['C4', 2],
  ];
  play(mel, 0, line, 0.84);
  play(mel, 16, [
    ['E4', 1], ['G4', 1], ['A4', 2],
    ['G4', 1], ['E4', 1], ['D4', 2],
    ['C4', 1], ['E4', 1], ['D4', 1], ['B3', 1],
    ['C4', 4],
  ], 0.86);
  bass(low, 'C2', 'G2', 8, 4, 1, 0.72);
  chord(harm, ['C4', 'E4'], 0, 3, 0.34);
  chord(harm, ['F3', 'A3', 'C4'], 8, 3, 0.34);
  chord(harm, ['C4', 'E4', 'G4'], 24, 3, 0.38);
}
function pixel(midi) {
  const mel = track(midi, 'Lead', 0);
  const low = track(midi, 'Bass', 1);
  const arp = track(midi, 'Arp', 2);
  // Original chiptune march. No borrowed hook.
  play(mel, 0, [
    ['E5', 0.5], ['G5', 0.5], ['C6', 1], ['B5', 0.5], ['G5', 0.5], ['E5', 0.5], ['C5', 0.5],
    ['A5', 0.5], ['C6', 0.5], ['E6', 1], ['D6', 0.5], ['B5', 0.5], ['G5', 1],
    ['F5', 0.5], ['A5', 0.5], ['C6', 0.5], ['F6', 0.5], ['E6', 0.5], ['C6', 0.5], ['A5', 1],
    ['G5', 0.5], ['B5', 0.5], ['D6', 0.5], ['F6', 0.5], ['E6', 1], ['D6', 0.5], ['C6', 0.5],
    ['G5', 0.5], ['A5', 0.5], ['C6', 1], ['E6', 0.5], ['D6', 0.5], ['C6', 0.5], ['A5', 0.5],
    ['B5', 1], ['G5', 1], ['E5', 0.5], ['D5', 0.5], ['C5', 1],
  ], 0.86);
  bass(low, 'C2', 'G2', 4, 4, 1, 0.8, 0);
  bass(low, 'F2', 'C3', 2, 4, 1, 0.8, 4);
  const arpNotes = ['C4', 'E4', 'G4', 'C5'];
  for (let i = 0; i < 48; i++) add(arp, n(arpNotes[i % 4]), i * 0.5, 0.4, 0.35);
}
function neon(midi) {
  const mel = track(midi, 'Lead', 0);
  const low = track(midi, 'Bass', 1);
  const pad = track(midi, 'Pad', 2);
  // Original synth-pop in A minor. Pad, syncopated bass, a short vocal hook.
  const chords = [
    ['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['C4', 'E4', 'G4'], ['G3', 'B3', 'D4'],
  ];
  chords.forEach((names, i) => chord(pad, names, i * 4, 3.6, 0.32));
  chords.forEach((names, i) => chord(pad, names, 16 + i * 4, 3.6, 0.32));
  play(low, 0, [
    ['A2', 1], ['C3', 0.5], ['E3', 0.5], ['A2', 1], ['G2', 1],
    ['F2', 1], ['A2', 0.5], ['C3', 0.5], ['F2', 1], ['E2', 1],
    ['C2', 1], ['E2', 0.5], ['G2', 0.5], ['C2', 1], ['B1', 1],
    ['G1', 1], ['B1', 0.5], ['D2', 0.5], ['G1', 2],
    ['A1', 1], ['C2', 0.5], ['E2', 0.5], ['A1', 1], ['G1', 1],
    ['F1', 1], ['C2', 1], ['G1', 1], ['A1', 1],
    ['A1', 1], ['E2', 1], ['A1', 1], ['G1', 1],
    ['A1', 4],
  ], 0.8);
  play(mel, 4, [
    ['E5', 1], ['C5', 0.5], ['D5', 0.5], ['E5', 1.5], [null, 0.5],
    ['A5', 1], ['G5', 1], ['E5', 2],
    ['D5', 0.5], ['E5', 0.5], ['G5', 1], ['E5', 0.5], ['D5', 0.5], ['C5', 1],
    ['B4', 2], ['A4', 2],
    ['E5', 1], ['G5', 1], ['A5', 2],
    ['G5', 1], ['E5', 1], ['D5', 1], ['C5', 1],
    ['A4', 4],
  ], 0.84);
}
function dock(midi) {
  const mel = track(midi, 'Lead', 0);
  const low = track(midi, 'Bass', 1);
  const arp = track(midi, 'Arp', 2);
  // Original 8-bar chiptune loop in D. The lead starts alone on F#5.
  play(mel, 0, [
    ['F#5', 2],
    ['A5', 0.5], ['D6', 0.5], ['A5', 0.5], ['F#5', 0.5],
    ['G5', 0.5], ['F#5', 0.5], ['E5', 1],
    ['D5', 0.5], ['F#5', 0.5], ['A5', 1],
    ['B5', 0.5], ['A5', 0.5], ['F#5', 0.5], ['D5', 0.5],
    ['E5', 0.5], ['F#5', 0.5], ['G5', 0.5], ['A5', 0.5],
    ['B5', 1], ['A5', 0.5], ['G5', 0.5],
    ['F#5', 2],
  ], 0.88);
  play(low, 2, [
    ['D2', 1], ['A2', 1], ['D2', 1], ['A2', 1],
    ['G2', 1], ['D2', 1], ['A1', 1], ['D2', 1],
    ['G1', 1], ['A1', 1], ['D2', 2],
  ], 0.78);
  const arpNotes = ['D4', 'F#4', 'A4', 'D5'];
  for (let i = 0; i < 28; i++) add(arp, n(arpNotes[i % 4]), 2 + i * 0.5, 0.4, 0.34);
}

function bachSpooky(midi) {
  const mel = track(midi, 'Melody', 0);
  const ped = track(midi, 'Pedal', 1);
  // A slow organ reduction of the D minor toccata: pedal, a held A, a mordent, a rolled chord.
  play(ped, 0, [['D2', 4], ['A1', 4], ['D2', 4]], 0.8);
  play(mel, 0, [
    ['A3', 3], ['G3', 0.5], ['A3', 2],
    ['D4', 0.5], ['F4', 0.5], ['A4', 0.5], ['D5', 1.5],
    ['C#5', 0.5], ['D5', 0.5], ['A4', 0.5], ['F4', 0.5], ['D4', 2],
  ], 0.82);
}
function mountainKing(midi) {
  const mel = track(midi, 'Melody', 0);
  const low = track(midi, 'Ostinato', 1);
  // In the Hall of the Mountain King, the opening theme in B minor, then one step higher.
  const cell = [
    ['F#4', 0.5], ['F#4', 0.5], ['F#4', 0.5], ['D4', 0.5],
    ['F#4', 0.5], ['F#4', 0.5], ['F#4', 0.5], ['D4', 0.5],
    ['F#4', 0.5], ['F#4', 0.5], ['F#4', 0.5], ['D4', 0.5],
    ['E4', 0.5], ['F#4', 0.5], ['D4', 0.5], ['B3', 0.5],
  ];
  const up = [
    ['G#4', 0.5], ['G#4', 0.5], ['G#4', 0.5], ['E4', 0.5],
    ['G#4', 0.5], ['G#4', 0.5], ['G#4', 0.5], ['E4', 0.5],
    ['G#4', 0.5], ['G#4', 0.5], ['G#4', 0.5], ['E4', 0.5],
    ['F#4', 0.5], ['G#4', 0.5], ['E4', 0.5], ['C#4', 0.5],
  ];
  play(mel, 0, cell, 0.86);
  play(mel, 8, up, 0.9);
  for (let i = 0; i < 16; i++) add(low, n(i % 2 ? 'F#2' : 'B1'), i, 0.9, 0.72);
}
function danse(midi) {
  const mel = track(midi, 'Melody', 0);
  const low = track(midi, 'Waltz', 1);
  // Danse macabre: the opening tritone, then a short waltz theme in G minor.
  play(mel, 0, [
    ['A4', 1], ['Eb5', 1],
    ['D5', 0.5], ['G4', 1], ['Bb4', 0.5], ['A4', 1], ['G4', 1],
    ['D5', 0.5], ['G4', 1], ['Bb4', 0.5], ['A4', 1], ['G4', 1],
    ['D5', 0.5], ['Eb5', 1], ['D5', 0.5], ['C5', 1], ['Bb4', 1],
    ['A4', 0.5], ['G4', 2.5],
  ], 0.84);
  const roots = ['G2', 'D2', 'G2', 'D2', 'Eb2', 'Bb1', 'D2', 'G2'];
  roots.forEach((p, i) => add(low, n(p), 2 + i * 1.5, 1.4, 0.7));
}
function baldMountain(midi) {
  const mel = track(midi, 'Melody', 0);
  const low = track(midi, 'Bass', 1);
  // Night on Bald Mountain: a short chromatic climb and the pounding theme. Original reduction.
  const climb = ['D3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'Bb3', 'B3', 'C4', 'C#4', 'D4'];
  play(mel, 0, climb.map(p => [p, 0.25]), 0.9);
  play(mel, 3, [
    ['A3', 0.5], ['C4', 0.5], ['Bb3', 0.5], ['A3', 0.5],
    ['G3', 0.5], ['A3', 1],
    ['A3', 0.5], ['C4', 0.5], ['Bb3', 0.5], ['A3', 0.5],
    ['G3', 0.5], ['F3', 0.5], ['E3', 0.5], ['D3', 1],
  ], 0.88);
  play(low, 0, [['D2', 3], ['A1', 2], ['D2', 2], ['A1', 1], ['D2', 2]], 0.8);
}
function funeralMarch(midi) {
  const mel = track(midi, 'Melody', 0);
  const low = track(midi, 'Bass', 1);
  // Chopin, Funeral March, the Bb minor theme. Short original reduction.
  const theme = [
    ['Bb4', 1.5], ['Bb4', 0.5], ['Bb4', 1], [null, 1],
    ['Bb4', 1.5], ['Ab4', 0.5], ['G4', 1.5], ['F4', 0.5],
    ['Gb4', 1], ['F4', 0.5], ['Eb4', 0.5], ['Db4', 1], ['C4', 1],
    ['Db4', 1.5], ['Bb3', 0.5], ['Bb3', 2],
  ];
  play(mel, 0, theme, 0.84);
  play(mel, 12, theme, 0.86);
  const bassLine = [
    ['Bb1', 2], ['F2', 2], ['Gb1', 2], ['Db2', 2], ['F1', 2], ['Bb1', 2],
  ];
  play(low, 0, bassLine, 0.78);
  play(low, 12, bassLine, 0.78);
}
function diesIrae(midi) {
  const mel = track(midi, 'Chant', 0);
  const low = track(midi, 'Drone', 1);
  // Dies irae, the medieval sequence, in a measured 4/4 so the transport can play it.
  play(mel, 0, [
    ['D4', 1], ['F4', 1], ['E4', 1], ['D4', 1],
    ['D4', 1], ['F4', 1], ['E4', 1], ['D4', 1],
    ['D4', 1], ['F4', 1], ['G4', 1], ['F4', 0.5], ['E4', 0.5], ['D4', 1],
    ['C4', 1], ['D4', 2], [null, 1],
    ['E4', 1], ['F4', 1], ['G4', 1], ['F4', 0.5], ['E4', 0.5],
    ['D4', 1], ['F4', 1], ['E4', 1], ['D4', 1],
    ['C4', 1], ['D4', 3],
  ], 0.8);
  play(low, 0, [['D2', 8], ['A1', 4], ['D2', 8], ['A1', 4], ['D2', 4]], 0.6);
}
function lantern(midi) {
  const mel = track(midi, 'Box', 0);
  const low = track(midi, 'Pulse', 1);
  // Original 3/4 music-box walk in E minor. Not a quote of another tune.
  play(mel, 0, [
    ['E5', 1], ['G5', 0.5], ['B5', 0.5], ['G5', 1],
    ['F#5', 1], ['E5', 1], ['D5', 1],
    ['E5', 0.5], ['F#5', 0.5], ['G5', 1], ['B4', 1],
    ['E5', 3],
    ['D5', 1], ['E5', 0.5], ['F#5', 0.5], ['G5', 1],
    ['A5', 1], ['G5', 0.5], ['F#5', 0.5], ['E5', 1],
    ['D5', 1], ['B4', 1], ['E5', 3],
  ], 0.7);
  for (let i = 0; i < 8; i++) {
    add(low, n(i % 2 ? 'B1' : 'E2'), i * 3, 0.4, 0.8);
    add(low, n(i % 2 ? 'B1' : 'E2'), i * 3 + 0.75, 0.25, 0.45);
  }
}
function cellar(midi) {
  const thump = track(midi, 'Thump', 0);
  const creak = track(midi, 'Creak', 1);
  // Original: a low lub-dub under a slow chromatic descent.
  for (let i = 0; i < 8; i++) {
    const root = i % 2 ? 'E1' : 'A1';
    add(thump, n(root), i * 2, 0.35, 0.9);
    add(thump, n(root), i * 2 + 0.6, 0.2, 0.55);
  }
  play(creak, 0, [
    ['A4', 1], ['G#4', 1], ['G4', 1], ['F#4', 1],
    ['F4', 1], ['E4', 1], ['D#4', 1], ['D4', 1],
    ['C4', 1], ['B3', 1], ['A#3', 1], ['A3', 2],
  ], 0.6);
}
function porch(midi) {
  const wail = track(midi, 'Wail', 0);
  const low = track(midi, 'Pulse', 1);
  // Original slow wail over a two-note heartbeat. No quote of another theme.
  play(wail, 0, [
    ['E5', 3], ['G5', 1], ['B5', 4],
    ['A5', 2], ['F5', 2], ['E5', 4],
    ['C5', 2], ['D5', 2], ['E5', 3], ['B4', 1],
    ['E5', 4],
  ], 0.78);
  for (let i = 0; i < 8; i++) {
    add(low, n('E1'), i * 2, 0.3, 0.85);
    add(low, n('E1'), i * 2 + 0.55, 0.18, 0.5);
  }
}

const library = [
  {
    id: 'beethoven-sym5-i', file: 'beethoven-symphony-5-mvt1.mid',
    title: 'Symphony No. 5, movement 1 (opening)', composer: 'Ludwig van Beethoven', year: 1808,
    kind: 'classical', bpm: 108, sig: [2, 4], build: beethoven, notice: PD,
    composition: 'Public domain. Symphony No. 5 in C minor, Op. 67, first movement, published 1808.',
  },
  {
    id: 'bach-toccata-fugue-dm', file: 'bach-toccata-fugue-dm.mid',
    title: 'Toccata and Fugue in D minor (opening)', composer: 'Johann Sebastian Bach', year: 1700,
    kind: 'classical', bpm: 72, sig: [4, 4], build: bach, notice: PD,
    composition: 'Public domain. Toccata and Fugue in D minor, BWV 565. The opening toccata only.',
  },
  {
    id: 'joplin-maple-leaf-rag', file: 'joplin-maple-leaf-rag.mid',
    title: 'Maple Leaf Rag (A strain)', composer: 'Scott Joplin', year: 1899,
    kind: 'ragtime', bpm: 100, sig: [2, 4], build: maple, notice: PD, hats: 16, bar: 2,
    composition: 'Public domain. Maple Leaf Rag, published 1899.',
  },
  {
    id: 'joplin-the-entertainer', file: 'joplin-the-entertainer.mid',
    title: 'The Entertainer (theme)', composer: 'Scott Joplin', year: 1902,
    kind: 'ragtime', bpm: 104, sig: [2, 4], build: entertainer, notice: PD, hats: 16, bar: 2,
    composition: 'Public domain. The Entertainer, published 1902.',
  },
  {
    id: 'sousa-stars-and-stripes', file: 'sousa-stars-and-stripes.mid',
    title: 'The Stars and Stripes Forever (trio)', composer: 'John Philip Sousa', year: 1897,
    kind: 'march', bpm: 116, sig: [4, 4], build: sousa, notice: PD, hats: 8, bar: 4,
    composition: 'Public domain. The Stars and Stripes Forever, published 1897. Trio theme.',
  },
  {
    id: 'traditional-greensleeves', file: 'traditional-greensleeves.mid',
    title: 'Greensleeves', composer: 'Traditional', year: 1580,
    kind: 'folk', bpm: 96, sig: [3, 4], build: greensleeves, notice: PD,
    composition: 'Public domain. Traditional English tune, 16th century.',
  },
  {
    id: 'foster-oh-susanna', file: 'foster-oh-susanna.mid',
    title: 'Oh! Susanna', composer: 'Stephen Foster', year: 1848,
    kind: 'folk', bpm: 120, sig: [4, 4], build: susanna, notice: PD, hats: 8, bar: 4,
    composition: 'Public domain. Oh! Susanna, Stephen Foster, 1848.',
  },
  {
    id: 'handy-st-louis-blues', file: 'handy-st-louis-blues.mid',
    title: 'St. Louis Blues (chorus)', composer: 'W. C. Handy', year: 1914,
    kind: 'blues', bpm: 88, sig: [4, 4], build: stlouis, notice: PD, hats: 12, bar: 4,
    composition: 'Public domain. St. Louis Blues, W. C. Handy, published 1914.',
  },
  {
    id: 'traditional-frankie-and-johnny', file: 'traditional-frankie-and-johnny.mid',
    title: 'Frankie and Johnny', composer: 'Traditional', year: 1900,
    kind: 'folk', bpm: 108, sig: [4, 4], build: frankie, notice: PD, hats: 8, bar: 4,
    composition: 'Public domain. Traditional American ballad.',
  },
  {
    id: 'dx-pixel-march', file: 'dx-pixel-march.mid',
    title: 'Pixel March', composer: 'DX Edge', year: 2026,
    kind: 'chiptune', bpm: 150, sig: [4, 4], build: pixel, notice: ORIG, hats: 8, bar: 4,
    composition: 'Original chiptune march written for this library.',
  },
  {
    id: 'dx-neon-alley', file: 'dx-neon-alley.mid',
    title: 'Neon Alley', composer: 'DX Edge', year: 2026,
    kind: 'synth-pop', bpm: 118, sig: [4, 4], build: neon, notice: ORIG,
    composition: 'Original synth-pop tune written for this library.',
  },
  {
    id: 'dx-dock-lamp', file: 'dx-dock-lamp.mid',
    title: 'Dock Lamp', composer: 'DX Edge', year: 2026,
    kind: 'chiptune', bpm: 132, sig: [4, 4], build: dock, notice: ORIG,
    composition: 'Original short chiptune written for this library.',
  },
  {
    id: 'bach-toccata-spooky', file: 'bach-toccata-spooky.mid',
    title: 'Toccata in D minor (spooky organ)', composer: 'Johann Sebastian Bach', year: 1700,
    kind: 'halloween', bpm: 56, sig: [4, 4], build: bachSpooky, notice: PD,
    presets: { filament: 'Haunted Organ', cathode: 'Chapel Organ' },
    composition: 'Public domain. Toccata and Fugue in D minor, BWV 565. A slow organ reduction of the opening, written for this library, separate from the other Bach file.',
  },
  {
    id: 'grieg-mountain-king', file: 'grieg-mountain-king.mid',
    title: 'In the Hall of the Mountain King (opening)', composer: 'Edvard Grieg', year: 1875,
    kind: 'halloween', bpm: 108, sig: [4, 4], build: mountainKing, notice: PD,
    presets: { filament: 'Horror Pad', cathode: 'Cellar Drone' },
    composition: 'Public domain. Peer Gynt, Op. 23, "In the Hall of the Mountain King" (1875). Opening theme only, one sequence up a step. Not the later presto.',
  },
  {
    id: 'saint-saens-danse-macabre', file: 'saint-saens-danse-macabre.mid',
    title: 'Danse macabre (excerpt)', composer: 'Camille Saint-Saëns', year: 1874,
    kind: 'halloween', bpm: 96, sig: [3, 4], build: danse, notice: PD,
    presets: { filament: 'Eerie Bells', cathode: 'Bell Jar' },
    composition: 'Public domain. Danse macabre, Op. 40 (1874). Opening tritone and a short waltz theme.',
  },
  {
    id: 'mussorgsky-bald-mountain', file: 'mussorgsky-bald-mountain.mid',
    title: 'Night on Bald Mountain (excerpt)', composer: 'Modest Mussorgsky', year: 1867,
    kind: 'halloween', bpm: 92, sig: [4, 4], build: baldMountain, notice: PD,
    presets: { filament: 'Creaky Drone', cathode: 'Creak Pulse' },
    composition: 'Public domain. Night on Bald Mountain (1867); the familiar concert shape is Rimsky-Korsakov\'s 1886 arrangement, also public domain. Short original reduction of the opening.',
  },
  {
    id: 'chopin-funeral-march', file: 'chopin-funeral-march.mid',
    title: 'Funeral March (theme)', composer: 'Frédéric Chopin', year: 1839,
    kind: 'halloween', bpm: 60, sig: [4, 4], build: funeralMarch, notice: PD,
    presets: { filament: 'Haunted Organ', cathode: 'Heartbeat' },
    composition: 'Public domain. Piano Sonata No. 2, Op. 35, movement 3, Marche funèbre (1839). The Bb minor theme only.',
  },
  {
    id: 'traditional-dies-irae', file: 'traditional-dies-irae.mid',
    title: 'Dies irae', composer: 'Traditional', year: 1250,
    kind: 'halloween', bpm: 66, sig: [4, 4], build: diesIrae, notice: PD,
    presets: { filament: 'Ghost Choir', cathode: 'Choir Breath' },
    composition: 'Public domain. Dies irae, the 13th-century sequence, set here in a steady 4/4 so a transport can play it.',
  },
  {
    id: 'dx-lantern-walk', file: 'dx-lantern-walk.mid',
    title: 'Lantern Walk', composer: 'DX Edge', year: 2026,
    kind: 'halloween', original: true, bpm: 84, sig: [3, 4], build: lantern, notice: ORIG,
    presets: { filament: 'Glass Music Box', cathode: 'Heartbeat' },
    composition: 'Original spooky music-box tune written for this library.',
  },
  {
    id: 'dx-cellar-stairs', file: 'dx-cellar-stairs.mid',
    title: 'Cellar Stairs', composer: 'DX Edge', year: 2026,
    kind: 'halloween', original: true, bpm: 72, sig: [4, 4], build: cellar, notice: ORIG,
    presets: { filament: 'Sub Heartbeat', cathode: 'Creak Pulse' },
    composition: 'Original spooky tune written for this library: a lub-dub under a chromatic descent.',
  },
  {
    id: 'dx-porch-ghost', file: 'dx-porch-ghost.mid',
    title: 'Porch Ghost', composer: 'DX Edge', year: 2026,
    kind: 'halloween', original: true, bpm: 64, sig: [4, 4], build: porch, notice: ORIG,
    presets: { filament: 'Theremin Wail', cathode: 'Wail Glide' },
    composition: 'Original spooky tune written for this library: a slow wail over a two-note pulse.',
  },
];

mkdirSync(root, { recursive: true });
const catalog = [];
for (const item of library) {
  const bytes = song({
    title: item.title, bpm: item.bpm, sig: item.sig, notice: item.notice,
    parts: item.build, hatsBars: item.hats, barBeats: item.bar,
  });
  writeFileSync(join(root, item.file), bytes);
  const back = new Midi(bytes);
  const noted = back.tracks.filter(t => t.notes.length);
  const mel = noted.find(t => t.channel === 0);
  console.log(item.file, bytes.length, 'tracks', noted.length, 'melody', mel.notes[0].midi, mel.notes.length, 'bpm', back.header.tempos[0].bpm);
  const row = {
    id: item.id, file: item.file, title: item.title, composer: item.composer, year: item.year,
    kind: item.kind, license: 'CC0 1.0', composition: item.composition,
    source: item.original || item.kind === 'chiptune' || item.kind === 'synth-pop'
      ? 'Original work sequenced for DX Edge on 14 Oct 2026 and dedicated to the public domain under CC0 1.0.'
      : 'MIDI sequence written for DX Edge on 14 Oct 2026 and dedicated to the public domain under CC0 1.0. The composition is public domain. The arrangement was not taken from another MIDI file.',
  };
  if (item.presets) row.presets = item.presets;
  catalog.push(row);
}
const beeth = new Midi(readFileSync(join(root, 'beethoven-symphony-5-mvt1.mid')));
const ons = beeth.tracks.find(t => t.channel === 0 && t.notes.length).notes.slice(0, 4).map(note => note.midi);
if (ons.join(',') !== '67,67,67,63') throw new Error('Beethoven motive changed: ' + ons.join(','));
const bachNotes = new Midi(readFileSync(join(root, 'bach-toccata-fugue-dm.mid'))).tracks.find(t => t.channel === 0).notes;
if (bachNotes[0].midi !== 69) throw new Error('Bach opening changed: ' + bachNotes[0].midi);
const king = new Midi(readFileSync(join(root, 'grieg-mountain-king.mid'))).tracks.find(t => t.channel === 0).notes.slice(0, 4).map(note => note.midi);
if (king.join(',') !== '66,66,66,62') throw new Error('Mountain King motive changed: ' + king.join(','));
const spooky = new Midi(readFileSync(join(root, 'bach-toccata-spooky.mid'))).tracks.find(t => t.channel === 0).notes;
if (spooky[0].midi !== 57) throw new Error('Spooky toccata should open on A3: ' + spooky[0].midi);
writeFileSync(join(root, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
console.log('wrote', catalog.length, 'files');
