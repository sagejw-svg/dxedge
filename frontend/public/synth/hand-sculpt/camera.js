// Camera and the local MediaPipe hand landmarker.
// The picture stays in this browser. Nothing here uploads a frame.

import { FilesetResolver, HandLandmarker } from './vendor/vision_bundle.mjs';

let trackerPromise = null;

export function loadTracker() {
  if (trackerPromise) return trackerPromise;
  trackerPromise = (async () => {
    const wasm = new URL('./vendor/wasm', import.meta.url).href;
    const vision = await FilesetResolver.forVisionTasks(wasm);
    const model = new URL('./vendor/hand_landmarker.task', import.meta.url).href;
    const options = (delegate) => ({
      baseOptions: { modelAssetPath: model, delegate },
      runningMode: 'VIDEO',
      numHands: 2,
    });
    try {
      return await HandLandmarker.createFromOptions(vision, options('GPU'));
    } catch (err) {
      return await HandLandmarker.createFromOptions(vision, options('CPU'));
    }
  })();
  return trackerPromise;
}

export async function openCamera(video) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('This browser has no camera API.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: 'user',
      width: { ideal: 640 },
      height: { ideal: 480 },
    },
  });
  video.srcObject = stream;
  video.playsInline = true;
  await video.play();
  return stream;
}

export function stopStream(stream) {
  if (!stream) return;
  for (const track of stream.getTracks()) track.stop();
}

export function readHands(tracker, video, now) {
  if (!tracker || video.readyState < 2) return [];
  const res = tracker.detectForVideo(video, now);
  const hands = res && res.landmarks ? res.landmarks : [];
  return hands.map(lm => lm.map(p => ({ x: p.x, y: p.y, z: p.z || 0 })));
}
