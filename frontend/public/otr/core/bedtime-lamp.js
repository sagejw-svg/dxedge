/* Bedtime Amber: a slow, dim lava-lamp picture.
 *
 * Colours and the two-minute cycle are aesthetic choices for a dark room.
 * They are not a light dose and they are not a sleep treatment. The painter
 * draws a handful of large ellipses. It does not step the daytime physics,
 * pulse the brightness, or follow the audio.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.OTRBedtime = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  var PALETTE = {
    bg: '#080504',
    liq: [49, 16, 14],
    wax: [142, 48, 32],
    amber: [181, 102, 39]
  };
  // One full rise and fall. One way along the bottle is half of this.
  var PERIOD = 120;
  var BLOBS = [
    { r: 6.6, phase: 0.00, sway: 2.2 },
    { r: 5.5, phase: 0.27, sway: 1.4 },
    { r: 7.1, phase: 0.53, sway: 1.8 },
    { r: 5.0, phase: 0.78, sway: 1.1 }
  ];
  var CX = 60, Y_BOT = 116, Y_TOP = 50;

  function blobs(t, on) {
    var time = +t || 0;
    var lit = !!on;
    return BLOBS.map(function (b) {
      var u = lit ? (0.5 - 0.5 * Math.cos(2 * Math.PI * (time / PERIOD + b.phase))) : 0;
      var y = Y_BOT - u * (Y_BOT - Y_TOP);
      var x = CX + (lit ? Math.sin(2 * Math.PI * (time / PERIOD + b.phase)) * b.sway : 0);
      return { x: x, y: y, r: b.r };
    });
  }

  return {
    PALETTE: PALETTE,
    PERIOD: PERIOD,
    COUNT: BLOBS.length,
    blobs: blobs,
    note: 'A dim amber lamp for a dark room. Lower your screen brightness.'
  };
});
