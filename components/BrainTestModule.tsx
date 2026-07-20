// 뇌 인지 반응 및 기억력 테스트 진행을 처리하는 게임형 측정 컴포넌트
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AssessmentStep, BrainTestData, UserInfo } from '../types';
import { speak } from '../services/ttsService';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import * as poseDetection from '@tensorflow-models/pose-detection';

// Reuse global detector from usePoseEstimation
declare let globalDetector: poseDetection.PoseDetector | null;

interface BrainTestModuleProps {
  testType: AssessmentStep;
  onComplete: (dataUrl: string, brainTestData: BrainTestData) => void;
  preferredCameraId?: string;
  userInfo?: UserInfo | null;
}

type GamePhase = 'intro' | 'calibration' | 'handcheck' | 'countdown' | 'playing' | 'result';

// Cross-body instructions (무릎 포함)
const CROSS_INSTRUCTIONS = [
  { text: 'Right Hand → Left Shoulder', textEn: 'Right Hand → Left Shoulder', ttsText: 'Right hand, left shoulder', ttsTextEn: 'Right hand, left shoulder', hand: 'right', target: 'left_shoulder' },
  { text: 'Left Hand → Right Shoulder', textEn: 'Left Hand → Right Shoulder', ttsText: 'Left hand, right shoulder', ttsTextEn: 'Left hand, right shoulder', hand: 'left', target: 'right_shoulder' },
  { text: 'Right Hand → Left Knee', textEn: 'Right Hand → Left Knee', ttsText: 'Right hand, left knee', ttsTextEn: 'Right hand, left knee', hand: 'right', target: 'left_knee' },
  { text: 'Left Hand → Right Knee', textEn: 'Left Hand → Right Knee', ttsText: 'Left hand, right knee', ttsTextEn: 'Left hand, right knee', hand: 'left', target: 'right_knee' },
  { text: 'Right Hand → Left Hip', textEn: 'Right Hand → Left Hip', ttsText: 'Right hand, left hip', ttsTextEn: 'Right hand, left hip', hand: 'right', target: 'left_hip' },
  { text: 'Left Hand → Right Hip', textEn: 'Left Hand → Right Hip', ttsText: 'Left hand, right hip', ttsTextEn: 'Left hand, right hip', hand: 'left', target: 'right_hip' },
  { text: 'Right Hand → Above Head', textEn: 'Right Hand → Above Head', ttsText: 'Right hand, above head', ttsTextEn: 'Right hand, above head', hand: 'right', target: 'head' },
  { text: 'Left Hand → Above Head', textEn: 'Left Hand → Above Head', ttsText: 'Left hand, above head', ttsTextEn: 'Left hand, above head', hand: 'left', target: 'head' },
];

// ============ MART SHOPPING GAME DATA v5.1 ============
// v5.1: 24개 물건, 이미지 전용 기억, 천원 단위 가격
const MART_ITEMS = [
  { id: 'apple', emoji: '🍎', name: 'Apple', nameEn: 'Apple', price: 4000 },
  { id: 'banana', emoji: '🍌', name: 'Banana', nameEn: 'Banana', price: 3000 },
  { id: 'milk', emoji: '🥛', name: 'Milk', nameEn: 'Milk', price: 4000 },
  { id: 'bread', emoji: '🍞', name: 'Bread', nameEn: 'Bread', price: 3000 },
  { id: 'egg', emoji: '🥚', name: 'Eggs', nameEn: 'Eggs', price: 6000 },
  { id: 'carrot', emoji: '🥕', name: 'Carrot', nameEn: 'Carrot', price: 2000 },
  { id: 'fish', emoji: '🐟', name: 'Fish', nameEn: 'Fish', price: 8000 },
  { id: 'cheese', emoji: '🧀', name: 'Cheese', nameEn: 'Cheese', price: 4000 },
  { id: 'tomato', emoji: '🍅', name: 'Tomato', nameEn: 'Tomato', price: 3000 },
  { id: 'chicken', emoji: '🍗', name: 'Chicken', nameEn: 'Chicken', price: 7000 },
  { id: 'grape', emoji: '🍇', name: 'Grapes', nameEn: 'Grapes', price: 5000 },
  { id: 'watermelon', emoji: '🍉', name: 'Watermelon', nameEn: 'Watermelon', price: 9000 },
  { id: 'onion', emoji: '🧅', name: 'Onion', nameEn: 'Onion', price: 2000 },
  { id: 'corn', emoji: '🌽', name: 'Corn', nameEn: 'Corn', price: 3000 },
  { id: 'shrimp', emoji: '🦐', name: 'Shrimp', nameEn: 'Shrimp', price: 6000 },
  { id: 'pepper', emoji: '🌶️', name: 'Pepper', nameEn: 'Pepper', price: 2000 },
  { id: 'mushroom', emoji: '🍄', name: 'Mushroom', nameEn: 'Mushroom', price: 4000 },
  { id: 'peach', emoji: '🍑', name: 'Peach', nameEn: 'Peach', price: 5000 },
  { id: 'strawberry', emoji: '🍓', name: 'Strawberry', nameEn: 'Strawberry', price: 6000 },
  { id: 'pear', emoji: '🍐', name: 'Pear', nameEn: 'Pear', price: 4000 },
  { id: 'melon', emoji: '🍈', name: 'Melon', nameEn: 'Melon', price: 3000 },
  { id: 'sweetpotato', emoji: '🍠', name: 'Sweet Potato', nameEn: 'Sweet Potato', price: 3000 },
  { id: 'broccoli', emoji: '🥦', name: 'Broccoli', nameEn: 'Broccoli', price: 3000 },
  { id: 'avocado', emoji: '🥑', name: 'Avocado', nameEn: 'Avocado', price: 5000 },
];

// v5.0 방해 과제: 3자리 받아올림/받아내림 연산 생성기
const generateHardMathQuiz = (isAdd: boolean): { question: string; answer: number } => {
  if (isAdd) {
    // 덧셈: 받아올림이 2회 이상 발생하도록 설계
    let a: number, b: number;
    do {
      a = Math.floor(Math.random() * 400) + 200; // 200~599
      b = Math.floor(Math.random() * 400) + 150; // 150~549
    } while (
      (a % 10) + (b % 10) < 10 || // 일의자리 받아올림 필수
      (Math.floor(a / 10) % 10) + (Math.floor(b / 10) % 10) < 9 || // 십의자리 받아올림 유도
      a % 5 === 0 || b % 5 === 0 || // 5,0으로 끝나는 숫자 제외
      a + b > 999 // 결과 3자리 유지
    );
    return { question: `${a} + ${b}`, answer: a + b };
  } else {
    // 뺄셈: 받아내림이 2회 이상 발생하도록 설계
    let a: number, b: number;
    do {
      a = Math.floor(Math.random() * 400) + 400; // 400~799
      b = Math.floor(Math.random() * 300) + 150; // 150~449
    } while (
      (a % 10) >= (b % 10) || // 일의자리 받아내림 필수 (a의 일의자리 < b의 일의자리)
      (Math.floor(a / 10) % 10) >= (Math.floor(b / 10) % 10) || // 십의자리도 받아내림 유도
      a % 5 === 0 || b % 5 === 0 || // 5,0으로 끝나는 숫자 제외
      a - b < 100 // 결과 3자리 유지
    );
    return { question: `${a} - ${b}`, answer: a - b };
  }
};

const BrainTestModule: React.FC<BrainTestModuleProps> = ({ testType, onComplete, preferredCameraId, userInfo }) => {
  const isEnglish = true;
  const [isPortraitMode, setIsPortraitMode] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<GamePhase>('intro');
  const [countdown, setCountdown] = useState(3);
  const [detector, setDetector] = useState<poseDetection.PoseDetector | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const offCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [retryCount, setRetryCount] = useState(0);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    setCameraReady(false);
    setRetryCount(prev => prev + 1);
  };

  useEffect(() => {
    offCanvasRef.current = document.createElement('canvas');
    return () => {
      offCanvasRef.current = null;
    };
  }, []);

  // Reaction test state - 3색 시스템 + white + Stroop 효과
  const [signalColor, setSignalColor] = useState<'none' | 'green' | 'blue' | 'red' | 'white'>('none');
  const [signalDirection, setSignalDirection] = useState<'none' | 'left' | 'right' | 'both'>('none');
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [reactionErrors, setReactionErrors] = useState(0);
  const [reactionRound, setReactionRound] = useState(0);
  const [reactionMessage, setReactionMessage] = useState('');
  const [reactionFlash, setReactionFlash] = useState<'none' | 'correct' | 'wrong'>('none');
  const [manualReactionErrors, setManualReactionErrors] = useState<string>('');
  const [showReactionEditModal, setShowReactionEditModal] = useState(false);
  const signalTimeRef = useRef<number>(0);
  const waitingForResponseRef = useRef(false);
  const handBaselineRef = useRef<number | null>(null);

  // Cross-body test state
  const [crossInstruction, setCrossInstruction] = useState('');
  const [crossRound, setCrossRound] = useState(0);
  const [crossCorrect, setCrossCorrect] = useState(0);
  const [crossTimes, setCrossTimes] = useState<number[]>([]);
  const [crossMessage, setCrossMessage] = useState('');
  const crossTimeRef = useRef<number>(0);
  const crossDetectedRef = useRef(false);

  // Mart Shopping Game state
  const [martItemsToRemember, setMartItemsToRemember] = useState<typeof MART_ITEMS>([]);
  const [martShelfItems, setMartShelfItems] = useState<typeof MART_ITEMS>([]);
  const [martShowingIndex, setMartShowingIndex] = useState(-1);
  const [martPhase, setMartPhase] = useState<'showing' | 'distraction' | 'shopping' | 'priceQuiz' | 'done'>('showing');
  const [cartItems, setCartItems] = useState<string[]>([]);
  const [martMessage, setMartMessage] = useState('');
  const cartItemsRef = useRef<string[]>([]); // 클로저 문제 해결용 ref
  const martItemsRef = useRef<typeof MART_ITEMS>([]); // 클로저 문제 해결용 ref
  const [martRound, setMartRound] = useState(0);
  const [martTotalCorrect, setMartTotalCorrect] = useState(0);
  const MART_ITEMS_TO_REMEMBER = 8;  // v5.0: 6→8개
  const MART_SHELF_SIZE = 24;        // v5.0: 12→24개
  const [lastAddedItem, setLastAddedItem] = useState<string | null>(null);
  const [martTimeLeft, setMartTimeLeft] = useState(60); // 남은 시간 (초)
  const [martShowingCountdown, setMartShowingCountdown] = useState(20); // v5.1: 20초
  const [martPriceVisibleIds, setMartPriceVisibleIds] = useState<string[]>([]); // v5.1: 가격이 보이는 4개 아이템 ID
  const [distractionQuizzes, setDistractionQuizzes] = useState<{question: string; answer: number; options: number[]}[]>([]);
  const [distractionIndex, setDistractionIndex] = useState(0);
  const [distractionSelected, setDistractionSelected] = useState<number | null>(null); // v5.1: 객관식
  const [distractionCorrect, setDistractionCorrect] = useState(0);
  const [distractionCountdown, setDistractionCountdown] = useState(15); // 15초

  // 마트 손 커서 상태 (오른손 한손만 사용)
  const [handCursor, setHandCursor] = useState<{ x: number; y: number } | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [grabbedItem, setGrabbedItem] = useState<string | null>(null);
  const hoverStartRef = useRef<number>(0);
  const HOVER_GRAB_MS = 3000; // 3초 호버 → 바로 담기
  const shoppingContainerRef = useRef<HTMLDivElement>(null);

  // 가격 계산 퀴즈 state — v5.0: 주관식 입력
  const [mathQuizPhase, setMathQuizPhase] = useState<'none' | 'quiz' | 'answered'>('none');
  const [mathCorrectAnswer, setMathCorrectAnswer] = useState(0);
  const [mathPriceItems, setMathPriceItems] = useState<typeof MART_ITEMS>([]); // v5.0: 합산 대상 3개
  const [mathInputValue, setMathInputValue] = useState(''); // v5.0: 주관식 입력
  const [mathIsCorrect, setMathIsCorrect] = useState<boolean | null>(null);
  const [mathTimeLeft, setMathTimeLeft] = useState(30);

  // Calibration state
  const [calibrationStatus, setCalibrationStatus] = useState<Record<string, boolean>>({});
  const [calibrationReady, setCalibrationReady] = useState(false);
  const calibrationTimerRef = useRef<number>(0);
  const CALIBRATION_HOLD_SEC = 2; // 2초 유지

  // Hand check state (캘리브레이션 후 손 인식 확인)
  const [handCheckStep, setHandCheckStep] = useState<'right' | 'left' | 'done'>('right');
  const [rightHandChecked, setRightHandChecked] = useState(false);
  const [leftHandChecked, setLeftHandChecked] = useState(false);
  const handCheckHoldRef = useRef<number>(0);
  const HAND_CHECK_HOLD_MS = 1000; // 1초 유지하면 인식 확인

  // Common
  const [resultData, setResultData] = useState<BrainTestData>({});
  const poseRef = useRef<poseDetection.Pose | null>(null);

  // Initialize camera (반응속도 테스트만 사용)
  useEffect(() => {
    if (testType === AssessmentStep.BRAIN_MEMORY) {
      setCameraReady(true); // 마트 테스트는 카메라 불필요
      return;
    }
    const initCamera = async () => {
      try {
        let stream: MediaStream | null = null;
        try {
          const constraints: MediaStreamConstraints = {
            video: preferredCameraId 
              ? { deviceId: { exact: preferredCameraId }, width: { ideal: 1280 }, height: { ideal: 720 } }
              : { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
          };
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
          console.warn('Primary camera constraints failed, trying fallback 1 (no resolution)...', e);
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: preferredCameraId
                ? { deviceId: { exact: preferredCameraId } }
                : { facingMode: facingMode }
            });
          } catch (e2) {
            console.warn("Fallback 1 failed, trying fallback 2 (basic video)...", e2);
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          }
        }
        
        if (!stream) throw new Error("Failed to acquire camera stream");
        
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => setCameraReady(true);
        }
      } catch (e) {
        console.error('Camera init failed:', e);
        alert(`Could not start camera: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    };
    initCamera();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [preferredCameraId, testType, facingMode, retryCount]);

  // Initialize pose detector (반응속도 테스트만 사용)
  useEffect(() => {
    if (testType === AssessmentStep.BRAIN_MEMORY) return;
    const initDetector = async () => {
      try {
        if ((window as any).__poseDetector) {
          setDetector((window as any).__poseDetector);
          return;
        }
        await tf.ready();
        
        // ★ iGPU 호환성 플래그 (Brain Test)
        try { tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0); } catch {}
        try { tf.env().set('WEBGL_USE_SHAPES_UNIFORMS', false); } catch {}
        try { tf.env().set('WEBGL_FLUSH_THRESHOLD', -1); } catch {}
        
        // ★ WASM 경로 매핑 (vite-plugin-static-copy를 통해 복사된 파일 활용)
        try {
          const { setWasmPaths } = await import('@tensorflow/tfjs-backend-wasm');
          setWasmPaths('./wasm/');
        } catch (e) {}

        const det = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
        );
        (window as any).__poseDetector = det;
        setDetector(det);
      } catch (e) {
        console.error('Detector init failed:', e);
      }
    };
    initDetector();
  }, [testType]);

  // Pose detection loop - runs during calibration, handcheck, and playing phases
  useEffect(() => {
    if (!cameraReady || !detector || (phase !== 'playing' && phase !== 'calibration' && phase !== 'handcheck')) return;
    let running = true;

    const detect = async () => {
      if (!running || !videoRef.current || videoRef.current.readyState < 2) {
        if (running) animFrameRef.current = requestAnimationFrame(detect);
        return;
      }
      try {
        let currentPoses: poseDetection.Pose[] = [];
        if (offCanvasRef.current && videoRef.current) {
          const video = videoRef.current;
          // 최대 256 크기로 다운스케일 (GPU/WASM 과부하 방지)
          const scaleFactor = 256 / Math.max(video.videoWidth, video.videoHeight);
          const targetW = Math.round(video.videoWidth * scaleFactor);
          const targetH = Math.round(video.videoHeight * scaleFactor);
          
          offCanvasRef.current.width = targetW;
          offCanvasRef.current.height = targetH;
          
          const offCtx = offCanvasRef.current.getContext('2d', { willReadFrequently: true });
          if (offCtx) {
            offCtx.drawImage(video, 0, 0, targetW, targetH);
          }
          
          currentPoses = await detector.estimatePoses(offCanvasRef.current);
          
          // 원래 좌표계로 복구
          if (currentPoses.length > 0) {
            currentPoses[0].keypoints.forEach(kp => {
              kp.x = kp.x / scaleFactor;
              kp.y = kp.y / scaleFactor;
            });
          }
        }
        
        const poses = currentPoses;
        
        // ★ iGPU WebGL 실패 감지 및 WASM 자동 전환 (BrainTestModule)
        const hasValidKeypoints = poses.length > 0 && poses[0].keypoints.some(kp => (kp.score || 0) > 0.3);
        if (!hasValidKeypoints) {
          (window as any).__brainWebglFailCount = ((window as any).__brainWebglFailCount || 0) + 1;
          if ((window as any).__brainWebglFailCount > 10 && tf.getBackend() !== 'wasm') {
            console.warn('[BrainTest] 연속된 WebGL 인식 실패 감지. WASM 백엔드로 영구 전환합니다.');
            try {
              await tf.setBackend('wasm');
              await tf.ready();
            } catch (e) {
              await tf.setBackend('cpu');
              await tf.ready();
            }
            (window as any).__brainWebglFailCount = 0;
            
            // ★ 백엔드가 변경되었으므로 기존 WebGL 텐서를 물고 있는 detector 폐기 및 재생성
            try {
              const newDet = await poseDetection.createDetector(
                poseDetection.SupportedModels.MoveNet,
                { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
              );
              (window as any).__poseDetector = newDet;
              setDetector(newDet);
            } catch (err) {
              console.error('Failed to recreate detector:', err);
            }
            // setDetector가 상태를 바꾸면 useEffect가 재실행되므로 현재 루프는 종료
            return;
          }
        } else {
          if (tf.getBackend() !== 'wasm') {
            (window as any).__brainWebglFailCount = 0;
          }
        }

        if (poses.length > 0) {
          poseRef.current = poses[0];
          
          // 캘리브레이션 중이면 키포인트 상태 업데이트
          if (phase === 'calibration') {
            updateCalibrationStatus(poses[0]);
          }
          
          // 손 인식 확인 중이면 스켈레톤 표시
          if (phase === 'handcheck') {
            drawSkeleton(poses[0]);
          }
          
          // 마트 게임 중 손 커서 업데이트
          if (phase === 'playing' && testType === AssessmentStep.BRAIN_MEMORY && martPhase === 'shopping') {
            updateHandCursor(poses[0]);
          }
        }
      } catch (e) {
        // Ignore pose detection errors
      }
      await new Promise(r => setTimeout(r, 0));
      if (running) {
        // 반응속도 테스트 진행 중일 때는 지연시간을 20ms(약 50FPS)로 최소화하여 정확도 극대화
        const isReactionTesting = (testType === ('BRAIN_REACTION' as any) && phase === 'playing');
        const delay = isReactionTesting ? 20 : 150;
        
        setTimeout(() => {
          if (running) animFrameRef.current = requestAnimationFrame(detect);
        }, delay);
      }
    };
    
    animFrameRef.current = requestAnimationFrame(detect);
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [cameraReady, detector, phase, martPhase, testType]);

  // Countdown handler
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) {
      setPhase('playing');
      return;
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, countdown]);

  // Capture screenshot for result
  const captureFrame = useCallback((): string => {
    if (!videoRef.current) return '';
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
    }
    return canvas.toDataURL('image/jpeg', 0.7);
  }, []);

  // Helper: get keypoint by name
  const getKp = (name: string) => {
    if (!poseRef.current) return null;
    const kp = poseRef.current.keypoints.find(k => k.name === name);
    return kp && (kp.score || 0) > 0.3 ? kp : null;
  };

  // Helper: Check if SPECIFIC hand is raised (wrist above shoulder)
  const isRightHandRaised = (): boolean => {
    const rw = getKp('right_wrist');
    const rs = getKp('right_shoulder');
    if (!rs || !rw) return false;
    return rw.y < rs.y - 30;
  };

  const isLeftHandRaised = (): boolean => {
    const lw = getKp('left_wrist');
    const ls = getKp('left_shoulder');
    if (!ls || !lw) return false;
    return lw.y < ls.y - 30;
  };

  const isAnyHandRaised = (): boolean => isRightHandRaised() || isLeftHandRaised();

  // ============== CALIBRATION ==============
  const REQUIRED_KEYPOINTS: Record<string, string> = {
    'nose': 'Face',
    'left_shoulder': 'L Shoulder',
    'right_shoulder': 'R Shoulder',
    'left_wrist': 'L Hand',
    'right_wrist': 'R Hand',
  };

  // 교차/마트 테스트에서는 추가 키포인트도 확인
  const OPTIONAL_KEYPOINTS: Record<string, string> = {
    'left_hip': 'L Hip',
    'right_hip': 'R Hip',
    'left_knee': 'L Knee',
    'right_knee': 'R Knee',
  };

  const updateCalibrationStatus = (pose: poseDetection.Pose) => {
    const status: Record<string, boolean> = {};
    const allKeypoints = { ...REQUIRED_KEYPOINTS, ...OPTIONAL_KEYPOINTS };
    
    for (const kpName of Object.keys(allKeypoints)) {
      const kp = pose.keypoints.find(k => k.name === kpName);
      status[kpName] = !!(kp && (kp.score || 0) > 0.3);
    }
    
    setCalibrationStatus(status);
    
    // 필수 키포인트가 모두 감지되면 준비 완료
    const requiredReady = Object.keys(REQUIRED_KEYPOINTS).every(k => status[k]);
    if (requiredReady && !calibrationReady) {
      setCalibrationReady(true);
    } else if (!requiredReady) {
      setCalibrationReady(false);
      calibrationTimerRef.current = 0;
    }

    // 캘리브레이션 중에 스켈레톤 그리기
    drawSkeleton(pose);
  };

  const drawSkeleton = (pose: poseDetection.Pose) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 본(bone) 라인 그리기
    const connections = [
      ['left_shoulder', 'right_shoulder'],
      ['left_shoulder', 'left_elbow'],
      ['left_elbow', 'left_wrist'],
      ['right_shoulder', 'right_elbow'],
      ['right_elbow', 'right_wrist'],
      ['left_shoulder', 'left_hip'],
      ['right_shoulder', 'right_hip'],
      ['left_hip', 'right_hip'],
      ['left_hip', 'left_knee'],
      ['right_hip', 'right_knee'],
    ];

    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
    
    for (const [a, b] of connections) {
      const kpA = pose.keypoints.find(k => k.name === a);
      const kpB = pose.keypoints.find(k => k.name === b);
      if (kpA && kpB && (kpA.score || 0) > 0.3 && (kpB.score || 0) > 0.3) {
        ctx.beginPath();
        ctx.moveTo(kpA.x, kpA.y);
        ctx.lineTo(kpB.x, kpB.y);
        ctx.stroke();
      }
    }
    
    // 키포인트 점 그리기
    for (const kp of pose.keypoints) {
      if ((kp.score || 0) > 0.3) {
        const isRequired = kp.name && kp.name in REQUIRED_KEYPOINTS;
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, isRequired ? 8 : 5, 0, 2 * Math.PI);
        ctx.fillStyle = isRequired ? 'rgba(16, 185, 129, 0.9)' : 'rgba(99, 102, 241, 0.7)';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  };

  // 캘리브레이션 - 안정 유지 체크
  useEffect(() => {
    if (phase !== 'calibration' || !calibrationReady) return;
    
    const startTime = performance.now();
    calibrationTimerRef.current = 0;
    
    const interval = setInterval(() => {
      if (!calibrationReady) {
        calibrationTimerRef.current = 0;
        return;
      }
      
      calibrationTimerRef.current = (performance.now() - startTime) / 1000;
      
      if (calibrationTimerRef.current >= CALIBRATION_HOLD_SEC) {
        clearInterval(interval);
        
        // 반응속도 테스트인 경우 → 손 인식 확인 단계로
        if (testType === ('BRAIN_REACTION' as any)) {
          speak("Pose detection completed. Now verifying hand detection. Please raise your right hand.");
          setHandCheckStep('right');
          setRightHandChecked(false);
          setLeftHandChecked(false);
          setPhase('handcheck');
        } else {
          // 다른 테스트는 바로 카운트다운
          speak("Pose detection completed. Starting in 3 seconds.");
          setCountdown(3);
          setPhase('countdown');
        }
      }
    }, 200);
    
    return () => clearInterval(interval);
  }, [phase, calibrationReady]);

  // ============== HAND CHECK (손 인식 확인) ==============
  useEffect(() => {
    if (phase !== 'handcheck') return;
    
    const checkInterval = setInterval(() => {
      const now = performance.now();
      
      if (handCheckStep === 'right') {
        if (isRightHandRaised()) {
          if (handCheckHoldRef.current === 0) handCheckHoldRef.current = now;
          if (now - handCheckHoldRef.current >= HAND_CHECK_HOLD_MS) {
            setRightHandChecked(true);
            handCheckHoldRef.current = 0;
            speak("Right hand detected! Now raise your left hand.");
            setHandCheckStep('left');
          }
        } else {
          handCheckHoldRef.current = 0;
        }
      } else if (handCheckStep === 'left') {
        if (isLeftHandRaised()) {
          if (handCheckHoldRef.current === 0) handCheckHoldRef.current = now;
          if (now - handCheckHoldRef.current >= HAND_CHECK_HOLD_MS) {
            setLeftHandChecked(true);
            handCheckHoldRef.current = 0;
            speak("Both hands detected! Starting in 3 seconds.");
            setHandCheckStep('done');
            // 1초 후 카운트다운 시작
            setTimeout(() => {
              setCountdown(3);
              setPhase('countdown');
            }, 1000);
          }
        } else {
          handCheckHoldRef.current = 0;
        }
      }
    }, 100);
    
    return () => clearInterval(checkInterval);
  }, [phase, handCheckStep]);

  // ============== REACTION SPEED TEST (점진적 난이도 12회) ==============
  const REACTION_TOTAL = 12;
  // 초록(오른손), 파란(왼손), 빨간(억제), 흰색(양손)
  const REACTION_SEQUENCE: Array<'green' | 'blue' | 'red' | 'white'> = [
    'green', 'blue', 'green', 'red', // Easy (0-3)
    'blue', 'red', 'green', 'white',   // Medium (4-7)
    'red', 'white', 'blue', 'red' // Hard (8-11)
  ];

  useEffect(() => {
    if (testType !== ('BRAIN_REACTION' as any) || phase !== 'playing') return;
    if (reactionRound >= REACTION_TOTAL) {
      // Test complete
      const avgTime = reactionTimes.length > 0 
        ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
        : 999;
      const data: BrainTestData = { reactionTimeMs: avgTime, reactionErrors };
      setResultData(data);
      setPhase('result');
      return;
    }

    // Start next round after delay
    const delay = 1500 + Math.random() * 2000; // 1.5-3.5s random delay
    setSignalColor('none');
    setSignalDirection('none');
    waitingForResponseRef.current = false;

    const timer = setTimeout(() => {
      const color = REACTION_SEQUENCE[reactionRound];
      setSignalColor(color);
      
      let dir: 'left' | 'right' | 'both' | 'none' = 'none';
      if (reactionRound < 4) {
        // Easy: direction matches color exactly
        if (color === 'green') dir = 'right';
        else if (color === 'blue') dir = 'left';
        else if (color === 'white') dir = 'both';
      } else if (reactionRound < 8) {
        // Medium: random direction (Stroop) but keep it simple
        if (color === 'red') {
           const dirs: Array<'left'|'right'|'none'> = ['left', 'right', 'none'];
           dir = dirs[Math.floor(Math.random() * dirs.length)];
        } else {
           const dirs: Array<'left'|'right'> = ['left', 'right'];
           dir = dirs[Math.floor(Math.random() * dirs.length)];
        }
      } else {
        // Hard: Stroop with 'both'
        if (color === 'red') {
           const dirs: Array<'left'|'right'|'none'> = ['left', 'right', 'none'];
           dir = dirs[Math.floor(Math.random() * dirs.length)];
        } else if (color === 'white') {
           const dirs: Array<'left'|'right'|'both'> = ['left', 'right', 'both'];
           dir = dirs[Math.floor(Math.random() * dirs.length)];
        } else {
           const dirs: Array<'left'|'right'> = ['left', 'right'];
           dir = dirs[Math.floor(Math.random() * dirs.length)];
        }
      }
      setSignalDirection(dir);

      signalTimeRef.current = performance.now();
      waitingForResponseRef.current = true;
      
      if (color === 'green') {
        setReactionMessage('Green! Raise Right Hand! 🟢');
      } else if (color === 'blue') {
        setReactionMessage('Blue! Raise Left Hand! 🔵');
      } else if (color === 'white') {
        setReactionMessage('White! Raise Both Hands! ⚪');
      } else {
        setReactionMessage('Red! Freeze (Do Not Move)! 🔴');
      }

      // Auto-advance red signals after 2s
      if (color === 'red') {
        setTimeout(() => {
          if (waitingForResponseRef.current) {
            waitingForResponseRef.current = false;
            setReactionRound(r => r + 1);
            setReactionMessage('Good job! ✅');
          }
        }, 2000);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [testType, phase, reactionRound]);

  // Detect hand raise for reaction test
  useEffect(() => {
    if (testType !== ('BRAIN_REACTION' as any) || phase !== 'playing') return;
    
    const checkInterval = setInterval(() => {
      if (!waitingForResponseRef.current) return;
      
      const rightUp = isRightHandRaised();
      const leftUp = isLeftHandRaised();
      
      const responseTime = performance.now() - signalTimeRef.current;

      if (!rightUp && !leftUp) {
        return; // 아무 손도 안 들었으면 대기
      }
      
      if (signalColor === 'green') {
        waitingForResponseRef.current = false;
        if (rightUp && !leftUp) {
          setReactionTimes(prev => [...prev, responseTime]);
          setReactionMessage(`${Math.round(responseTime)}ms! Right Hand Correct! 👍`);
          setReactionFlash('correct');
        } else {
          setReactionErrors(e => e + 1);
          setReactionMessage('❌ Wrong! Green = Right hand!');
          setReactionFlash('wrong');
          speak('Wrong');
        }
      } else if (signalColor === 'blue') {
        waitingForResponseRef.current = false;
        if (leftUp && !rightUp) {
          setReactionTimes(prev => [...prev, responseTime]);
          setReactionMessage(`${Math.round(responseTime)}ms! Left Hand Correct! 👍`);
          setReactionFlash('correct');
        } else {
          setReactionErrors(e => e + 1);
          setReactionMessage('❌ Wrong! Blue = Left hand!');
          setReactionFlash('wrong');
          speak('Wrong');
        }
      } else if (signalColor === 'white') {
        if (leftUp && rightUp) {
          waitingForResponseRef.current = false;
          setReactionTimes(prev => [...prev, responseTime]);
          setReactionMessage(`${Math.round(responseTime)}ms! Both Hands Correct! 🙌`);
          setReactionFlash('correct');
        } else if (responseTime > 2000) {
          waitingForResponseRef.current = false;
          setReactionErrors(e => e + 1);
          setReactionMessage('❌ Wrong! White = Both hands!');
          setReactionFlash('wrong');
          speak('Wrong');
        } else {
          return; // 한 손만 들었으면 2초까지 대기
        }
      } else if (signalColor === 'red') {
        waitingForResponseRef.current = false;
        setReactionErrors(e => e + 1);
        setReactionMessage('❌ Wrong! Do not move on Red!');
        setReactionFlash('wrong');
        speak('Wrong');
      }
      
      if (!waitingForResponseRef.current) {
        setTimeout(() => {
          setReactionFlash('none');
          setReactionRound(r => r + 1);
        }, 1200);
      }
    }, 20); // 100ms -> 20ms로 변경하여 반응속도 오차 최소화

    return () => clearInterval(checkInterval);
  }, [testType, phase, signalColor]);

  // ============== CROSS-BODY TEST (무릎 포함) ==============
  const CROSS_TOTAL = 6;
  const shuffledCross = useRef<typeof CROSS_INSTRUCTIONS>([]);
  const crossDetectionStartRef = useRef<number>(0); // 감지 활성화 시점
  const crossHoldStartRef = useRef<number>(0); // 유지 시작 시점
  const CROSS_HOLD_MS = 300; // 300ms 유지 필요
  const CROSS_DETECT_DELAY = 2000; // 라운드 시작 후 2초 대기

  // 캘리브레이션에서 감지된 키포인트 기반으로 교차 지시 필터링
  // 무릎 동작이 최소 2회 포함되도록 보장
  const getFilteredCrossInstructions = () => {
    const filtered = CROSS_INSTRUCTIONS.filter(inst => {
      if (inst.target === 'head') return true; // 머리는 항상 포함
      return calibrationStatus[inst.target] !== false;
    });
    return filtered;
  };

  const ensureKneeInstructions = (instructions: typeof CROSS_INSTRUCTIONS, count: number): typeof CROSS_INSTRUCTIONS => {
    const kneeInsts = instructions.filter(i => i.target.includes('knee'));
    const nonKneeInsts = instructions.filter(i => !i.target.includes('knee'));
    
    if (kneeInsts.length === 0) return instructions.slice(0, count);
    
    // 무릎 동작 2개 보장 + 나머지 랜덤
    const selectedKnee = kneeInsts.sort(() => Math.random() - 0.5).slice(0, Math.min(2, kneeInsts.length));
    const remainingCount = count - selectedKnee.length;
    const selectedOther = nonKneeInsts.sort(() => Math.random() - 0.5).slice(0, remainingCount);
    
    return [...selectedKnee, ...selectedOther].sort(() => Math.random() - 0.5);
  };

  useEffect(() => {
    // BRAIN_CROSS removed, do not run cross instructions in other tests
    if (testType !== 'BRAIN_CROSS' as any || phase !== 'playing') return;
    
    if (shuffledCross.current.length === 0) {
      const filtered = getFilteredCrossInstructions();
      shuffledCross.current = ensureKneeInstructions(filtered, CROSS_TOTAL);
    }

    if (crossRound >= CROSS_TOTAL) {
      const accuracy = Math.round((crossCorrect / CROSS_TOTAL) * 100);
      const avgTime = crossTimes.length > 0
        ? Math.round(crossTimes.reduce((a, b) => a + b, 0) / crossTimes.length)
        : 999;
      const data: BrainTestData = { crossAccuracy: accuracy, crossAvgTimeMs: avgTime };
      setResultData(data);
      setPhase('result');
      return;
    }

    const instruction = shuffledCross.current[crossRound];
    setCrossInstruction(instruction.text);
    crossDetectedRef.current = false;
    crossHoldStartRef.current = 0;
    setCrossMessage('준비하세요...');

    // TTS로 지시 안내 (다른 테스트에서는 묵음 처리)
    speak(instruction.ttsText);

    // 감지 시작 시점 = 현재 + 2초 (TTS 안내 후 준비 시간)
    const detectStart = performance.now() + CROSS_DETECT_DELAY;
    crossDetectionStartRef.current = detectStart;
    crossTimeRef.current = detectStart; // 반응시간도 감지 시작 후부터 측정

    // 2초 후 안내 메시지 변경
    const readyTimer = setTimeout(() => {
      if (!crossDetectedRef.current) {
        setCrossMessage('지시대로 동작하세요!');
      }
    }, CROSS_DETECT_DELAY);

    // Timeout after 8 seconds (감지 대기 2초 + 동작 6초)
    const timer = setTimeout(() => {
      if (!crossDetectedRef.current) {
        setCrossMessage('시간 초과! ⏰');
        setTimeout(() => setCrossRound(r => r + 1), 1500);
      }
    }, CROSS_DETECT_DELAY + 6000);

    return () => {
      clearTimeout(timer);
      clearTimeout(readyTimer);
    };
  }, [testType, phase, crossRound]);

  // Detect cross-body gesture
  useEffect(() => {
    if (testType !== 'BRAIN_CROSS' as any || phase !== 'playing') return;
    
    const checkInterval = setInterval(() => {
      if (crossDetectedRef.current || crossRound >= CROSS_TOTAL) return;
      if (!poseRef.current || shuffledCross.current.length === 0) return;

      // 감지 대기 시간 체크
      const now = performance.now();
      if (now < crossDetectionStartRef.current) return;

      const instruction = shuffledCross.current[crossRound];
      if (!instruction) return;

      // 양쪽 어깨로 몸 중심선 계산
      const ls = getKp('left_shoulder');
      const rs = getKp('right_shoulder');
      if (!ls || !rs) return;
      const bodyCenterX = (ls.x + rs.x) / 2;
      const shoulderWidth = Math.abs(ls.x - rs.x);

      const handKp = instruction.hand === 'right' ? getKp('right_wrist') : getKp('left_wrist');
      if (!handKp) {
        crossHoldStartRef.current = 0;
        return;
      }

      // 교차 동작: 손이 몸 중심선을 넘었는지만 체크
      let isCrossed = false;
      if (instruction.target === 'head') {
        const nose = getKp('nose');
        if (nose && handKp.y < nose.y - shoulderWidth * 0.2) {
          isCrossed = true;
        }
      } else {
        if (instruction.hand === 'right') {
          isCrossed = handKp.x > bodyCenterX - shoulderWidth * 0.1;
        } else {
          isCrossed = handKp.x < bodyCenterX + shoulderWidth * 0.1;
        }
      }

      if (!isCrossed) {
        crossHoldStartRef.current = 0;
        return;
      }

      // 타겟 근접 확인 (거리 기반)
      let targetKp: ReturnType<typeof getKp> = null;
      if (instruction.target === 'head') {
        targetKp = getKp('nose');
      } else {
        targetKp = getKp(instruction.target);
      }

      // 타겟 키포인트가 없어도 교차만 되면 인정
      let isClose = false;
      if (targetKp) {
        const dist = Math.sqrt(
          Math.pow(handKp.x - targetKp.x, 2) + Math.pow(handKp.y - targetKp.y, 2)
        );
        const dynamicThreshold = Math.max(shoulderWidth * 1.0, 100);
        isClose = dist < dynamicThreshold;
      } else {
        if (instruction.target.includes('hip')) {
          const shoulderY = (ls.y + rs.y) / 2;
          isClose = handKp.y > shoulderY;
        } else if (instruction.target.includes('knee')) {
          const shoulderY = (ls.y + rs.y) / 2;
          isClose = handKp.y > shoulderY + shoulderWidth * 0.5;
        } else if (instruction.target.includes('shoulder')) {
          const shoulderY = (ls.y + rs.y) / 2;
          isClose = Math.abs(handKp.y - shoulderY) < shoulderWidth * 0.8;
        } else {
          isClose = true;
        }
      }

      if (isClose) {
        if (crossHoldStartRef.current === 0) {
          crossHoldStartRef.current = now;
        }
        const holdDuration = now - crossHoldStartRef.current;
        
        if (holdDuration >= CROSS_HOLD_MS) {
          crossDetectedRef.current = true;
          const responseTime = now - crossTimeRef.current;
          setCrossCorrect(c => c + 1);
          setCrossTimes(prev => [...prev, responseTime]);
          setCrossMessage(`정확! ${Math.round(responseTime)}ms ✅`);
          speak('정확합니다!');
          setTimeout(() => setCrossRound(r => r + 1), 1500);
        }
      } else {
        crossHoldStartRef.current = 0;
      }
    }, 150);

    return () => clearInterval(checkInterval);
  }, [testType, phase, crossRound]);

  // ============== MART SHOPPING GAME (오른손 한손 기반) ==============
  
  // 손 좌표 → 화면 좌표 변환 (오른손만)
  const updateHandCursor = (pose: poseDetection.Pose) => {
    const container = shoppingContainerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;
    const rw = pose.keypoints.find(k => k.name === 'right_wrist');
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (rw && (rw.score || 0) > 0.3) {
      setHandCursor({ x: (1 - rw.x / vw) * cw, y: (rw.y / vh) * ch });
    } else {
      setHandCursor(null);
    }
  };

  // 손 커서 호버 감지 → 아이템 잡기 → 장바구니 넣기 (한손)
  useEffect(() => {
    if (testType !== AssessmentStep.BRAIN_MEMORY || phase !== 'playing' || martPhase !== 'shopping') return;
    const container = shoppingContainerRef.current;
    if (!container || !handCursor) {
      setHoveredItem(null);
      hoverStartRef.current = 0;
      return;
    }

    // 아이템 영역 충돌 감지
    const itemElements = container.querySelectorAll('[data-item-id]');
    let foundHover: string | null = null;
    const containerRect = container.getBoundingClientRect();
    itemElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const relX = rect.left - containerRect.left + rect.width / 2;
      const relY = rect.top - containerRect.top + rect.height / 2;
      const dx = handCursor.x - relX;
      const dy = handCursor.y - relY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // 충돌 판정 영역 약간 넉넉하게
      if (dist < Math.max(rect.width, rect.height) * 0.7) {
        const itemId = el.getAttribute('data-item-id');
        if (itemId && !cartItemsRef.current.includes(itemId)) {
          foundHover = itemId;
        }
      }
    });

    if (foundHover) {
      if (hoveredItem !== foundHover) {
        setHoveredItem(foundHover);
        hoverStartRef.current = performance.now();
      } else {
        const hoverDuration = performance.now() - hoverStartRef.current;
        if (hoverDuration >= HOVER_GRAB_MS) {
          // 3초 도달 시 즉시 장바구니에 담기
          if (!cartItemsRef.current.includes(foundHover) && cartItemsRef.current.length < MART_ITEMS_TO_REMEMBER) {
            setCartItems(prev => prev.includes(foundHover!) ? prev : [...prev, foundHover!]);
            const item = MART_ITEMS.find(i => i.id === foundHover);
            speak(`Added ${item?.name} to cart.`);
            setLastAddedItem(foundHover);
            setTimeout(() => setLastAddedItem(null), 600);
          }
          setHoveredItem(null);
          hoverStartRef.current = 0;
        }
      }
    } else {
      // 영역 밖으로 나가면 즉시 초기화 (잘못 잡았을 때 손 펴기/이동하기 효과)
      setHoveredItem(null);
      hoverStartRef.current = 0;
    }
  }, [handCursor, grabbedItem, hoveredItem, martPhase, testType, phase]);

  // 마트 게임 초기화
  useEffect(() => {
    if (testType !== AssessmentStep.BRAIN_MEMORY || phase !== 'playing') return;
    
    if (martPhase === 'showing' && martItemsToRemember.length === 0) {
      startMartRound();
    }
  }, [testType, phase]);

  const startMartRound = () => {
    const shuffled = [...MART_ITEMS].sort(() => Math.random() - 0.5);
    const toRemember = shuffled.slice(0, MART_ITEMS_TO_REMEMBER);
    const shelfItems = [...shuffled].sort(() => Math.random() - 0.5); // 24개 전부 진열
    
    // v5.1: 8개 중 랜덤 4개만 가격 표시
    const priceVisible = [...toRemember].sort(() => Math.random() - 0.5).slice(0, 4).map(i => i.id);
    setMartPriceVisibleIds(priceVisible);
    
    setMartItemsToRemember(toRemember);
    setMartShelfItems(shelfItems);
    setCartItems([]);
    setMartPhase('showing');
    setMartMessage('');
    
    showMartItems(toRemember);
  };

  // v5.1: 두자리 사칙연산 객관식 문제 생성
  const genSimpleMathQuiz = () => {
    const isAdd = Math.random() > 0.5;
    const a = Math.floor(Math.random() * 60) + 20; // 20~79
    const b = Math.floor(Math.random() * 40) + 15; // 15~54
    const question = isAdd ? `${a} + ${b}` : `${Math.max(a,b)} - ${Math.min(a,b)}`;
    const answer = isAdd ? a + b : Math.max(a,b) - Math.min(a,b);
    const wrongSet = new Set<number>();
    while (wrongSet.size < 3) {
      const off = (Math.floor(Math.random() * 8) + 1) * (Math.random() > 0.5 ? 1 : -1);
      const w = answer + off;
      if (w > 0 && w !== answer) wrongSet.add(w);
    }
    return { question, answer, options: [answer, ...wrongSet].sort(() => Math.random() - 0.5) };
  };

  const showMartItems = (items: typeof MART_ITEMS) => {
    setMartMessage(`🛒 Memorize these ${MART_ITEMS_TO_REMEMBER} items and their prices for 20 seconds!`);
    speak(`Please memorize these 8 items and their prices displayed on the screen for 20 seconds.`);
    setMartShowingCountdown(20); // v5.1: 20초
    const showInterval = setInterval(() => {
      setMartShowingCountdown(prev => {
        if (prev <= 1) {
          clearInterval(showInterval);
          // v5.1: 두자리 사칙연산 객관식 2문제
          const quizzes = [genSimpleMathQuiz(), genSimpleMathQuiz()];
          setDistractionQuizzes(quizzes);
          setDistractionIndex(0);
          setDistractionSelected(null);
          setDistractionCorrect(0);
          setDistractionCountdown(15);
          setMartPhase('distraction');
          setMartMessage('🧠 Try to solve 2 math quizzes in 15 seconds!');
          speak("Now, solve 2 math quizzes in 15 seconds.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // distraction 카운트다운 — v5.0: 15초
  useEffect(() => {
    if (testType !== AssessmentStep.BRAIN_MEMORY || phase !== 'playing' || martPhase !== 'distraction') return;
    const ci = setInterval(() => {
      setDistractionCountdown(prev => {
        if (prev <= 1) {
          clearInterval(ci);
          speak(`Now, select the ${MART_ITEMS_TO_REMEMBER} items you memorized from the shelf.`);
          setMartPhase('shopping');
          setMartMessage(`🛒 Select the ${MART_ITEMS_TO_REMEMBER} items you memorized!`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(ci);
  }, [testType, phase, martPhase]);

  // v5.1: 방해 과제 객관식 답안 선택
  const handleDistractionAnswer = (selected: number) => {
    if (distractionSelected !== null) return;
    setDistractionSelected(selected);
    const quiz = distractionQuizzes[distractionIndex];
    if (selected === quiz.answer) setDistractionCorrect(p => p + 1);
    setTimeout(() => {
      if (distractionIndex < distractionQuizzes.length - 1) {
        setDistractionIndex(p => p + 1);
        setDistractionSelected(null);
        speak("Next quiz.");
      }
    }, 1200);
  };

  useEffect(() => { cartItemsRef.current = cartItems; }, [cartItems]);
  useEffect(() => { martItemsRef.current = martItemsToRemember; }, [martItemsToRemember]);

  // v5.1: 쇼핑 완료 시 가격 퀴즈 — 가격이 보였던 4개의 합산 주관식
  const moveToPriceQuiz = (cc: number) => {
    // 기억 단계에서 가격이 보였던 4개 아이템의 합산
    const priceQuizItems = martItemsRef.current.filter(item => martPriceVisibleIds.includes(item.id));
    const correctPrice = priceQuizItems.reduce((sum, item) => sum + item.price, 0);
    setMathPriceItems(priceQuizItems);
    setMathCorrectAnswer(correctPrice);
    setMathInputValue('');
    setMathIsCorrect(null);
    setMathQuizPhase('quiz');
    setMathTimeLeft(30);
    setMartTotalCorrect(p => p + cc);
    setResultData({ memoryCorrect: cc, memorySpan: cc });
    setMartPhase('priceQuiz');
    
    const isEnglish = true;
    const formattedCorrect = `$${(correctPrice / 1000).toLocaleString()}`;
    
    speak(`Shopping completed. You matched ${cc} out of 8 items. Now, try to guess the total price of the items whose prices were displayed.`);
  };

  useEffect(() => {
    if (testType !== AssessmentStep.BRAIN_MEMORY || phase !== 'playing' || martPhase !== 'shopping') return;
    if (cartItems.length < MART_ITEMS_TO_REMEMBER) return;
    const cc = cartItems.filter(id => martItemsToRemember.some(i => i.id === id)).length;
    moveToPriceQuiz(cc);
  }, [testType, phase, martPhase, cartItems, martItemsToRemember]);

  // 쇼핑 제한시간 60초
  useEffect(() => {
    if (testType !== AssessmentStep.BRAIN_MEMORY || phase !== 'playing' || martPhase !== 'shopping') return;
    setMartTimeLeft(60);
    const ci = setInterval(() => {
      setMartTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(ci);
          const cc = cartItemsRef.current.filter(id => martItemsRef.current.some(i => i.id === id)).length;
          moveToPriceQuiz(cc);
          speak(`Time out! Shopping completed. You matched ${cc} out of 8 items.`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(ci);
  }, [testType, phase, martPhase]);

  useEffect(() => {
    if (mathQuizPhase !== 'quiz') return;
    const mathTimer = setInterval(() => {
      setMathTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(mathTimer);
          setMathQuizPhase('answered');
          setMathIsCorrect(false);
          setResultData(prev => ({ ...prev, mathCorrect: false }));
          speak("Time out.");
          setTimeout(() => setPhase('result'), 2500);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(mathTimer);
  }, [mathQuizPhase]);

  // v5.0: 가격 주관식 제출
  const handleMathSubmit = () => {
    if (mathQuizPhase !== 'quiz' || !mathInputValue.trim()) return;
    setMathQuizPhase('answered');
    
    const isEnglish = true;
    const userPriceRaw = parseInt(mathInputValue);
    const userPrice = userPriceRaw * 1000;
    
    // 오차 ±500원 이내면 정답 처리
    const ok = Math.abs(userPrice - mathCorrectAnswer) <= 500;
    setMathIsCorrect(ok);

    // v5.0 배점 구조: 기억 50점 + 방해과제 15점 + 가격계산 15점 + 속도 10점 + 감점
    const shoppingTime = 60 - martTimeLeft;
    const mathTime = 30 - mathTimeLeft;
    
    const memoryCorrect = resultData.memoryCorrect || 0;
    // 기억력 50점 (8개 만점)
    const memoryScore = (memoryCorrect / MART_ITEMS_TO_REMEMBER) * 50;
    // 방해과제 15점 (2문제)
    const distractionScore = (distractionCorrect / 2) * 15;
    // 가격계산 15점
    const priceScore = ok ? 15 : 0;
    // 속도 보너스/패널티 (최대 ±10점)
    let speedAdjustment = 0;
    if (shoppingTime <= 20) speedAdjustment += 10;
    else if (shoppingTime <= 35) speedAdjustment += 5;
    else if (shoppingTime >= 50) speedAdjustment -= 10;
    if (mathTime <= 8) speedAdjustment += 5;
    else if (mathTime >= 25) speedAdjustment -= 5;
    // 오답 감점: 잘못 고른 물건 수 * -3점
    const wrongPicks = cartItemsRef.current.filter(id => !martItemsRef.current.some(i => i.id === id)).length;
    const wrongPenalty = wrongPicks * -3;
    
    const finalScore = Math.max(0, Math.min(100, Math.round(memoryScore + distractionScore + priceScore + speedAdjustment + wrongPenalty)));

    setResultData(prev => ({ 
      ...prev, 
      mathCorrect: ok, 
      distractionCorrect,
      finalScore,
      shoppingTime,
      mathTime
    }));
    
    const formattedAnswer = `$${(mathCorrectAnswer / 1000).toLocaleString()}`;
      
    speak(ok 
      ? "Correct!" 
      : `Incorrect. The correct answer is ${formattedAnswer}.`);
    setTimeout(() => setPhase('result'), 2500);
  };

  // Handle start
  const handleStart = () => {
    if (testType === AssessmentStep.BRAIN_MEMORY) {
      // 카메라 없이 바로 시작
      setPhase('countdown');
      speak("Starting memory test. Memorize the items and their prices displayed on the screen.");
    } else {
      speak("Starting reaction speed test. Stand in front of the camera and stretch your arms.");
      setPhase('calibration');
    }
  };

  // Handle completion
  const handleComplete = () => {
    const dataUrl = captureFrame();
    // 수동 오답 수정이 있으면 반영
    const finalData = { ...resultData };
    if (testType === ('BRAIN_REACTION' as any) && manualReactionErrors !== '') {
      finalData.reactionErrors = parseInt(manualReactionErrors) || 0;
    }
    onComplete(dataUrl, finalData);
  };

  const getTestTitle = () => {
    switch (testType) {
      case ('BRAIN_REACTION' as any): return { icon: '🧠', title: "Cognitive Reaction Test", subtitle: "Raise the indicated hand depending on color" };
      case AssessmentStep.BRAIN_MEMORY: return { icon: '🛒', title: "Brain Memory Test", subtitle: "Memorize items and prices to test cognitive load" };
      default: return { icon: '🧠', title: "Cognitive Assessment", subtitle: '' };
    }
  };

  const info = getTestTitle();

  // ============ RENDER ============

  const getStepLabel = () => {
    switch (testType) {
      case ('BRAIN_REACTION' as any): return { step: "Brain Test 01", title: "🧠 Cognitive Reaction Test" };

      case AssessmentStep.BRAIN_MEMORY: return { step: "Brain Test 02", title: "Brain Memory Test" };
      default: return { step: '', title: '' };
    }
  };

  const stepLabel = getStepLabel();

  return (
    <div className={`flex-1 flex flex-col p-4 sm:p-6 ${testType === AssessmentStep.BRAIN_MEMORY ? 'overflow-hidden' : 'overflow-hidden'}`}>
      {/* Header - 기존 테스트와 동일한 스타일 */}
      <div className="mb-3 flex justify-between items-center shrink-0">
        <div>
          <span className="text-indigo-600 font-bold text-xs uppercase tracking-widest">{stepLabel.step}</span>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-800">{stepLabel.title}</h3>
        </div>
        <div className="flex items-center gap-3">
          {userInfo && (
            <div className="bg-amber-500/20 border border-amber-500/40 text-amber-700 font-bold text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <span>👤</span>
              <span>{userInfo.name}</span>
              <span className="text-amber-400">|</span>
              <span>{userInfo.gender === 'male' ? 'Male' : 'Female'}</span>
              <span className="text-amber-400">|</span>
              <span>{userInfo.age} yrs</span>
            </div>
          )}
          <button
            onClick={() => setIsPortraitMode(!isPortraitMode)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-colors border border-slate-700"
          >
            <i className={`fas fa-${isPortraitMode ? 'mobile-alt' : 'desktop'}`}></i>
            {isPortraitMode ? 'Portrait' : 'Landscape'}
          </button>
        </div>
      </div>

      {/* Camera + Game Area */}
      <div className={`flex-1 w-full flex justify-center items-center ${testType === AssessmentStep.BRAIN_MEMORY ? 'overflow-hidden' : 'overflow-hidden min-h-0'}`}>
        <div className={`relative w-full overflow-hidden bg-black shadow-2xl transition-all duration-500
          ${testType === AssessmentStep.BRAIN_MEMORY
            ? 'h-[calc(100vh-120px)] rounded-2xl'
            : isPortraitMode ? 'rounded-[2rem] sm:rounded-[2.5rem] max-w-[calc((100vh-280px)*9/16)] aspect-[9/16]' : 'rounded-[2rem] sm:rounded-[2.5rem] max-w-5xl aspect-video mx-auto'}
        `}>
        {/* Camera feed - 반응속도만 표시 */}
        {testType !== AssessmentStep.BRAIN_MEMORY && (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full scale-x-[-1]" />
            
            {/* Camera Switch Toggle Button */}
            {cameraReady && phase !== 'playing' && phase !== 'countdown' && (
              <button
                onClick={toggleCamera}
                className="absolute top-4 right-4 w-12 h-12 bg-black/40 backdrop-blur-md rounded-full text-white flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.3)] border border-cyan-400/30 z-[60] hover:bg-black/60 hover:scale-105 active:scale-95 transition-all pointer-events-auto"
                title="Switch Camera"
              >
                <i className="fas fa-sync-alt text-xl"></i>
              </button>
            )}
          </>
        )}
        {/* 마트 테스트 배경 */}
        {testType === AssessmentStep.BRAIN_MEMORY && (
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900" />
        )}

        {/* Game UI overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center" ref={shoppingContainerRef}>
          
          {/* INTRO PHASE */}
          {phase === 'intro' && (
            <div className="text-center space-y-6 max-w-lg bg-black/60 backdrop-blur-sm rounded-3xl p-10 mx-4">
              <h2 className="text-3xl sm:text-4xl font-black text-white">{info.title}</h2>
              <p className="text-base sm:text-lg text-white/80 font-medium">{info.subtitle}</p>
              
              <div className="text-left space-y-3 text-white/70 text-sm sm:text-base">
                {testType === ('BRAIN_REACTION' as any) && (
                  <>
                    <p>🟢 Green Signal: Raise your Right Hand</p>
                    <p>🔵 Blue Signal: Raise your Left Hand</p>
                    <p>⚪ White Signal: Raise Both Hands</p>
                    <p>🔴 Red Signal: Freeze (Do Not Move)</p>
                    <p className="mt-3 text-amber-300 font-bold bg-amber-500/20 px-3 py-2 rounded-lg">⚠️ If you move during Red or raise the wrong hand, it counts as an error.</p>
                    <p className="mt-1">Total rounds: 12</p>
                  </>
                )}

                {testType === AssessmentStep.BRAIN_MEMORY && (
                  <>
                    <p className="text-base sm:text-lg">🛒 Remember the 8 grocery items and their prices.</p>
                    <p className="text-base sm:text-lg">🧩 Solve the distraction quizzes, and then select the items and guess their total price.</p>
                  </>
                )}
              </div>

              <button
                onClick={handleStart}
                className="w-full py-5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xl sm:text-2xl font-black rounded-2xl shadow-lg hover:scale-[1.02] transition-all"
              >
                Start
              </button>
            </div>
          )}

          {/* CALIBRATION PHASE */}
          {phase === 'calibration' && (
            <div className="absolute inset-0 flex flex-col">
              {/* 상단 안내 */}
              <div className="pt-6 px-4 text-center">
                <div className="bg-black/60 backdrop-blur-sm rounded-2xl p-4 mx-auto max-w-xs">
                  <h3 className="text-white font-black text-lg mb-1">Body Alignment Check</h3>
                  <p className="text-white/70 text-xs">
                    Please align your upper body inside the camera frame.
                  </p>
                </div>
              </div>
              
              {/* 키포인트 상태 표시 */}
              <div className="flex-1" />
              <div className="pb-8 px-4">
                <div className="bg-black/70 backdrop-blur-sm rounded-2xl p-4 mx-auto max-w-xs">
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {Object.entries(REQUIRED_KEYPOINTS).map(([key, label]) => (
                      <div key={key} className={`flex items-center gap-2 text-xs font-bold rounded-lg px-2 py-1.5 ${
                        calibrationStatus[key] 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        <span>{calibrationStatus[key] ? '✅' : '❌'}</span>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* 선택적 키포인트 (교차/마트) */}
                  {testType === AssessmentStep.BRAIN_MEMORY && (
                    <div className="border-t border-white/10 pt-2 mt-2">
                      <p className="text-white/40 text-[10px] font-bold mb-1">Optional Keypoints</p>
                      <div className="grid grid-cols-2 gap-1">
                        {Object.entries(OPTIONAL_KEYPOINTS).map(([key, label]) => (
                          <div key={key} className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-1 rounded ${
                            calibrationStatus[key]
                              ? 'text-emerald-400/70'
                              : 'text-white/30'
                          }`}>
                            <span>{calibrationStatus[key] ? '✅' : '⬜'}</span>
                            <span>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* 상태 메시지 */}
                  <div className="mt-3 text-center">
                    {calibrationReady ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-emerald-400 text-sm font-black">
                          Upper Body Aligned
                        </span>
                      </div>
                    ) : (
                      <span className="text-amber-400 text-sm font-bold animate-pulse">
                        Align all required body parts to start
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* HAND CHECK PHASE — 손 인식 확인 */}
          {phase === 'handcheck' && (
            <div className="absolute inset-0 flex flex-col">
              {/* 상단 안내 */}
              <div className="pt-6 px-4 text-center">
                <div className="bg-black/60 backdrop-blur-sm rounded-2xl p-4 mx-auto max-w-xs">
                  <h3 className="text-white font-black text-lg mb-1">Hand Detection Check</h3>
                  <p className="text-white/70 text-xs">
                    {handCheckStep === 'right' && "Please raise your Right Hand."}
                    {handCheckStep === 'left' && "Please raise your Left Hand."}
                    {handCheckStep === 'done' && "Both Hands Detected!"}
                  </p>
                </div>
              </div>
              
              {/* 중앙 손 아이콘 표시 */}
              <div className="flex-1 flex items-center justify-center">
                <div className="flex gap-12">
                  {/* 왼손 */}
                  <div className={`flex flex-col items-center gap-3 transition-all duration-500 ${
                    handCheckStep === 'left' ? 'scale-125' : 'scale-100'
                  }`}>
                    <div className={`w-24 h-24 rounded-3xl flex items-center justify-center text-5xl transition-all duration-500 ${
                      leftHandChecked 
                        ? 'bg-emerald-500/30 border-2 border-emerald-400 shadow-lg shadow-emerald-500/30' 
                        : handCheckStep === 'left'
                          ? 'bg-blue-500/20 border-2 border-blue-400 animate-pulse shadow-lg shadow-blue-500/20'
                          : 'bg-white/10 border border-white/20'
                    }`}>
                      {leftHandChecked ? '✅' : '🤚'}
                    </div>
                    <span className={`text-sm font-bold ${
                      leftHandChecked ? 'text-emerald-400' : handCheckStep === 'left' ? 'text-blue-400 animate-pulse' : 'text-white/40'
                    }`}>
                      Left Hand: {leftHandChecked ? "Detected" : handCheckStep === 'left' ? "Raise Now" : "Waiting"}
                    </span>
                  </div>

                  {/* 오른손 */}
                  <div className={`flex flex-col items-center gap-3 transition-all duration-500 ${
                    handCheckStep === 'right' ? 'scale-125' : 'scale-100'
                  }`}>
                    <div className={`w-24 h-24 rounded-3xl flex items-center justify-center text-5xl transition-all duration-500 ${
                      rightHandChecked 
                        ? 'bg-emerald-500/30 border-2 border-emerald-400 shadow-lg shadow-emerald-500/30' 
                        : handCheckStep === 'right'
                          ? 'bg-emerald-500/20 border-2 border-emerald-400 animate-pulse shadow-lg shadow-emerald-500/20'
                          : 'bg-white/10 border border-white/20'
                    }`}>
                      {rightHandChecked ? '✅' : '🤚'}
                    </div>
                    <span className={`text-sm font-bold ${
                      rightHandChecked ? 'text-emerald-400' : handCheckStep === 'right' ? 'text-emerald-400 animate-pulse' : 'text-white/40'
                    }`}>
                      Right Hand: {rightHandChecked ? "Detected" : handCheckStep === 'right' ? "Raise Now" : "Waiting"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 하단 상태 */}
              <div className="pb-8 px-4">
                <div className="bg-black/70 backdrop-blur-sm rounded-2xl p-4 mx-auto max-w-xs text-center">
                  {handCheckStep === 'done' ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-emerald-400 text-sm font-black">
                        Detection Completed
                      </span>
                    </div>
                  ) : (
                    <>
                      <p className="text-amber-400 text-xs font-bold mb-2">
                        {handCheckStep === 'right' ? "Hold Right Hand for 1s" : "Hold Left Hand for 1s"}
                      </p>
                      <p className="text-white/40 text-[10px]">
                        If not recognized, adjust camera angle.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}


          {/* COUNTDOWN PHASE */}
          {phase === 'countdown' && (
            <div className="text-center">
              <div className="text-9xl font-black text-white drop-shadow-2xl animate-pulse">{countdown || "Start"}</div>
              <p className="text-xl text-white/80 mt-4 font-bold">Get Ready!</p>
            </div>
          )}

          {/* PLAYING - REACTION (점진적 난이도 10회) */}
          {phase === 'playing' && testType === ('BRAIN_REACTION' as any) && (
            <>
              {/* 오답 시 화면 번첩임 효과 */}
              {reactionFlash === 'wrong' && (
                <div className="absolute inset-0 bg-red-500/30 z-40 animate-pulse pointer-events-none rounded-[2.5rem]" />
              )}
              {reactionFlash === 'correct' && (
                <div className="absolute inset-0 bg-emerald-500/15 z-40 pointer-events-none rounded-[2.5rem]" />
              )}
              <div className="text-center space-y-6">
                <div className="flex justify-center items-center gap-4">
                  <div className="text-sm font-bold text-white/60 uppercase tracking-wider">
                    {reactionRound + 1} / {REACTION_TOTAL}
                  </div>
                  {reactionErrors > 0 && (
                    <div className="bg-red-500/80 text-white text-xs font-black px-3 py-1 rounded-full animate-pulse">
                      Errors: {reactionErrors}
                    </div>
                  )}
                </div>
                
                <div className={`w-40 h-40 rounded-full mx-auto flex items-center justify-center transition-all duration-200 ${
                  signalColor === 'green' ? 'bg-emerald-500 shadow-[0_0_80px_rgba(16,185,129,0.8)]' :
                  signalColor === 'blue' ? 'bg-blue-500 shadow-[0_0_80px_rgba(59,130,246,0.8)]' :
                  signalColor === 'red' ? 'bg-rose-500 shadow-[0_0_80px_rgba(244,63,94,0.8)]' :
                  signalColor === 'white' ? 'bg-white shadow-[0_0_80px_rgba(255,255,255,0.8)]' :
                  'bg-white/20 border-2 border-white/30'
                }`}>
                  <span className="text-5xl">
                    {signalDirection === 'right' ? '👉' : 
                     signalDirection === 'left' ? '👈' : 
                     signalDirection === 'both' ? '🙌' : 
                     signalDirection === 'none' && signalColor === 'red' ? '🚫' : '⏳'}
                  </span>
                </div>

                {/* 좌우 안내 표시 */}
                <div className="flex justify-center gap-8 text-white/50 text-xs font-bold">
                  <span className={signalColor === 'blue' ? 'text-blue-400 scale-125 transition-all' : ''}>👈 Left Hand (Blue)</span>
                  <span className={signalColor === 'green' ? 'text-emerald-400 scale-125 transition-all' : ''}>(Green) Right Hand 👉</span>
                </div>

                <p className={`text-xl font-bold drop-shadow-md ${
                  reactionFlash === 'wrong' ? 'text-red-400 text-2xl' : 
                  reactionFlash === 'correct' ? 'text-emerald-400' : 'text-white'
                }`}>{reactionMessage || "Waiting..."}</p>
              </div>
            </>
          )}

          {/* PLAYING - CROSS */}


          {/* PLAYING - MART SHOPPING GAME (손 커서 기반) */}
          {phase === 'playing' && testType === AssessmentStep.BRAIN_MEMORY && (
            <div className="absolute inset-0 flex flex-col z-20 overflow-auto">
              <div className="relative w-full h-full flex flex-col overflow-visible">
              {/* 상단: 메시지 + 타이머 (showing 단계에서는 아이템 영역에 통합 표시) */}
              <div className={`absolute top-3 inset-x-0 text-center z-50 pointer-events-none ${martPhase === 'showing' ? 'hidden' : ''}`}>
                {martPhase === 'shopping' && (
                  <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 mb-2 font-black text-base sm:text-lg shadow-lg ${
                    martTimeLeft <= 10 
                      ? 'bg-red-500/90 text-white animate-pulse' 
                      : martTimeLeft <= 30 
                      ? 'bg-amber-500/80 text-white' 
                      : 'bg-black/80 text-white'
                  } backdrop-blur-md`}>
                    <span>⏱️</span>
                    <span>{martTimeLeft}s</span>
                  </div>
                )}
                {martPhase !== 'shopping' && (
                  <div>
                    <div className="bg-black/80 backdrop-blur-md rounded-xl px-4 py-2 inline-block shadow-lg border border-white/10">
                      <p className="text-white font-bold text-sm">{martMessage}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* v5.0: 기억하기 단계 — 이미지 전용 + 가격 표시 */}
              {martPhase === 'showing' && (
                <div className={`flex-1 flex flex-col items-center ${isPortraitMode ? 'justify-start pt-4' : 'justify-center'} p-3 sm:p-4 overflow-auto`}>
                  <div className={`w-full ${isPortraitMode ? 'max-w-xl px-3' : 'max-w-4xl px-2 sm:px-4'}`}>
                    {/* 안내 + 타이머 */}
                    <div className={`flex items-center justify-between bg-black/50 backdrop-blur-sm border border-white/10 mb-4 sm:mb-6 rounded-2xl sm:rounded-3xl px-4 sm:px-8 py-3 sm:py-5`}>
                      <span className="text-white font-bold text-sm sm:text-xl">🛒 Memorize the 8 items and their prices</span>
                      <span className={`font-black ml-3 text-xl sm:text-3xl ${martShowingCountdown <= 5 ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`}>
                        ⏱️ {martShowingCountdown}s
                      </span>
                    </div>
                    {/* v5.1: 8개 아이템 그리드 — 이미지 전용, 랜덤 4개만 가격 표시 */}
                    <div className={`grid ${isPortraitMode ? 'grid-cols-2 gap-3' : 'grid-cols-4 gap-3 sm:gap-4'}`}>
                      {martItemsToRemember.map((item, i) => {
                        const showPrice = martPriceVisibleIds.includes(item.id);
                        return (
                          <div key={item.id}
                            className={`flex flex-col items-center justify-center rounded-2xl sm:rounded-3xl border ${showPrice ? 'bg-amber-500/20 border-amber-500/50' : 'bg-slate-700/30 border-white/20'} ${isPortraitMode ? 'px-3 py-4' : 'px-3 sm:px-5 py-3 sm:py-5'}`}>
                            <span className={`${isPortraitMode ? 'text-5xl' : 'text-4xl sm:text-6xl'}`}>{item.emoji}</span>
                            {showPrice ? (
                              <span className={`text-amber-300 font-black mt-2 ${isPortraitMode ? 'text-base' : 'text-sm sm:text-lg'}`}>
                                {`$${(item.price / 1000).toLocaleString()}`}
                              </span>
                            ) : (
                              <span className={`text-white/30 font-bold mt-2 ${isPortraitMode ? 'text-sm' : 'text-xs sm:text-sm'}`}>???</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* v5.1: 방해 과제 15초 — 두자리 객관식 4지선다 2문제 */}
              {martPhase === 'distraction' && distractionQuizzes.length > 0 && (
                <div className="flex-1 flex flex-col items-center justify-center p-4">
                  <div className="bg-indigo-900/80 backdrop-blur-md rounded-3xl border border-indigo-400/50 text-center shadow-[0_0_50px_rgba(79,70,229,0.5)] w-full p-6 sm:p-12 max-w-sm sm:max-w-2xl">
                    <div className="flex justify-between items-center mb-4 sm:mb-6">
                      <h3 className="font-bold text-indigo-200 text-lg sm:text-3xl">🧠 Math Quiz ({distractionIndex + 1}/2)</h3>
                      <div className={`font-black px-3 sm:px-4 py-2 rounded-full text-lg sm:text-3xl ${distractionCountdown <= 3 ? 'bg-red-500/80 text-white animate-pulse' : 'bg-white/10 text-white'}`}>⏱️ {distractionCountdown}s</div>
                    </div>
                    <div className="font-black text-white tracking-wider bg-black/30 py-6 sm:py-8 rounded-2xl border border-white/10 mb-6 sm:mb-8 text-4xl sm:text-7xl">
                      {distractionQuizzes[distractionIndex].question} = ?
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      {distractionQuizzes[distractionIndex].options.map((opt, i) => (
                        <button key={i} onClick={() => handleDistractionAnswer(opt)}
                          disabled={distractionSelected !== null}
                          className={`rounded-2xl font-black transition-all py-4 sm:py-8 text-2xl sm:text-5xl ${
                            distractionSelected !== null
                              ? opt === distractionQuizzes[distractionIndex].answer ? 'bg-emerald-500 text-white scale-105 shadow-xl shadow-emerald-500/50' : opt === distractionSelected ? 'bg-red-500 text-white' : 'bg-white/10 text-white/40'
                              : 'bg-white/15 text-white hover:bg-indigo-500/50 hover:scale-105 active:scale-95'
                          }`}>{opt}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* v5.1: 쇼핑 단계 — 24개 중 8개 선택 */}
              {martPhase === 'shopping' && (
                <div className={`flex-1 flex flex-col relative ${isPortraitMode ? '' : 'pt-14'}`}>
                  {/* Grid Area */}
                  <div className={`flex-1 flex justify-center ${isPortraitMode ? 'items-center' : 'items-start overflow-y-auto px-4 sm:px-6 pb-2 pt-2'}`}>
                    <div className={`grid ${isPortraitMode ? 'grid-cols-4 gap-4 w-[90vw]' : 'w-full grid-cols-4 sm:grid-cols-6 gap-3 sm:gap-4 max-w-4xl'}`}>
                      {martShelfItems.map((item) => {
                        const inCart = cartItems.includes(item.id);
                        return (
                          <button key={item.id} data-item-id={item.id}
                            disabled={cartItems.length >= MART_ITEMS_TO_REMEMBER && !inCart}
                            onClick={() => {
                              if (inCart) {
                                  setCartItems(prev => prev.filter(id => id !== item.id));
                              } else if (cartItems.length < MART_ITEMS_TO_REMEMBER) {
                                  setCartItems(prev => [...prev, item.id]);
                                  setLastAddedItem(item.id);
                                  setTimeout(() => setLastAddedItem(null), 400);
                              }
                            }}
                            className={`relative flex flex-col items-center justify-center rounded-2xl border-2 transition-all duration-200 select-none active:scale-95 ${isPortraitMode ? 'aspect-square' : 'py-4 sm:py-5 px-2'} ${
                              inCart ? 'bg-emerald-500/30 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                              : cartItems.length >= MART_ITEMS_TO_REMEMBER ? 'border-white/10 bg-white/5 opacity-30 cursor-not-allowed'
                              : 'border-white/20 bg-slate-800/80 hover:bg-indigo-500/30 hover:border-indigo-400 active:bg-indigo-500/50 cursor-pointer shadow-lg'
                            }`}>
                            <span className={`transition-transform drop-shadow-xl ${isPortraitMode ? 'text-[4rem]' : 'text-4xl sm:text-5xl'} ${lastAddedItem === item.id ? 'scale-125' : ''}`}>{item.emoji}</span>
                            {inCart && <div className={`absolute bg-emerald-500 rounded-full flex items-center justify-center text-white font-black shadow-xl border-2 border-slate-900 ${isPortraitMode ? '-top-2 -right-2 w-9 h-9 text-base' : '-top-2 -right-2 w-7 h-7 sm:w-8 sm:h-8 text-xs sm:text-sm'}`}>✓</div>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cart Area */}
                  <div className="w-full px-4 sm:px-8 pb-3 sm:pb-4 shrink-0 flex justify-center">
                    <div className="bg-gradient-to-br from-amber-600/40 to-orange-600/40 border-amber-400/50 backdrop-blur-xl rounded-2xl sm:rounded-3xl border-2 p-3 max-w-5xl w-full flex flex-col transition-all">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <span className="text-xl sm:text-2xl">🛒</span>
                        <span className="text-white font-black flex-1 text-base sm:text-lg">Shopping Cart</span>
                        <span className="text-amber-300 font-black text-lg sm:text-xl">{cartItems.length}/{MART_ITEMS_TO_REMEMBER}</span>
                      </div>
                      <div className="w-full h-px bg-white/20 my-2"></div>
                      <div className="flex flex-wrap content-start gap-2 sm:gap-3 items-center justify-center min-h-[50px] sm:min-h-[60px] max-h-[80px] overflow-y-auto overflow-x-hidden">
                        {cartItems.length === 0 ? (
                          <div className="w-full flex flex-col items-center justify-center opacity-40 py-1 gap-1">
                            <span className="text-xl sm:text-2xl">👆</span>
                            <span className="text-white font-bold text-center text-xs sm:text-sm">Touch items to put them in the cart.</span>
                          </div>
                        ) : cartItems.map(id => { 
                          const it = MART_ITEMS.find(i => i.id === id); 
                          return (
                            <button key={id} 
                              onClick={() => setCartItems(prev => prev.filter(x => x !== id))}
                              className="bg-slate-800/80 border border-white/20 rounded-xl sm:rounded-2xl hover:bg-red-500/50 hover:border-red-400 active:scale-95 transition-all cursor-pointer shadow-lg flex items-center justify-center px-2 sm:px-3 py-1 sm:py-1.5"
                            >
                              <span className="text-xl sm:text-2xl drop-shadow-md">{it?.emoji}</span>
                            </button>
                          ); 
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* v5.1: 가격 주관식 퀴즈 — 가격 보였던 4개 물건 합계 입력 */}
              {martPhase === 'priceQuiz' && mathQuizPhase !== 'none' && (
                <div className="flex-1 flex items-center justify-center px-4">
                  <div className="bg-black/80 backdrop-blur-sm rounded-3xl p-8 sm:p-10 max-w-lg w-full text-center">
                    <div className="flex justify-between items-center mb-6">
                      <span className="text-4xl sm:text-5xl">🧮</span>
                      <div className={`text-xl sm:text-2xl font-black px-4 py-2 rounded-full ${mathTimeLeft <= 10 ? 'bg-red-500/80 text-white animate-pulse' : 'bg-white/10 text-white'}`}>⏱️ {mathTimeLeft}s</div>
                    </div>
                    <h3 className="text-white font-black text-xl sm:text-2xl mb-5">Guess the total price of items displayed:</h3>
                    <div className="flex gap-4 justify-center mb-6">
                      {mathPriceItems.map(item => {
                        return (
                          <div key={item.id} className="bg-amber-500/20 rounded-2xl px-4 py-3 flex flex-col items-center border border-amber-500/30">
                            <span className="text-5xl sm:text-6xl">{item.emoji}</span>
                            <span className="text-amber-300/50 font-black text-sm mt-2">
                              ???
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {mathQuizPhase === 'quiz' && (
                      <div className="flex gap-3 items-center justify-center">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={mathInputValue}
                          onChange={e => setMathInputValue(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleMathSubmit()}
                          placeholder="Enter total price (ex: 12)"
                          className="w-48 text-center text-xl font-black bg-white/10 border-2 border-amber-400/50 rounded-2xl py-4 text-white placeholder-white/30 focus:outline-none focus:border-amber-400 focus:bg-white/15 transition-all"
                          autoFocus
                        />
                        <button
                          onClick={handleMathSubmit}
                          disabled={!mathInputValue.trim()}
                          className={`px-6 py-4 rounded-2xl font-black text-lg transition-all ${
                            !mathInputValue.trim() ? 'bg-white/10 text-white/40' : 'bg-amber-500 text-white hover:bg-amber-400 active:scale-95'
                          }`}
                        >Confirm</button>
                      </div>
                    )}
                    {mathQuizPhase === 'answered' && (
                      <div className="mt-3">
                        <p className={`text-xl font-black ${mathIsCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                          {mathIsCorrect 
                            ? "🎉 Correct!" 
                            : `❌ Correct Price: $${(mathCorrectAnswer / 1000).toLocaleString()}`
                          }
                        </p>
                        {!mathIsCorrect && mathInputValue && (() => {
                          const inputValueParsed = parseInt(mathInputValue) || 0;
                          const inputFormatted = `$${inputValueParsed.toLocaleString()}`;
                          const diffFormatted = `$${(Math.abs(inputValueParsed * 1000 - mathCorrectAnswer) / 1000).toLocaleString()}`;
                          return (
                            <p className="text-white/50 text-sm mt-1">
                              Your Input: {inputFormatted} (Difference: {diffFormatted})
                            </p>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              </div>
            </div>
          )}

          {/* RESULT PHASE */}
          {phase === 'result' && (
            <div className="text-center w-full bg-black/60 backdrop-blur-sm rounded-[2rem] shadow-2xl mx-4 max-w-3xl p-5 sm:p-8 space-y-3 max-h-[90vh] overflow-y-auto">
              <div className="text-3xl sm:text-4xl">🧠</div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">Test Completed!</h2>
              
              {testType === ('BRAIN_REACTION' as any) && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-white/10 rounded-2xl p-3">
                    <span className="text-white/60 text-xs font-bold">Avg Reaction Time</span>
                    <div className="text-3xl sm:text-4xl font-black text-white mt-1">{resultData.reactionTimeMs}ms</div>
                  </div>
                  <div className="bg-white/10 rounded-2xl p-3">
                    <span className="text-white/60 text-xs font-bold">AI Measured Errors</span>
                    <div className="text-xl sm:text-2xl font-black text-white mt-1">{resultData.reactionErrors} times</div>
                  </div>
                </div>
              )}

              {testType === AssessmentStep.BRAIN_MEMORY && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="bg-white/10 rounded-2xl p-3">
                    <span className="text-white/60 text-xs font-bold">Memory Accuracy</span>
                    <div className="text-3xl sm:text-4xl font-black text-white mt-1">{resultData.memoryCorrect}/{MART_ITEMS_TO_REMEMBER} item(s)</div>
                    <p className="text-white/40 text-[10px] mt-1 font-bold">Wrong picks: {MART_ITEMS_TO_REMEMBER - (resultData.memoryCorrect || 0)} item(s)</p>
                  </div>
                  <div className={`rounded-2xl p-3 ${(resultData as any).finalScore >= 80 ? 'bg-emerald-500/20 border-2 border-emerald-500/30' : (resultData as any).finalScore >= 50 ? 'bg-amber-500/20 border-2 border-amber-500/30' : 'bg-red-500/20 border-2 border-red-500/30'}`}>
                    <span className="text-white/60 text-xs font-bold">Evaluation</span>
                    <div className="text-2xl sm:text-3xl font-black text-white mt-1">
                      {(resultData as any).finalScore >= 80 
                        ? "🌟 Excellent" 
                        : (resultData as any).finalScore >= 50 
                        ? "👍 Normal" 
                        : "💪 Needs Improvement"
                      }
                    </div>
                    <p className="text-white/50 text-[10px] mt-1 font-bold">Total Score: {(resultData as any).finalScore || 0} pts</p>
                  </div>
                  {(resultData as any).distractionCorrect !== undefined && (
                    <div className="bg-white/10 rounded-2xl p-3">
                      <span className="text-white/60 text-xs font-bold">Math Distraction Score</span>
                      <div className="text-xl font-black text-white mt-1">{(resultData as any).distractionCorrect} / 2 correct</div>
                    </div>
                  )}
                  <div className="bg-white/10 rounded-2xl p-3">
                    <span className="text-white/60 text-xs font-bold">Price Quiz Result</span>
                    <div className="text-xl font-black text-white mt-1">
                      {resultData.mathCorrect 
                        ? "✅ Correct" 
                        : "❌ Incorrect"
                      }
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleComplete}
                className="w-full py-4 mt-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-lg sm:text-xl font-black rounded-2xl shadow-xl hover:scale-[1.02] transition-all"
              >
                Next Step →
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default BrainTestModule;
