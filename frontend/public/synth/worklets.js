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

// Offline renders let go of their worklet nodes (16 Nov 2026). A node whose port has a message handler
// stays reachable through that port, so an OfflineAudioContext's nodes, its worklet scope and its graph
// were never collected after the render: measured in headless Chrome, about 24 MB of renderer memory
// kept per Filament render of 2.6 s, so a page that rendered a few hundred times (the suite, or someone
// pressing Render WAV again and again) grew without limit and its tab could crash. workletNode() makes
// the node and, on an offline context, lists it on the context; renderAndRelease() renders, then closes
// every listed node's port and disconnects it. A live AudioContext's nodes are not listed or touched.
export function workletNode(ctx, name, opts) {
  const n = new AudioWorkletNode(ctx, name, opts);
  if (typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext) (ctx.__nodes || (ctx.__nodes = [])).push(n);
  return n;
}

// A node made elsewhere (rack.js's spring, which keeps the /otr-style constructor call): list it too.
export function trackNode(ctx, n) {
  if (n && typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext) (ctx.__nodes || (ctx.__nodes = [])).push(n);
  return n;
}

export function releaseNodes(ctx) {
  const l = ctx.__nodes || [];
  for (const n of l) {
    if (n.port) {                         // trackNode() may list a node without one
      n.port.onmessage = null;
      try { n.port.close(); } catch (e) { /* already closed */ }
    }
    try { n.disconnect(); } catch (e) { /* already torn down */ }
  }
  ctx.__nodes = [];
  return l.length;
}

export async function renderAndRelease(ctx) {
  try { return await ctx.startRendering(); } finally { releaseNodes(ctx); }
}
