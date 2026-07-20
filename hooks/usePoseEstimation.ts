import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import * as poseDetection from '@tensorflow-models/pose-detection';

// Global instance to prevent rapid create/dispose crashes
let globalDetector: poseDetection.PoseDetector | null = null;
let isGlobalDetectorLoading = false;
let globalDetectorPromise: Promise<poseDetection.PoseDetector> | null = null;

export const usePoseEstimation = (
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  isActive: boolean,
  type: 'squat' | 'pushup' | 'balance' | 'front' | 'side' | 'none' | 'arm_raise' | 'flexibility',
  perfInfo?: { poseInterval: number; poseInputSize: number; drawSkeleton: boolean; videoWidth: number; videoHeight: number } | null
) => {
  const [reps, setReps] = useState(0);
  const [footDrops, setFootDrops] = useState(0);
  const [swayScore, setSwayScore] = useState(0);
  const [formPenalty, setFormPenalty] = useState(0);
  const [feedback, setFeedback] = useState<string>('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<'up' | 'down'>('up');
  const repIndicatorRef = useRef<number>(0);
  const balanceStateRef = useRef<{ dropFrames: number, lastNoseX: number, swayPixels: number, isFootDown: boolean }>({ dropFrames: 0, lastNoseX: 0, swayPixels: 0, isFootDown: false });
  const [postureData, setPostureData] = useState<any>(null);
  const [validation, setValidation] = useState<{isValid: boolean, missingParts: string[]}>({isValid: false, missingParts: ['포즈를 감지하는 중입니다.']});
  const [isModelLoaded, setIsModelLoaded] = useState(!!globalDetector);
  
  // 내부 포즈 추정용 다운스케일 캔버스
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const calculateAngle = (a: {x: number, y: number}, b: {x: number, y: number}, c: {x: number, y: number}) => {
    let radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) {
      angle = 360 - angle;
    }
    return angle;
  };

  useEffect(() => {
    let isMounted = true;

    const initModel = async () => {
      if (globalDetector) {
        if (isMounted) setIsModelLoaded(true);
        return;
      }

      if (isGlobalDetectorLoading && globalDetectorPromise) {
        try {
          await globalDetectorPromise;
          if (isMounted) setIsModelLoaded(true);
        } catch (e) {
          console.error("Failed to wait for global detector:", e);
          globalDetectorPromise = null;
          isGlobalDetectorLoading = false;
        }
        return;
      }

      isGlobalDetectorLoading = true;
      globalDetectorPromise = (async () => {
        await tf.ready();
        // [V1.6 AI 성능 리팩토링] WebGL 텍스처 메모리 극한 절약 옵션 부여
        // 0으로 설정하면 불필요한 GPU 텍스처를 묶혀두지 않고 즉시 지움 (크래시 및 발열 방지)
        try {
            tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
        } catch(e) {}
        
        const detectorConfig = { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING };
        const detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, detectorConfig);
        globalDetector = detector;
        return detector;
      })();

      try {
        await globalDetectorPromise;
        if (isMounted) setIsModelLoaded(true);
      } catch (e) {
        console.error("Pose detection init error:", e);
        globalDetectorPromise = null; // 대기 실패 시 재시도를 위해 프로미스 파기
      } finally {
        isGlobalDetectorLoading = false;
      }
    };

    initModel();

    // 초기 다운스케일 캔버스 세팅
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const poseInterval = perfInfo?.poseInterval;
  const poseInputSize = perfInfo?.poseInputSize;
  const drawSkeleton = perfInfo?.drawSkeleton;
  const videoWidth = perfInfo?.videoWidth;
  const videoHeight = perfInfo?.videoHeight;

  useEffect(() => {
    if (!isActive || type === 'none' || !isModelLoaded || !perfInfo) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    let isMounted = true;
    let adaptiveInterval = poseInterval || 500;

    // 리셋
    setReps(0);
    setFootDrops(0);
    setSwayScore(0);
    setFormPenalty(0);
    setPostureData(null);
    setValidation({isValid: false, missingParts: ['포즈를 감지하는 중입니다.']});
    stateRef.current = 'up';
    balanceStateRef.current = { dropFrames: 0, lastNoseX: 0, swayPixels: 0, isFootDown: false };

    const detectPose = async () => {
      if (!videoRef.current || !globalDetector || !isMounted || !offscreenCanvasRef.current) return;

      const video = videoRef.current;
      if (video.readyState < 2) {
        if (isMounted) timeoutRef.current = setTimeout(detectPose, adaptiveInterval);
        return;
      }

      try {
        const startTime = performance.now();

        // 저해상도 캔버스로 비디오 프레임 복사 (안정적인 다운스케일링)
        const scaleFactor = perfInfo.poseInputSize / Math.max(video.videoWidth, video.videoHeight);
        const targetW = Math.round(video.videoWidth * scaleFactor);
        const targetH = Math.round(video.videoHeight * scaleFactor);
        
        const offCanvas = offscreenCanvasRef.current;
        if (offCanvas.width !== targetW || offCanvas.height !== targetH) {
          offCanvas.width = targetW;
          offCanvas.height = targetH;
        }

        const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
        if (offCtx) {
          offCtx.drawImage(video, 0, 0, targetW, targetH);
        }

        // 고해상도 비디오 대신 저해상도 캔버스를 모델에 전달하여 GPU 병목 해소
        let poses: poseDetection.Pose[] = [];
        tf.engine().startScope();
        try {
          poses = await globalDetector.estimatePoses(offCanvas);
        } finally {
          tf.engine().endScope(); // 에러 발생 시에도 무조건 텍스처를 비우도록 강제 (메모리 누수 원천 차단)
        }
        
        if (!isMounted) return;

        await new Promise(r => setTimeout(r, 0)); // Yield

        if (!isMounted) return;

        // 좌표를 원래 비디오 비율로 복구
        if (poses.length > 0) {
          poses[0].keypoints.forEach(kp => {
            kp.x = kp.x / scaleFactor;
            kp.y = kp.y / scaleFactor;
          });
        }

        if (perfInfo.drawSkeleton) {
          drawPoses(poses);
        } else {
            // 안 그릴때도 캔버스는 초기화해주고 카운트 점수만 나오게 (깜빡임 등 제거)
            clearCanvas();
        }

        analyzeMovement(poses);

        const processingTime = performance.now() - startTime;

        if (processingTime > 300) {
          adaptiveInterval = Math.min(adaptiveInterval + 500, 3500);
        } else if (processingTime < 150 && adaptiveInterval > perfInfo.poseInterval) {
          adaptiveInterval = Math.max(adaptiveInterval - 50, perfInfo.poseInterval);
        }
      } catch (e) {
        console.error("Pose estimation error:", e);
      }

      if (isMounted) {
        timeoutRef.current = setTimeout(detectPose, adaptiveInterval);
      }
    };
    
    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas || !videoRef.current) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = videoRef.current.videoWidth || perfInfo.videoWidth;
        canvas.height = videoRef.current.videoHeight || perfInfo.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const now = Date.now();
        const timeSinceRep = now - repIndicatorRef.current;
        const showIndicator = timeSinceRep < 800;
        
        if (showIndicator) {
            const alpha = Math.max(0, 1 - timeSinceRep / 800);
            drawRepIndicator(ctx, canvas.width, canvas.height, alpha);
        }
    }

    const drawPoses = (poses: poseDetection.Pose[]) => {
      const canvas = canvasRef.current;
      if (!canvas || !videoRef.current) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = videoRef.current.videoWidth || perfInfo.videoWidth;
      canvas.height = videoRef.current.videoHeight || perfInfo.videoHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const now = Date.now();
      const timeSinceRep = now - repIndicatorRef.current;
      const showIndicator = timeSinceRep < 800;

      poses.forEach(pose => {
        const adjacentKeyPoints = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);
        adjacentKeyPoints.forEach(([i, j]) => {
          const kp1 = pose.keypoints[i];
          const kp2 = pose.keypoints[j];
          if ((kp1.score || 0) > 0.3 && (kp2.score || 0) > 0.3) {
            ctx.beginPath();
            ctx.moveTo(kp1.x, kp1.y);
            ctx.lineTo(kp2.x, kp2.y);
            ctx.strokeStyle = showIndicator ? '#10b981' : 'rgba(34, 211, 238, 0.8)';
            ctx.lineWidth = showIndicator ? 6 : 4;
            ctx.stroke();
          }
        });

        pose.keypoints.forEach(keypoint => {
          if ((keypoint.score || 0) > 0.3) {
            ctx.beginPath();
            ctx.arc(keypoint.x, keypoint.y, showIndicator ? 8 : 6, 0, 2 * Math.PI);
            ctx.fillStyle = showIndicator ? '#10b981' : '#f43f5e';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        });
      });

      if (showIndicator) {
        const alpha = Math.max(0, 1 - timeSinceRep / 800);
        drawRepIndicator(ctx, canvas.width, canvas.height, alpha);
      }
    };
    
    const drawRepIndicator = (ctx: CanvasRenderingContext2D, width: number, height: number, alpha: number) => {
        ctx.save();
        ctx.fillStyle = `rgba(16, 185, 129, ${alpha})`;
        ctx.font = 'bold 120px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const yOffset = (1 - alpha) * 100;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 4;
        ctx.fillText('+1', width / 2, height / 3 - yOffset);
        ctx.restore();
    };

    const updateValidation = (isValid: boolean, missingParts: string[]) => {
      setValidation(prev => {
        const isSameValid = prev.isValid === isValid;
        const isSameParts = prev.missingParts.length === missingParts.length &&
          prev.missingParts.every((val, index) => val === missingParts[index]);
        if (isSameValid && isSameParts) return prev;
        return { isValid, missingParts };
      });
    };

    const analyzeMovement = (poses: poseDetection.Pose[]) => {
      if (poses.length === 0) {
        updateValidation(false, ['사람이 감지되지 않았습니다.']);
        return;
      }
      const pose = poses[0];
      
      const getKp = (name: string) => pose.keypoints.find(kp => kp.name === name);
      
      // 전신 검증 로직 (1, 2, 4, 5단계 등 정지 동작 촬영 시)
      if (['front', 'side', 'arm_raise', 'flexibility'].includes(type)) {
        // MoveNet 17개 키포인트 중 "몸통(Body)" 관절만 별도 검증
        // 얼굴 키포인트(nose, left_eye, right_eye, left_ear, right_ear)만으로는 통과 불가
        const bodyPartNames = [
          'left_shoulder', 'right_shoulder',
          'left_hip', 'right_hip',
          'left_knee', 'right_knee',
          'left_ankle', 'right_ankle'
        ];
        const minConfidence = 0.3;
        
        const visibleBodyParts = pose.keypoints.filter(
          kp => bodyPartNames.includes(kp.name || '') && (kp.score || 0) > minConfidence
        );
        
        const hasLeftShoulder = pose.keypoints.some(kp => kp.name === 'left_shoulder' && (kp.score || 0) > minConfidence);
        const hasRightShoulder = pose.keypoints.some(kp => kp.name === 'right_shoulder' && (kp.score || 0) > minConfidence);
        const hasLeftHip = pose.keypoints.some(kp => kp.name === 'left_hip' && (kp.score || 0) > minConfidence);
        const hasRightHip = pose.keypoints.some(kp => kp.name === 'right_hip' && (kp.score || 0) > minConfidence);
        const hasShoulder = hasLeftShoulder || hasRightShoulder;
        const hasHip = hasLeftHip || hasRightHip;

        if (type === 'side') {
          // 측면: 한쪽 어깨 + 한쪽 엉덩이만 있으면 OK (총 몸통 3개 이상)
          if (hasShoulder && hasHip && visibleBodyParts.length >= 3) {
            updateValidation(true, []);
          } else {
            const missing: string[] = [];
            if (!hasShoulder) missing.push('어깨');
            if (!hasHip) missing.push('엉덩이');
            if (visibleBodyParts.length < 3) missing.push('전신');
            updateValidation(false, [`${missing.join(', ')}이(가) 보이지 않습니다. 옆으로 서서 전신을 보여주세요.`]);
          }
        } else {
          // 정면/팔올리기/유연성: 양쪽 어깨 + 양쪽 엉덩이 필수, 총 6개 이상
          if (hasLeftShoulder && hasRightShoulder && hasLeftHip && hasRightHip && visibleBodyParts.length >= 6) {
            updateValidation(true, []);
          } else {
            const missing: string[] = [];
            if (!hasLeftShoulder || !hasRightShoulder) missing.push('양쪽 어깨');
            if (!hasLeftHip || !hasRightHip) missing.push('양쪽 엉덩이');
            if (visibleBodyParts.length < 6) missing.push(`전신(현재 ${visibleBodyParts.length}개 감지)`);
            updateValidation(false, [`${missing.join(', ')}이(가) 보이지 않습니다. 뒤로 물러서서 전신을 보여주세요.`]);
          }
        }
      } else {
        updateValidation(true, []);
      }
      
      if (type === 'squat') {
        const l_hip = getKp('left_hip'); const r_hip = getKp('right_hip');
        const l_knee = getKp('left_knee'); const r_knee = getKp('right_knee');
        const l_ankle = getKp('left_ankle'); const r_ankle = getKp('right_ankle');
        
        // 가시성(Confidence Score) 점수 측정
        const l_score = (l_hip?.score || 0) + (l_knee?.score || 0) + (l_ankle?.score || 0);
        const r_score = (r_hip?.score || 0) + (r_knee?.score || 0) + (r_ankle?.score || 0);
        
        // 더 잘 보이는 쪽 다리를 추적 타겟으로 선정
        const useLeft = l_score > r_score;
        const shoulder = useLeft ? getKp('left_shoulder') : getKp('right_shoulder');
        const hip = useLeft ? l_hip : r_hip;
        const knee = useLeft ? l_knee : r_knee;
        const ankle = useLeft ? l_ankle : r_ankle;
        
        if (shoulder && hip && knee && ankle && (hip.score || 0) > 0.3 && (knee.score || 0) > 0.3 && (ankle.score || 0) > 0.3) {
          const angle = calculateAngle(hip, knee, ankle);
          
          // 자세 감점 확인 (엉덩이가 무릎보다 뒤로/아래로 갈때 상체가 너무 크게 굽는지)
          if ((shoulder.score || 0) > 0.3) {
             const backAngle = calculateAngle({x: hip.x, y: 0}, hip, shoulder); // 수직선 대비 등의 각도 (추정치)
             if (backAngle < 40) { // 상체가 너무 앞으로 엎어짐
                 setFormPenalty(prev => Math.min(prev + 1, 100));
                 setFeedback('상체를 세우세요!');
             }
          }

          // 측면 스쿼트 각도 튜닝
          if (angle < 110 && stateRef.current === 'up') {
            stateRef.current = 'down';
            setFeedback('좋습니다! 올라오세요.');
          } else if (angle > 150 && stateRef.current === 'down') {
            stateRef.current = 'up';
            setReps(r => r + 1);
            repIndicatorRef.current = Date.now();
            setFeedback('완벽합니다!');
          }
        }
      } else if (type === 'pushup') {
        const l_shoulder = getKp('left_shoulder'); const r_shoulder = getKp('right_shoulder');
        const l_elbow = getKp('left_elbow'); const r_elbow = getKp('right_elbow');
        const l_wrist = getKp('left_wrist'); const r_wrist = getKp('right_wrist');
        const l_hip = getKp('left_hip'); const r_hip = getKp('right_hip');
        const l_ankle = getKp('left_ankle'); const r_ankle = getKp('right_ankle');
        
        // 가시성(Confidence Score) 점수 측정
        const l_score = (l_shoulder?.score || 0) + (l_elbow?.score || 0) + (l_wrist?.score || 0);
        const r_score = (r_shoulder?.score || 0) + (r_elbow?.score || 0) + (r_wrist?.score || 0);
        
        // 대각선 앵글에서 더 잘 보이는 쪽 추적
        const useLeft = l_score > r_score;
        const shoulder = useLeft ? l_shoulder : r_shoulder;
        const elbow = useLeft ? l_elbow : r_elbow;
        const wrist = useLeft ? l_wrist : r_wrist;
        const hip = useLeft ? l_hip : r_hip;
        const ankle = useLeft ? l_ankle : r_ankle;
        
        if (shoulder && elbow && wrist && (shoulder.score || 0) > 0.3 && (elbow.score || 0) > 0.3 && (wrist.score || 0) > 0.3) {
          const angle = calculateAngle(shoulder, elbow, wrist);
          
          // 푸시업 정렬 자세 감점 확인 (다운 시)
          if (hip && ankle && (hip.score || 0) > 0.3 && (ankle.score || 0) > 0.3) {
             const bodyZAngle = calculateAngle(shoulder, hip, ankle);
             if (bodyZAngle < 150) { // 엉덩이가 솟거나 처짐 
                 // 지속적으로 잘못된 자세면 점점 깎임
                 setFormPenalty(prev => Math.min(prev + 1, 100));
                 setFeedback('허리와 엉덩이를 일직선으로 유지하세요!');
             }
          }

          // 일반인 범주의 푸시업 각도 완화 (Down: 120 미만, Up: 140 초과)
          if (angle < 120 && stateRef.current === 'up') {
            stateRef.current = 'down';
            setFeedback('밀어 올리세요!');
          } else if (angle > 140 && stateRef.current === 'down') {
            stateRef.current = 'up';
            setReps(r => r + 1);
            repIndicatorRef.current = Date.now();
            setFeedback('완벽합니다!');
          }
        }
      } else if (type === 'balance') {
        const nose = getKp('nose');
        const ls = getKp('left_shoulder');
        const rs = getKp('right_shoulder');
        const l_ankle = getKp('left_ankle');
        const r_ankle = getKp('right_ankle');
        
        let shoulderWidth = 100;
        if (ls && rs && (ls.score || 0) > 0.3 && (rs.score || 0) > 0.3) {
           shoulderWidth = Math.abs(ls.x - rs.x);
        }

        // Sway (흔들림) Tracking
        if (nose && (nose.score || 0) > 0.3) {
           if (balanceStateRef.current.lastNoseX === 0) {
               balanceStateRef.current.lastNoseX = nose.x;
           } else {
               const moveDiff = Math.abs(nose.x - balanceStateRef.current.lastNoseX);
               // Filter micro-jitters
               if (moveDiff > 2) {
                   balanceStateRef.current.swayPixels += moveDiff;
                   balanceStateRef.current.lastNoseX = nose.x;
                   // Normalize sway score roughly relative to shoulder width (0~100+)
                   const normalizedSway = Math.floor((balanceStateRef.current.swayPixels / shoulderWidth) * 5);
                   setSwayScore(normalizedSway);
               }
           }
        }

        // Foot Drop 감지 로직
        // 한발 서기 시 양 발목의 높이 차이(y)가 커집니다. 발을 내리면 높이 차이가 거의 없어집니다.
        if (l_ankle && r_ankle && (l_ankle.score || 0) > 0.3 && (r_ankle.score || 0) > 0.3) {
            const ankleYDiff = Math.abs(l_ankle.y - r_ankle.y);
            const dropThreshold = shoulderWidth * 0.7; // 한발 서기에서 발을 살짝만 내려도 거의 평행해지므로 기준 상향

            if (ankleYDiff < dropThreshold) {
                balanceStateRef.current.dropFrames += 1;
                if (balanceStateRef.current.dropFrames >= 2 && !balanceStateRef.current.isFootDown) {
                    balanceStateRef.current.isFootDown = true;
                    setFootDrops(prev => prev + 1);
                    setFeedback('발이 닿았습니다!');
                }
            } else {
                balanceStateRef.current.dropFrames = 0;
                if (balanceStateRef.current.isFootDown) {
                    balanceStateRef.current.isFootDown = false;
                    setFeedback('다시 버티세요!');
                }
            }
        }
      } else if (type === 'front') {
        const l_shoulder = getKp('left_shoulder');
        const r_shoulder = getKp('right_shoulder');
        const l_hip = getKp('left_hip');
        const r_hip = getKp('right_hip');
        const l_knee = getKp('left_knee');
        const r_knee = getKp('right_knee');
        const l_ankle = getKp('left_ankle');
        const r_ankle = getKp('right_ankle');

        let shoulderTilt = 0;
        let pelvisTilt = 0;
        let shoulderWidth = 0;
        let hipWidth = 0;
        let shoulderHipRatio = 0;
        let legType = 'normal'; // 'O자', 'X자', 'normal'
        let legAngle = 0; // 무릎 편차 각도
        let kneeAlignment = 'normal';

        // 어깨 기울기
        if (l_shoulder && r_shoulder && (l_shoulder.score || 0) > 0.3 && (r_shoulder.score || 0) > 0.3) {
          const dy = Math.abs(l_shoulder.y - r_shoulder.y);
          const dx = Math.abs(l_shoulder.x - r_shoulder.x);
          shoulderTilt = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
          shoulderWidth = dx;
        }

        // 골반 기울기
        if (l_hip && r_hip && (l_hip.score || 0) > 0.3 && (r_hip.score || 0) > 0.3) {
          const dy = Math.abs(l_hip.y - r_hip.y);
          const dx = Math.abs(l_hip.x - r_hip.x);
          pelvisTilt = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
          hipWidth = dx;
        }

        // 어깨-골반 너비 비율 (체형 판단: 1.3 이상=역삼각형, 0.9 이하=비만 체형 경향)
        if (shoulderWidth > 0 && hipWidth > 0) {
          shoulderHipRatio = Number((shoulderWidth / hipWidth).toFixed(2));
        }

        // O자/X자 다리 분석
        if (l_knee && r_knee && l_ankle && r_ankle && l_hip && r_hip &&
            (l_knee.score || 0) > 0.3 && (r_knee.score || 0) > 0.3 &&
            (l_ankle.score || 0) > 0.3 && (r_ankle.score || 0) > 0.3) {
          
          const kneeGap = Math.abs(l_knee.x - r_knee.x);
          const ankleGap = Math.abs(l_ankle.x - r_ankle.x);
          const hipGapX = Math.abs(l_hip.x - r_hip.x);
          
          // 무릎 간격을 골반 너비 대비 비율로 정규화
          const kneeRatio = kneeGap / (hipGapX || 1);
          const ankleRatio = ankleGap / (hipGapX || 1);

          if (kneeRatio < ankleRatio * 0.75) {
            // 무릎이 발목보다 훨씬 안쪽 → X자 다리
            legType = 'X자';
            legAngle = Number(((ankleRatio - kneeRatio) * 15).toFixed(1));
          } else if (kneeRatio > ankleRatio * 1.3) {
            // 무릎이 발목보다 훨씬 바깥쪽 → O자 다리
            legType = 'O자';
            legAngle = Number(((kneeRatio - ankleRatio) * 15).toFixed(1));
          } else {
            legType = '정상';
            legAngle = 0;
          }

          // 무릎 정렬 (좌우 무릎의 Y좌표 차이)
          const kneeYDiff = Math.abs(l_knee.y - r_knee.y);
          const kneeAlignAngle = Math.abs(Math.atan2(kneeYDiff, kneeGap) * 180 / Math.PI);
          kneeAlignment = kneeAlignAngle > 5 ? '비대칭' : '정상';
        }
        
        setPostureData({ 
          shoulderTilt: Number(shoulderTilt.toFixed(1)), 
          pelvisTilt: Number(pelvisTilt.toFixed(1)),
          shoulderHipRatio,
          legType,
          legAngle,
          kneeAlignment
        });

      } else if (type === 'side') {
        const l_ear = getKp('left_ear'); const r_ear = getKp('right_ear');
        const l_shoulder = getKp('left_shoulder'); const r_shoulder = getKp('right_shoulder');
        const l_hip = getKp('left_hip'); const r_hip = getKp('right_hip');
        const l_knee = getKp('left_knee'); const r_knee = getKp('right_knee');

        const useLeft = (l_shoulder?.score || 0) > (r_shoulder?.score || 0);
        const ear = useLeft ? l_ear : r_ear;
        const shoulder = useLeft ? l_shoulder : r_shoulder;
        const hip = useLeft ? l_hip : r_hip;
        const knee = useLeft ? l_knee : r_knee;

        let neckAngle = 0;
        let torsoAngle = 0;
        let roundedShoulderAngle = 0; // 라운드 숄더 각도
        let kyphosisAngle = 0; // 등 굽힘(흉추 후만) 추정

        // 거북목: 귀-어깨 수평 편차
        if (ear && shoulder && (ear.score || 0) > 0.3 && (shoulder.score || 0) > 0.3) {
          const dx = Math.abs(ear.x - shoulder.x);
          const dy = Math.abs(ear.y - shoulder.y);
          neckAngle = Math.abs(Math.atan2(dx, dy) * 180 / Math.PI);
        }

        // 상체 기울기
        if (hip && shoulder && (hip.score || 0) > 0.3 && (shoulder.score || 0) > 0.3) {
          const dx = Math.abs(shoulder.x - hip.x);
          const dy = Math.abs(shoulder.y - hip.y);
          torsoAngle = Math.abs(Math.atan2(dx, dy) * 180 / Math.PI);
        }

        // 라운드 숄더: 어깨가 골반보다 앞으로 나온 정도 (측면에서 X좌표 비교)
        if (shoulder && hip && (shoulder.score || 0) > 0.3 && (hip.score || 0) > 0.3) {
          // 측면에서 어깨의 X좌표가 골반보다 앞(카메라 쪽)으로 나와 있으면 라운드 숄더
          const shoulderForward = shoulder.x - hip.x; // 양수면 어깨가 앞으로
          const bodyHeight = Math.abs(shoulder.y - hip.y) || 1;
          roundedShoulderAngle = Number((Math.atan2(Math.abs(shoulderForward), bodyHeight) * 180 / Math.PI).toFixed(1));
        }

        // 등 굽힘(흉추 후만) 추정: 귀-어깨-골반 3점 각도
        if (ear && shoulder && hip && (ear.score || 0) > 0.3 && (shoulder.score || 0) > 0.3 && (hip.score || 0) > 0.3) {
          const earShoulderAngle = calculateAngle(ear, shoulder, hip);
          // 이상적으로 약 170~180도 (일직선). 160도 이하면 등이 굽어있음
          kyphosisAngle = Number((180 - earShoulderAngle).toFixed(1));
          if (kyphosisAngle < 0) kyphosisAngle = 0;
        }

        setPostureData({ 
          neckAngle: Number(neckAngle.toFixed(1)), 
          torsoAngle: Number(torsoAngle.toFixed(1)),
          roundedShoulderAngle,
          kyphosisAngle
        });

      } else if (type === 'arm_raise') {
        // 팔 올리기 평가: 양쪽 팔의 올림 각도 + 귀 밀착 여부
        const l_shoulder = getKp('left_shoulder'); const r_shoulder = getKp('right_shoulder');
        const l_elbow = getKp('left_elbow'); const r_elbow = getKp('right_elbow');
        const l_wrist = getKp('left_wrist'); const r_wrist = getKp('right_wrist');
        const l_hip = getKp('left_hip'); const r_hip = getKp('right_hip');
        const l_ear = getKp('left_ear'); const r_ear = getKp('right_ear');

        let leftArmAngle = 0;
        let rightArmAngle = 0;
        let armAvgAngle = 0;
        let earProximity = '측정불가'; // '완벽밀착', '근접', '이격', '크게이격'
        let elbowStraight = true;
        let armRaiseGrade = 'N/A';

        // 왼팔 올림 각도: 골반-어깨-손목 각도
        if (l_shoulder && l_wrist && l_hip && (l_shoulder.score || 0) > 0.3 && (l_wrist.score || 0) > 0.3 && (l_hip.score || 0) > 0.3) {
          leftArmAngle = calculateAngle(l_hip, l_shoulder, l_wrist);
        }
        // 오른팔 올림 각도
        if (r_shoulder && r_wrist && r_hip && (r_shoulder.score || 0) > 0.3 && (r_wrist.score || 0) > 0.3 && (r_hip.score || 0) > 0.3) {
          rightArmAngle = calculateAngle(r_hip, r_shoulder, r_wrist);
        }

        armAvgAngle = leftArmAngle > 0 && rightArmAngle > 0 
          ? Number(((leftArmAngle + rightArmAngle) / 2).toFixed(1))
          : Number((leftArmAngle || rightArmAngle).toFixed(1));

        // 팔꿈치 굽힘 확인
        if (l_shoulder && l_elbow && l_wrist && (l_elbow.score || 0) > 0.3) {
          const elbowAngle = calculateAngle(l_shoulder, l_elbow, l_wrist);
          if (elbowAngle < 150) elbowStraight = false;
        }
        if (r_shoulder && r_elbow && r_wrist && (r_elbow.score || 0) > 0.3) {
          const elbowAngle = calculateAngle(r_shoulder, r_elbow, r_wrist);
          if (elbowAngle < 150) elbowStraight = false;
        }

        // 귀 밀착 여부: 손목과 귀의 X좌표 거리 (어깨 너비 대비)
        const shoulderWidth = (l_shoulder && r_shoulder) ? Math.abs(l_shoulder.x - r_shoulder.x) : 100;
        if (l_wrist && l_ear && r_wrist && r_ear && (l_wrist.score || 0) > 0.3 && (r_wrist.score || 0) > 0.3) {
          const leftDist = Math.abs(l_wrist.x - l_ear.x) / shoulderWidth;
          const rightDist = Math.abs(r_wrist.x - r_ear.x) / shoulderWidth;
          const avgDist = (leftDist + rightDist) / 2;
          if (avgDist < 0.15) earProximity = '완벽밀착';
          else if (avgDist < 0.3) earProximity = '근접';
          else if (avgDist < 0.5) earProximity = '이격';
          else earProximity = '크게이격';
        }

        // 종합 등급
        if (armAvgAngle >= 170 && earProximity === '완벽밀착' && elbowStraight) armRaiseGrade = '우수 (180도 완벽)';
        else if (armAvgAngle >= 160) armRaiseGrade = `양호 (${armAvgAngle}도)`;
        else if (armAvgAngle >= 135) armRaiseGrade = `보통 (${armAvgAngle}도)`;
        else if (armAvgAngle >= 90) armRaiseGrade = `미흡 (${armAvgAngle}도)`;
        else armRaiseGrade = `불량 (${armAvgAngle}도)`;

        setPostureData({
          leftArmAngle: Number(leftArmAngle.toFixed(1)),
          rightArmAngle: Number(rightArmAngle.toFixed(1)),
          armAvgAngle,
          earProximity,
          elbowStraight,
          armRaiseGrade
        });

        setFeedback(armRaiseGrade);

      } else if (type === 'flexibility') {
        // 유연성 평가: 전굴 자세 분석
        const l_shoulder = getKp('left_shoulder'); const r_shoulder = getKp('right_shoulder');
        const l_hip = getKp('left_hip'); const r_hip = getKp('right_hip');
        const l_knee = getKp('left_knee'); const r_knee = getKp('right_knee');
        const l_ankle = getKp('left_ankle'); const r_ankle = getKp('right_ankle');
        const l_wrist = getKp('left_wrist'); const r_wrist = getKp('right_wrist');

        const useLeft = (l_hip?.score || 0) > (r_hip?.score || 0);
        const shoulder = useLeft ? l_shoulder : r_shoulder;
        const hip = useLeft ? l_hip : r_hip;
        const knee = useLeft ? l_knee : r_knee;
        const ankle = useLeft ? l_ankle : r_ankle;
        const wrist = useLeft ? l_wrist : r_wrist;

        let waistBendAngle = 0;   // 허리 굽힘 각도 (어깨-골반-무릎)
        let kneeStraight = true;   // 무릎 펴짐 여부
        let kneeAngle = 180;
        let handPosition = '측정불가'; // '바닥완전', '발목', '정강이중간', '정강이위', '무릎이상'
        let handToFloorRatio = 1;  // 손목 Y좌표의 상대적 위치 (0=머리, 1=발)
        let flexGrade = 'N/A';

        // 허리 굽힘 각도: 어깨-골반-무릎 각도 (작을수록 많이 굽힘)
        if (shoulder && hip && knee && (shoulder.score || 0) > 0.3 && (hip.score || 0) > 0.3 && (knee.score || 0) > 0.3) {
          waistBendAngle = Number(calculateAngle(shoulder, hip, knee).toFixed(1));
        }

        // 무릎 굽힘 확인: 골반-무릎-발목 각도
        if (hip && knee && ankle && (hip.score || 0) > 0.3 && (knee.score || 0) > 0.3 && (ankle.score || 0) > 0.3) {
          kneeAngle = Number(calculateAngle(hip, knee, ankle).toFixed(1));
          kneeStraight = kneeAngle >= 160;
        }

        // 손 위치 판정: 손목 Y좌표를 골반-발목 사이에서 상대적 위치로 계산
        if (wrist && hip && ankle && (wrist.score || 0) > 0.3 && (hip.score || 0) > 0.3 && (ankle.score || 0) > 0.3) {
          const hipY = hip.y;
          const ankleY = ankle.y;
          const wristY = wrist.y;
          const totalRange = ankleY - hipY; // 골반~발목 범위
          
          if (totalRange > 0) {
            handToFloorRatio = Number(((wristY - hipY) / totalRange).toFixed(2));
            
            if (wristY >= ankleY - 5) handPosition = '바닥완전';      // 손이 발목 이하
            else if (handToFloorRatio >= 0.85) handPosition = '발목';   // 발목 근처
            else if (handToFloorRatio >= 0.6) handPosition = '정강이중간';
            else if (handToFloorRatio >= 0.4) handPosition = '정강이위';
            else handPosition = '무릎이상';
          }
        }

        // 종합 등급 (손 위치 + 무릎 + 허리 종합)
        const kneePenalty = kneeStraight ? '' : ' (무릎 굽힘 감점)';
        // 상체가 길어도 허리 굽힘이 부족하면 감점 요소
        const waistPenalty = waistBendAngle > 120 ? ' (허리 굽힘 부족)' : '';
        
        if (handPosition === '바닥완전' && kneeStraight && waistBendAngle <= 90) flexGrade = '우수 (손바닥 완전 닿음)';
        else if (handPosition === '바닥완전' || handPosition === '발목') flexGrade = `양호 (${handPosition})${kneePenalty}${waistPenalty}`;
        else if (handPosition === '정강이중간') flexGrade = `보통 (정강이 중간)${kneePenalty}${waistPenalty}`;
        else if (handPosition === '정강이위') flexGrade = `미흡 (정강이 위)${kneePenalty}`;
        else flexGrade = `불량 (무릎 이상)${kneePenalty}`;

        setPostureData({
          waistBendAngle,
          kneeAngle,
          kneeStraight,
          handPosition,
          handToFloorRatio,
          flexGrade,
          waistPenalty: waistBendAngle > 120
        });

        setFeedback(flexGrade);
      }
    };

    timeoutRef.current = setTimeout(detectPose, 100);

    return () => {
      isMounted = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isActive, type, isModelLoaded, poseInterval, poseInputSize, drawSkeleton, videoWidth, videoHeight]);

  // 최종 자세 점수 계산
  // 페널티 누적치를 반영, 스쿼트/푸시업 아닐경우 또는 페널티 없으면 100점
  const formScore = Math.max(0, 100 - Math.floor(formPenalty * 2));

  return { reps, footDrops, swayScore, formScore, feedback, isModelLoaded, postureData, validation };
};
