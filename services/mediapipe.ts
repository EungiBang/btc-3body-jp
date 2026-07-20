import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let faceLandmarkerVideo: FaceLandmarker | null = null;
let faceLandmarkerImage: FaceLandmarker | null = null;

export async function initializeMediaPipe(mode: 'IMAGE' | 'VIDEO' = 'VIDEO') {
  if (mode === 'VIDEO' && faceLandmarkerVideo) return faceLandmarkerVideo;
  if (mode === 'IMAGE' && faceLandmarkerImage) return faceLandmarkerImage;
  
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );
  
  const instance = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: "GPU"
    },
    outputFaceBlendshapes: true,
    runningMode: mode,
    numFaces: 1
  });

  if (mode === 'VIDEO') {
    faceLandmarkerVideo = instance;
  } else {
    faceLandmarkerImage = instance;
  }
  
  return instance;
}
