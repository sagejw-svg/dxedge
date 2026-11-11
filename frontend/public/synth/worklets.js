// AudioWorklet modules, loaded once per context. Our own code.
//
// loadWorklet(ctx, url) starts ctx.audioWorklet.addModule(url) the first time a context asks for a
// module and hands every later caller the same promise, so a module the page started early is never
// added twice. preloadWorklets(ctx, urls) starts several at once and does not wait for them.
//
// Why: the live page used to attach its sixteen hosted devices one after another, and each attach
// waited for its own module (the fetch of the worklet file and of everything it imports, then its
// evaluation in the worklet scope) before the next one asked for its module. Started together, the
// fetches overlap; the attaches still run in the same order and build the same nodes, so the audio
// graph is the one it was. A failed load is forgotten, so the next caller tries again, and its
// error still reaches whoever awaits it (preloadWorklets alone swallows it: the attach that needs the
// module reports it).
export function loadWorklet(ctx, url) {
  const m = ctx.__worklets || (ctx.__worklets = new Map());
  let p = m.get(url);
  if (!p) {
    p = ctx.audioWorklet.addModule(url);
    m.set(url, p);
    p.catch(() => { if (m.get(url) === p) m.delete(url); });
  }
  return p;
}

export function preloadWorklets(ctx, urls) {
  urls.forEach(u => { loadWorklet(ctx, u).catch(() => {}); });
}
