// Rack device contract (dxrack/1).
//
// A device is one instrument or effect the rack can host. It has a descriptor,
// a parameter table with stable ids, MIDI in, a stereo output, and a versioned
// patch. Filament and Cathode are the first two. A step sequencer or a drum
// machine registers the same way and subscribes to the transport for the clock.
//
// The shape follows the published Web Audio Modules 2.0 ideas (a descriptor,
// parameter info, MIDI bytes, a transport event) so a later host could speak to
// a WAM. This file is our own code; nothing was copied from that package.
//
// Parameter values are the patch's own values: a number, a boolean, or a choice
// string (or a number, for a choice like footage). A WAM host numbers those:
// booleans are 0 or 1, and a choice is its index. `min` and `max` are that
// numeric range for booleans and choices, and the knob range for float and int.

import { DEFAULT, RANGE, ENUMS } from './patches.js';
import { C_DEFAULT, RANGE as C_RANGE, C_ENUMS } from './cathode.js';

export const RACK_API = 'dxrack/1';

const registry = new Map();

const SKIP = { v: 1, name: 1, cat: 1, device: 1, cables: 1 };

// Build the parameter table from a patch's defaults, ranges and enums.
export function parameterTable(defaults, range, enums) {
  const info = {};
  (function walk(obj, prefix) {
    Object.keys(obj).forEach(k => {
      if (!prefix && SKIP[k]) return;
      const path = prefix ? prefix + '.' + k : k;
      const v = obj[k];
      if (Array.isArray(v)) return;
      if (v && typeof v === 'object') { walk(v, path); return; }
      const choices = enums[path];
      const span = range[path];
      if (choices) {
        info[path] = {
          id: path, label: path, type: 'choice', choices: choices.slice(),
          default: choices.includes(v) ? v : choices[0], min: 0, max: choices.length - 1,
        };
        return;
      }
      if (typeof v === 'boolean') {
        info[path] = { id: path, label: path, type: 'boolean', default: v, min: 0, max: 1 };
        return;
      }
      if (typeof v === 'number') {
        const min = span ? span[0] : v, max = span ? span[1] : v;
        const int = !!(span && Number.isInteger(min) && Number.isInteger(max) && Number.isInteger(v) && max - min >= 1 && max - min <= 32);
        info[path] = { id: path, label: path, type: int ? 'int' : 'float', default: v, min, max };
      }
    });
  })(defaults, '');
  return info;
}

// Register a device other code can host. `create(ctx, host)` is optional; the
// built-in instruments are started by the engine from `processor` instead.
export function registerDevice(desc) {
  if (!desc || !desc.id || !desc.name) throw new Error('a device needs an id and a name');
  const d = Object.assign({
    api: RACK_API, vendor: 'DX Edge', version: '1', description: '',
    instrument: true, audioInputs: 0, audioOutputs: 1, midiInput: true, midiOutput: false,
    parameters: {},
  }, desc);
  registry.set(d.id, d);
  return d;
}

export function getDevice(id) { return registry.get(id) || null; }
export function listDevices() { return [...registry.values()]; }

registerDevice({
  id: 'filament', name: 'Filament', version: '1',
  description: 'Polyphonic tube synthesizer',
  instrument: true, audioInputs: 0, audioOutputs: 1, midiInput: true, midiOutput: false,
  processor: 'filament',
  parameters: parameterTable(DEFAULT, RANGE, ENUMS),
});

registerDevice({
  id: 'cathode', name: 'Cathode', version: '1',
  description: 'Mono semi-modular synthesizer',
  instrument: true, audioInputs: 0, audioOutputs: 1, midiInput: true, midiOutput: false,
  processor: 'cathode',
  parameters: parameterTable(C_DEFAULT, C_RANGE, C_ENUMS),
});
