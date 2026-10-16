import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { startServer } = require('../server.cjs');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend', 'public');

test('the local server serves the synth rack and refuses to leave the folder', async () => {
  const started = await startServer(root);
  try {
    const page = await fetch(started.url + 'synth/');
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /id="mHost"/);
    assert.match(html, /id="mixFolder"/);

    const mixer = await fetch(started.url + 'synth/mixer.js');
    assert.equal(mixer.status, 200);
    assert.match(mixer.headers.get('content-type'), /javascript/);
    const source = await mixer.text();
    assert.match(source, /sendR/);

    const worklet = await fetch(started.url + 'synth/master.worklet.js');
    assert.equal(worklet.status, 200);
    assert.match(worklet.headers.get('content-type'), /javascript/);

    const missing = await fetch(started.url + 'synth/no-such-file.js');
    assert.equal(missing.status, 404);

    const escape = await fetch(started.url + 'synth/%2e%2e/%2e%2e/desktop/package.json');
    assert.ok(escape.status === 403 || escape.status === 404);
  } finally {
    await new Promise((resolve) => started.server.close(resolve));
  }
});
