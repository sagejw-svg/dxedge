# DXEdge Synth desktop

Windows app for the synth rack and mix desk. It is Electron, not Tauri: the rack is Web Audio worklets, Web MIDI, and the microphone, and Electron's Chromium already implements all three. A WebView wrapper would need a separate audio stack and a less predictable MIDI path.

The window loads the same `frontend/public` files the website serves, from a small server on `127.0.0.1`. That address is a secure context, so worklets, MIDI, and `getUserMedia` work with no network. Packaged builds carry those files inside the installer.

Audio stays on the page's interactive `AudioContext`. Electron asks Chromium for a 128-frame output buffer and does not throttle the renderer in the background.

The red master record button still makes one WAV of the mix. In this app that file is written straight into a folder (Music/DXEdge until you pick another one). The mix desk's **recordings folder** button is the picker. Mix JSON downloads keep the normal save dialog.

```bash
cd desktop
npm install
npm test
npm start
```

The Windows installer is built only by the `desktop-v*` release workflow. A push to `main` still deploys the website and does not build this app.
