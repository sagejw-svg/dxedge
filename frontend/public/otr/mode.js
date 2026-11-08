/* Basic / Advanced for the old-time radio page.
 * Visitors land on Basic. The choice is otr_mode in localStorage.
 * The existing test suite drives this page with Playwright (navigator.webdriver).
 * With no saved choice, those runs keep the full page so they still see Advanced.
 * A saved otr_mode always wins, including under webdriver.
 *
 * Loaded from the head, before the body is parsed, so the first paint matches.
 */
(function () {
  'use strict';
  var KEY = 'otr_mode';

  function known(mode) {
    return mode === 'basic' || mode === 'advanced' || mode === 'player';
  }
  function choose(stored, webdriver) {
    if (known(stored)) return stored;
    return webdriver ? 'advanced' : 'basic';
  }
  function read() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function apply(mode) {
    if (!known(mode)) mode = 'basic';
    document.documentElement.setAttribute('data-otr-mode', mode);
    try { document.dispatchEvent(new CustomEvent('otr-mode', { detail: mode })); } catch (e) {}
    return mode;
  }
  function set(mode) {
    if (!known(mode)) mode = 'basic';
    try { localStorage.setItem(KEY, mode); } catch (e) {}
    return apply(mode);
  }

  apply(choose(read(), navigator.webdriver === true));

  /* Layout rules that must apply even when the stylesheet is served with a
     generic type (one of the local test servers does that). basic.css repeats
     the look; these rules decide what is on screen. */
  var css = document.createElement('style');
  css.id = 'otr-mode-critical';
  css.textContent = [
    'header.top{position:relative}',
    '.otr-mode-switch{position:absolute;top:0;right:0;z-index:5;display:inline-flex;max-width:100%}',
    '@media (max-width:640px){header.top{padding-top:52px}}',
    '@media (min-width:781px){#supportTop{margin-top:48px}}',
    'html[data-otr-mode="advanced"] #otr-basic,',
    'html[data-otr-mode="player"] #otr-basic{display:none !important}',
    'html[data-otr-mode="basic"] #console,',
    'html[data-otr-mode="basic"] #rack,',
    'html[data-otr-mode="basic"] #contWrap,',
    'html[data-otr-mode="basic"] nav.tabs,',
    'html[data-otr-mode="basic"] .pane,',
    'html[data-otr-mode="basic"] #support,',
    'html[data-otr-mode="basic"] #foot,',
    'html[data-otr-mode="basic"] #dock,',
    'html[data-otr-mode="basic"] #tview,',
    'html[data-otr-mode="basic"] #lampSolo{display:none !important}'
  ].join('');
  document.head.appendChild(css);

  window.OTRMode = {
    KEY: KEY,
    choose: choose,
    read: read,
    current: function () { return document.documentElement.getAttribute('data-otr-mode') || 'basic'; },
    set: set
  };
})();
