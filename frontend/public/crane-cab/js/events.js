// Tiny pub/sub. Systems talk through this, never by direct call.
// Event names (keep this list current):
//   hook.tight, load.slack, load.inZone, sway.settled, alarm.a2b, lmi.lock,
//   collision, estop, radio.reply, radio.overlap, radio.gaveUp, lift.win, lift.fail,
//   phase.change

export function createBus(state) {
  const handlers = new Map();

  function on(name, fn) {
    if (!handlers.has(name)) handlers.set(name, new Set());
    handlers.get(name).add(fn);
    return () => off(name, fn);
  }

  function off(name, fn) {
    handlers.get(name)?.delete(fn);
  }

  function emit(name, payload) {
    if (state) {
      const log = state.debug.events;
      log.push(`${state.time.t.toFixed(2)} ${name}`);
      if (log.length > 10) log.shift();
    }
    handlers.get(name)?.forEach((fn) => fn(payload));
  }

  return { on, off, emit };
}
