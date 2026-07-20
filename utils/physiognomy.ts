import { NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface PhysiognomyMetrics {
  samjeong: {
    upper: number;
    middle: number;
    lower: number;
  };
  facialIndex: number;
  eyeDistanceRatio: number;
  noseWidthRatio: number;
  mouthWidthRatio: number;
  geometricRatio: number; // L1 (horizontal) / L2 (vertical)
  
  // 동물상 정밀 매핑 4대 지표
  eyeSlant: number;       // 눈꼬리 기울기 (Degree)
  eyeRoundness: number;   // 눈 둥글기 (높이/너비)
  jawAngle: number;       // 턱선 각도 (Degree)
  cheekboneProminence: number; // 광대뼈 돌출도 (상대적 z-값 등)

  energyZones: {
    root: number;        // Jaw
    sacral: number;      // Mouth
    solarPlexus: number; // Cheeks
    heart: number;       // Forehead
    throat: number;      // Jawline/Neck
    thirdEye: number;    // Between eyebrows
    crown: number;       // Top of forehead
  };
  brightness: number;    // Overall facial brightness
  blendshapes: Record<string, number>;
}

function distance(p1: NormalizedLandmark, p2: NormalizedLandmark) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2));
}

// 두 점 사이의 각도 계산 (도 단위)
function calculateAngleDegrees(p1: NormalizedLandmark, p2: NormalizedLandmark): number {
  const dy = p2.y - p1.y; // 캔버스 좌표계에서는 y가 아래로 갈수록 증가하지만, 랜드마크도 동일하게 정규화됨
  const dx = p2.x - p1.x;
  return Math.atan2(dy, dx) * (180 / Math.PI);
}

export function calculateMetrics(landmarks: NormalizedLandmark[], blendshapes: any): PhysiognomyMetrics {
  // 10: Top of head (hairline approx), 152: Chin
  // 8: Between eyebrows (Glabella), 1: Nose tip
  const faceHeight = distance(landmarks[10], landmarks[152]);
  const faceWidth = distance(landmarks[234], landmarks[454]);
  
  const upperFace = distance(landmarks[10], landmarks[8]);
  const middleFace = distance(landmarks[8], landmarks[1]);
  const lowerFace = distance(landmarks[1], landmarks[152]);
  
  const eyeDistance = distance(landmarks[133], landmarks[362]);
  const noseWidth = distance(landmarks[129], landmarks[358]); // Alar width
  const mouthWidth = distance(landmarks[61], landmarks[291]);

  // Geometric Ratio (L1: Horizontal Face Width / L2: Vertical Forehead-to-Chin)
  const geometricRatio = faceWidth / faceHeight;
  
  // --- 동물상 정밀 매핑을 위한 4대 지표 연산 ---
  // 1. eyeSlant (눈꼬리 기울기): 왼쪽 눈 (외곽 133, 내곽 33), 오른쪽 눈 (외곽 362, 내곽 263)
  // mediapipe 좌표계: 오른쪽으로 x증가, 아래로 y증가
  // 눈머리보다 눈꼬리가 위에 있으면 dy는 음수. 각도 계산을 직관적으로 양수로 만들기 위해 보정.
  const leftEyeSlant = -calculateAngleDegrees(landmarks[33], landmarks[133]);
  const rightEyeSlant = calculateAngleDegrees(landmarks[263], landmarks[362]) - 180; // 방향 보정
  // 최종 눈꼬리 기울기 (양수면 올라간 눈, 음수면 처진 눈)
  const eyeSlant = (leftEyeSlant + Math.abs(rightEyeSlant)) / 2;

  // 2. eyeRoundness (눈 둥글기): 눈 수직 높이 / 눈 수평 길이
  const leftEyeHeight = distance(landmarks[159], landmarks[145]);
  const leftEyeWidth = distance(landmarks[33], landmarks[133]);
  const rightEyeHeight = distance(landmarks[386], landmarks[374]);
  const rightEyeWidth = distance(landmarks[263], landmarks[362]);
  const eyeRoundness = ((leftEyeHeight / leftEyeWidth) + (rightEyeHeight / rightEyeWidth)) / 2;

  // 3. jawAngle (턱선 각도): 귀 밑(132, 361)과 턱끝(152)이 이루는 각도.
  // 132 -> 152 벡터와 361 -> 152 벡터 사이의 각도를 코사인 법칙으로 근사 또는 턱의 v라인 정도 측정
  const jawDistLeftToRight = distance(landmarks[132], landmarks[361]);
  const jawDistLeftToBottom = distance(landmarks[132], landmarks[152]);
  const jawDistRightToBottom = distance(landmarks[361], landmarks[152]);
  // 코사인 법칙: cos(C) = (a^2 + b^2 - c^2) / 2ab. 여기서 C가 턱끝 각도.
  const cosJawAngle = (Math.pow(jawDistLeftToBottom, 2) + Math.pow(jawDistRightToBottom, 2) - Math.pow(jawDistLeftToRight, 2)) / (2 * jawDistLeftToBottom * jawDistRightToBottom);
  const jawAngle = Math.acos(cosJawAngle) * (180 / Math.PI); // 각도가 작을수록 날렵한 턱선(V라인)

  // 4. cheekboneProminence (광대뼈 돌출도)
  // 중앙 코(1) 대비 양쪽 광대(123, 352)의 z값(깊이) 차이의 절대값과 얼굴 너비 대비 광대 너비의 비율
  const cheekboneWidth = distance(landmarks[123], landmarks[352]);
  const avgZ = (landmarks[123].z + landmarks[352].z) / 2;
  const noseZ = landmarks[1].z;
  // 광대가 튀어나올수록 z값이 코 쪽에 가깝게 낮아짐(음수 방향). 코와 광대의 깊이 차이를 얼굴 너비로 나눔.
  const cheekboneProminence = (Math.abs(noseZ - avgZ) * 100) * (cheekboneWidth / faceWidth);

  const blendshapeDict: Record<string, number> = {};
  if (blendshapes && blendshapes.categories) {
    blendshapes.categories.forEach((cat: any) => {
      blendshapeDict[cat.categoryName] = cat.score;
    });
  }

  // Energy Zone Mapping (Heuristics based on facial features + blendshapes)
  // Since we can't easily sample pixel luminance here without passing the whole canvas context,
  // we'll calculate "Activity" scores based on landmarker positions and blendshapes
  // as a proxy for "Energized" states.
  const energyZones = {
    root: (blendshapeDict['jawOpen'] || 0) + (1 - (lowerFace / faceHeight)), 
    sacral: (blendshapeDict['mouthSmileLeft'] || 0 + blendshapeDict['mouthSmileRight'] || 0) / 2,
    solarPlexus: (blendshapeDict['cheekPuff'] || 0) + 0.5, // Proxy
    heart: (1 - (blendshapeDict['browDownLeft'] || 0)), 
    throat: (1 - (blendshapeDict['jawOpen'] || 0)),
    thirdEye: (1 - (blendshapeDict['browInnerUp'] || 0)), 
    crown: (upperFace / faceHeight) * 2,
  };

  return {
    samjeong: {
      upper: upperFace / faceHeight,
      middle: middleFace / faceHeight,
      lower: lowerFace / faceHeight,
    },
    facialIndex: faceHeight / faceWidth,
    eyeDistanceRatio: eyeDistance / faceWidth,
    noseWidthRatio: noseWidth / faceWidth,
    mouthWidthRatio: mouthWidth / faceWidth,
    geometricRatio,
    eyeSlant,
    eyeRoundness,
    jawAngle,
    cheekboneProminence,
    energyZones,
    brightness: 0.8, // Placeholder, will be refined in analysis prompt
    blendshapes: blendshapeDict
  };
}

export function averageMetrics(metricsList: PhysiognomyMetrics[]): PhysiognomyMetrics {
  if (metricsList.length === 0) throw new Error("No metrics to average");

  const count = metricsList.length;
  const avg: PhysiognomyMetrics = {
    samjeong: { upper: 0, middle: 0, lower: 0 },
    facialIndex: 0,
    eyeDistanceRatio: 0,
    noseWidthRatio: 0,
    mouthWidthRatio: 0,
    geometricRatio: 0,
    eyeSlant: 0,
    eyeRoundness: 0,
    jawAngle: 0,
    cheekboneProminence: 0,
    energyZones: { root: 0, sacral: 0, solarPlexus: 0, heart: 0, throat: 0, thirdEye: 0, crown: 0 },
    brightness: 0,
    blendshapes: {}
  };

  metricsList.forEach(m => {
    avg.samjeong.upper += m.samjeong.upper;
    avg.samjeong.middle += m.samjeong.middle;
    avg.samjeong.lower += m.samjeong.lower;
    avg.facialIndex += m.facialIndex;
    avg.eyeDistanceRatio += m.eyeDistanceRatio;
    avg.noseWidthRatio += m.noseWidthRatio;
    avg.mouthWidthRatio += m.mouthWidthRatio;
    avg.geometricRatio += m.geometricRatio;
    avg.eyeSlant += m.eyeSlant;
    avg.eyeRoundness += m.eyeRoundness;
    avg.jawAngle += m.jawAngle;
    avg.cheekboneProminence += m.cheekboneProminence;
    avg.brightness += m.brightness;

    Object.keys(avg.energyZones).forEach(key => {
      (avg.energyZones as any)[key] += (m.energyZones as any)[key];
    });

    for (const [key, value] of Object.entries(m.blendshapes)) {
      avg.blendshapes[key] = (avg.blendshapes[key] || 0) + value;
    }
  });

  avg.samjeong.upper /= count;
  avg.samjeong.middle /= count;
  avg.samjeong.lower /= count;
  avg.facialIndex /= count;
  avg.eyeDistanceRatio /= count;
  avg.noseWidthRatio /= count;
  avg.mouthWidthRatio /= count;
  avg.geometricRatio /= count;
  avg.eyeSlant /= count;
  avg.eyeRoundness /= count;
  avg.jawAngle /= count;
  avg.cheekboneProminence /= count;
  avg.brightness /= count;

  Object.keys(avg.energyZones).forEach(key => {
    (avg.energyZones as any)[key] /= count;
  });

  for (const key of Object.keys(avg.blendshapes)) {
    avg.blendshapes[key] /= count;
  }

  return avg;
}
