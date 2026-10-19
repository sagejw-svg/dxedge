// MediaPipe Hand Landmarker, loaded only after the player allows the camera.
// The model and the wasm come from the MediaPipe host. The camera frame is
// drawn into a canvas in this page and is not uploaded.

export const VISION_MODULE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/vision_bundle.mjs';
export const VISION_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm';
export const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export async function createHandLandmarker() {
  const vision = await import(VISION_MODULE);
  const fileset = await vision.FilesetResolver.forVisionTasks(VISION_WASM);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: HAND_MODEL, delegate },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  let landmarker = null;
  try {
    landmarker = await vision.HandLandmarker.createFromOptions(fileset, options('GPU'));
  } catch (gpuError) {
    landmarker = await vision.HandLandmarker.createFromOptions(fileset, options('CPU'));
  }
  let lastTs = 0;
  return {
    detect(source, now) {
      const ts = Math.max(lastTs + 1, Math.round(now));
      lastTs = ts;
      return landmarker.detectForVideo(source, ts);
    },
    close() {
      try { landmarker.close(); } catch (e) { /* already closed */ }
    },
  };
}

export function mirrorFrame(video, canvas) {
  const w = video.videoWidth || 0;
  const h = video.videoHeight || 0;
  if (!w || !h) return false;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.setTransform(-1, 0, 0, 1, w, 0);
  g.drawImage(video, 0, 0, w, h);
  g.setTransform(1, 0, 0, 1, 0, 0);
  return true;
}
