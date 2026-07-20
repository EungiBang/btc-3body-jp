
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { speak } from '../services/ttsService';
import { usePoseEstimation } from '../hooks/usePoseEstimation';
import { useBackgroundBlur } from '../hooks/useBackgroundBlur';
import i18n from '../i18n';

interface CameraModuleProps {
  onCapture: (dataUrl: string, autoReps?: number, metadata?: { reps?: number, footDrops?: number, swayScore?: number, formScore?: number, kneeAssisted?: boolean, postureData?: any }) => void;
  guidelineType: 'front' | 'side' | 'squat' | 'pushup' | 'balance' | 'flexibility' | 'face' | 'arm_raise';
  autoCapture?: boolean;
  timerDuration?: number; // For strength tests
  preferredDeviceId?: string; // Persist camera selection across steps
  onDeviceChange?: (deviceId: string) => void; // Notify parent of camera change
  perfInfo?: any; // 성능 티어 정보
}

const toLocalizedNumber = (n: number): string => {
  const lang = i18n.language || 'ja';
  const koreanNums = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구', '십'];
  const englishNums = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const japaneseNums = ['れい', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'は치', 'きゅう', 'じゅう'];
  
  if (lang.startsWith('en')) {
    return n <= 10 ? englishNums[n] : n.toString();
  } else if (lang.startsWith('ko')) {
    return n <= 10 ? koreanNums[n] : n.toString();
  } else {
    return n <= 10 ? japaneseNums[n] : n.toString();
  }
};

const DEFAULT_PERF_INFO = { poseInterval: 500, poseInputSize: 256, drawSkeleton: true, videoWidth: 640, videoHeight: 480 };

const CameraModule: React.FC<CameraModuleProps> = ({ onCapture, guidelineType, autoCapture, timerDuration, preferredDeviceId, onDeviceChange, perfInfo }) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skeletonCanvasRef = useRef<HTMLCanvasElement>(null);
  const blurCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [testTimer, setTestTimer] = useState<number | null>(null);
  const [isStarted, setIsStarted] = useState(false);
  
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(
    guidelineType === 'face' ? 'user' : 'environment'
  );

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(preferredDeviceId || localStorage.getItem('selectedCameraId') || '');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [zoomCapabilities, setZoomCapabilities] = useState<{ min: number, max: number, step: number } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [aiLoadError, setAiLoadError] = useState<string | null>(null);

  // perfInfo가 전달되지 않았을 때 기본값 생성 (포즈 감지 루프가 항상 동작하도록)
  const activePerfInfo = perfInfo || DEFAULT_PERF_INFO;

  const { reps: autoReps, feedback: poseFeedback, isModelLoaded: isPoseLoaded, footDrops, swayScore, formScore, postureData, validation } = usePoseEstimation(
    videoRef, 
    skeletonCanvasRef, 
    testTimer !== null && (guidelineType === 'squat' || guidelineType === 'pushup') || ['front', 'side', 'arm_raise', 'flexibility'].includes(guidelineType), 
    ['squat', 'pushup', 'front', 'side', 'arm_raise', 'flexibility'].includes(guidelineType) ? (guidelineType as any) : 'none',
    activePerfInfo
  );

  // Background blur DISABLED - root cause of main thread blocking & timer freezes
  // segmentPeople() blocks main thread 100-300ms per frame, making UI unresponsive
  const { isReady: isBlurReady } = useBackgroundBlur(videoRef, blurCanvasRef, false);

  const [bypassAILoad, setBypassAILoad] = useState(false);

  const needsPoseModel = ['squat', 'pushup', 'front', 'side', 'arm_raise', 'flexibility'].includes(guidelineType);
  // Only wait for pose model on necessary steps
  const isAILoading = needsPoseModel && !isPoseLoaded && !bypassAILoad;

  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    if (isAILoading) {
      setLoadingProgress(0);
      setAiLoadError(null);

      // 15초 타임아웃 타이머
      const timeoutId = setTimeout(() => {
        setAiLoadError("AI model loading is taking longer than expected. You can proceed manually or check network status.");
      }, 15000);

      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 95) return 95;
          const increment = prev < 50 ? 5 : prev < 80 ? 2 : 0.5;
          return prev + increment;
        });
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        clearInterval(interval);
      };
    } else {
      setLoadingProgress(100);
      setAiLoadError(null);
    }
  }, [isAILoading]);

  const getGuideMessage = () => {
    switch (guidelineType) {
      case 'front': return 'Please align your body with the guidelines so that your full front profile is visible.';
      case 'side': return 'Align your body center line with the vertical guide and stand sideways.';
      case 'balance': return 'Close your eyes, stand on one foot, and maintain balance.';
      case 'arm_raise': return 'Please raise your arms as high as possible.';
      case 'flexibility': return 'Strike the pose fully and press the capture button.';
      case 'squat': return 'Perform squats repeatedly for 15 seconds.';
      case 'pushup': return 'Perform pushups repeatedly for 15 seconds.';
      case 'face': return 'Ensure bright lighting, align your face in the circle, and look straight ahead.';
      default: return '';
    }
  };

  // Get available video devices
  const refreshDeviceList = async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
      setDevices(videoDevices);
      console.log(`[Camera] Found ${videoDevices.length} video devices:`, videoDevices.map(d => d.label || d.deviceId));
    } catch (err) {
      console.error("Error enumerating devices:", err);
    }
  };

  useEffect(() => {
    refreshDeviceList();
  }, []);

  // 설정 모달에서 카메라 변경 시 실시간 반영
  useEffect(() => {
    const handleCameraSwitch = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.deviceId) {
        setSelectedDeviceId(detail.deviceId);
        onDeviceChange?.(detail.deviceId);
      }
    };
    window.addEventListener('camera:change', handleCameraSwitch);
    return () => window.removeEventListener('camera:change', handleCameraSwitch);
  }, [onDeviceChange]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function startCamera() {
      try {
        // Stop existing stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
          // 태블릿(웹뷰/안드로이드) 하드웨어 카메라 릴리스를 위한 대기 시간 추가
          await new Promise(r => setTimeout(r, 300));
        }

        let stream: MediaStream | null = null;
        let retryCount = 0;
        const maxRetries = 2;

        while (!stream && retryCount <= maxRetries) {
          try {
            const constraints: MediaStreamConstraints = {
              video: {
                deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                facingMode: selectedDeviceId ? undefined : facingMode,
                width: { ideal: perfInfo?.videoWidth || 854 },
                height: { ideal: perfInfo?.videoHeight || 480 }
              }
            };
            stream = await navigator.mediaDevices.getUserMedia(constraints);
          } catch (e) {
            console.warn(`[Camera] Attempt ${retryCount + 1} failed:`, e);
            if (retryCount >= maxRetries) {
              console.warn("Primary camera constraints failed, trying fallback 1 (no resolution)...", e);
              try {
                stream = await navigator.mediaDevices.getUserMedia({
                  video: {
                    deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                    facingMode: selectedDeviceId ? undefined : facingMode,
                  }
                });
              } catch (e2) {
                console.warn("Fallback 1 failed, trying fallback 2 (basic video)...", e2);
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
              }
            } else {
              retryCount++;
              // 재시도 전 대기
              await new Promise(r => setTimeout(r, 500));
            }
          }
        }
        
        if (!isMounted) {
          if (stream) stream.getTracks().forEach(track => track.stop());
          return;
        }

        if (!stream) {
          throw new Error("Failed to acquire camera stream");
        }

        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.error("Video play error:", e));
          setIsCameraReady(true);
          setIsLoading(false);
          setCameraError(null);

          // Auto-detect and persist the actual camera device being used
          const activeTrack = stream.getVideoTracks()[0];
          const activeSettings = activeTrack.getSettings();
          if (activeSettings.deviceId && !selectedDeviceId) {
            setSelectedDeviceId(activeSettings.deviceId);
            onDeviceChange?.(activeSettings.deviceId);
          }

          // Re-enumerate devices after permission granted (labels become available)
          refreshDeviceList();

          // Check zoom capabilities
          const track = stream.getVideoTracks()[0];
          const capabilities = track.getCapabilities() as any;
          if (capabilities.zoom) {
            setZoomCapabilities({
              min: capabilities.zoom.min,
              max: capabilities.zoom.max,
              step: capabilities.zoom.step || 0.1
            });
            setZoomLevel(capabilities.zoom.min);
          } else {
            setZoomCapabilities(null);
          }
        }
      } catch (err: any) {
        console.error("Error accessing camera:", err);
        if (isMounted) {
          setIsCameraReady(false);
          setIsLoading(false);
          setCameraError(t('camera.accessError', { error: err.name || err.message }));
        }
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode, selectedDeviceId, perfInfo]);

  // Apply zoom level to the track
  useEffect(() => {
    if (isCameraReady && videoRef.current?.srcObject) {
      const track = (videoRef.current.srcObject as MediaStream).getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any;
      if (capabilities.zoom) {
        track.applyConstraints({
          advanced: [{ zoom: zoomLevel } as any]
        }).catch(err => console.error("Error applying zoom:", err));
      }
    }
  }, [zoomLevel, isCameraReady]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    setSelectedDeviceId(''); // Reset specific device when switching mode
  };

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    onDeviceChange?.(deviceId);
  };

  // Use ref for handleCapture to avoid stale closures in timers
  const handleCaptureRef = useRef<() => void>(() => {});
  
  const handleCapture = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      const videoW = video.videoWidth;
      const videoH = video.videoHeight;
      
      // Crop to match the 9:16 portrait view the user sees on screen
      const targetRatio = 9 / 16;
      const videoRatio = videoW / videoH;
      
      let srcX = 0, srcY = 0, srcW = videoW, srcH = videoH;
      
      if (videoRatio > targetRatio) {
        srcW = Math.round(videoH * targetRatio);
        srcX = Math.round((videoW - srcW) / 2);
      } else if (videoRatio < targetRatio) {
        srcH = Math.round(videoW / targetRatio);
        srcY = Math.round((videoH - srcH) / 2);
      }
      
      canvas.width = srcW;
      canvas.height = srcH;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (isMirrored) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
        
        // --- AI 뼈대(Skeleton) 오버레이 합성 ---
        if (skeletonCanvasRef.current) {
          ctx.drawImage(skeletonCanvasRef.current, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
        }

        // --- 얼굴 안색/밝기 측정 (FACE_ANALYSIS용) ---
        let finalPostureData = postureData ? { ...postureData } : {};
        if (guidelineType === 'face') {
          try {
            // 얼굴이 들어가는 중앙 30% 영역(ROI) 지정
            const roiW = Math.floor(canvas.width * 0.3);
            const roiH = Math.floor(canvas.height * 0.3);
            const rx = Math.floor(canvas.width / 2) - Math.floor(roiW / 2);
            const ry = Math.floor(canvas.height / 2) - Math.floor(roiH / 2);
            
            // 캔버스 크기를 벗어나지 않도록 보정
            const safeRx = Math.max(0, rx);
            const safeRy = Math.max(0, ry);
            const safeRw = Math.min(roiW, canvas.width - safeRx);
            const safeRh = Math.min(roiH, canvas.height - safeRy);
            
            const imageData = ctx.getImageData(safeRx, safeRy, safeRw, safeRh);
            const data = imageData.data;
            let totalLuma = 0;
            let pixelCount = 0;
            
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i+1];
              const b = data[i+2];
              // Luma(휘도) 공식: L = 0.213R + 0.715G + 0.072B
              totalLuma += (0.213 * r + 0.715 * g + 0.072 * b);
              pixelCount++;
            }
            
            if (pixelCount > 0) {
              const avgLuma = totalLuma / pixelCount;
              finalPostureData.faceBrightness = Number(avgLuma.toFixed(1));
              console.log('[Face Analysis] 평균 휘도(Luma):', finalPostureData.faceBrightness);
            }
          } catch (err) {
            console.error('Face brightness calculation failed:', err);
          }
        }
        
        onCapture(canvas.toDataURL('image/jpeg', 0.8), autoReps, {
          footDrops,
          swayScore,
          formScore,
          postureData: finalPostureData
        });
      }
    }
  }, [isMirrored, onCapture, autoReps, footDrops, swayScore, formScore, postureData, guidelineType]);

  // Keep ref in sync
  useEffect(() => {
    handleCaptureRef.current = handleCapture;
  }, [handleCapture]);

  // Auto-capture countdown (for posture front/side etc.)
  useEffect(() => {
    if (cameraError) {
      setCountdown(null);
      setIsStarted(false);
      return;
    }

    if (autoCapture && isCameraReady && isStarted && !cameraError) {
      if (guidelineType === 'face') {
        speak(t('camera.prepFaceSpeech'));
      } else {
        speak(t('camera.prepSpeech'));
      }
      const COUNTDOWN_DURATION = 5;
      setCountdown(COUNTDOWN_DURATION);
      const countdownStart = Date.now();
      let lastSpoken = COUNTDOWN_DURATION + 1;

      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - countdownStart) / 1000);
        const remaining = Math.max(0, COUNTDOWN_DURATION - elapsed);

        if (remaining <= 0) {
          clearInterval(interval);
          setCountdown(null);
          setTimeout(() => {
            if(handleCaptureRef.current) handleCaptureRef.current();
            setIsStarted(false);
          }, 0);
        } else {
          setCountdown(remaining);
          if (remaining <= 3 && remaining < lastSpoken) {
            lastSpoken = remaining;
            speak(toLocalizedNumber(remaining, null));
          }
        }
      }, 200);

      return () => clearInterval(interval);
    }
  }, [autoCapture, isCameraReady, isStarted]);

  const testTimerIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerWorkerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Web Worker for Timer 초기화
    if (window.Worker) {
      // Vite 환경에서는 public이나 별도 빌드된 worker 파일 경로 필요
      // 하지만 가장 간단하고 의존성 없는 Blob 방식 사용
      const workerCode = `
        let intervalId = null;
        let startTime = 0;
        let duration = 0;
        let mode = null;

        const clearTimer = () => {
          if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
          }
          mode = null;
        };

        const tick = () => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const remaining = Math.max(0, duration - elapsed);

          if (mode === 'countdown') {
            self.postMessage({ type: 'countdown', remaining });
            if (remaining <= 0) {
              clearTimer();
              self.postMessage({ type: 'countdownComplete' });
            }
          } else if (mode === 'test') {
            self.postMessage({ type: 'testTick', remaining });
            if (remaining <= 0) {
              clearTimer();
              self.postMessage({ type: 'testComplete' });
            }
          }
        };

        self.onmessage = (e) => {
          const { type } = e.data;
          if (type === 'startCountdown') {
            clearTimer();
            mode = 'countdown';
            duration = e.data.duration;
            startTime = Date.now();
            intervalId = setInterval(tick, 100);
            tick();
          } else if (type === 'startTest') {
            clearTimer();
            mode = 'test';
            duration = e.data.duration;
            startTime = Date.now();
            intervalId = setInterval(tick, 100);
            tick();
          } else if (type === 'stop') {
            clearTimer();
          }
        };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      timerWorkerRef.current = new Worker(URL.createObjectURL(blob));
    }

    return () => {
      if (testTimerIntervalRef.current) {
        clearTimeout(testTimerIntervalRef.current);
      }
      if (timerWorkerRef.current) {
        timerWorkerRef.current.postMessage({ type: 'stop' });
        timerWorkerRef.current.terminate();
      }
    };
  }, []);

  const startTestTimer = () => {
    if (!timerDuration) return;

    // Appropriate narration per test type
    const narration = guidelineType === 'balance'
      ? t('camera.startBalanceSpeech', { duration: timerDuration })
      : t('camera.startTestSpeech', { duration: timerDuration });
    speak(narration);

    // 5-second preparation countdown first
    const PREP_DURATION = 5;
    setCountdown(PREP_DURATION);
    let lastPrepSpoken = PREP_DURATION + 1;

    if (timerWorkerRef.current) {
      timerWorkerRef.current.onmessage = (e) => {
        const { type, remaining } = e.data;
        if (type === 'countdown') {
          setCountdown(remaining);
          if (remaining <= 3 && remaining < lastPrepSpoken) {
            lastPrepSpoken = remaining;
            speak(toLocalizedNumber(remaining, null));
          }
        } else if (type === 'countdownComplete') {
          setCountdown(null);
          beginTestTimer();
        }
      };
      timerWorkerRef.current.postMessage({ type: 'startCountdown', duration: PREP_DURATION });
    } else {
      // Fallback
      const prepStart = Date.now();
      const prepInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - prepStart) / 1000);
        const remaining = Math.max(0, PREP_DURATION - elapsed);

        if (remaining <= 0) {
          clearInterval(prepInterval);
          setCountdown(null);
          beginTestTimer();
        } else {
          setCountdown(remaining);
          if (remaining <= 3 && remaining < lastPrepSpoken) {
            lastPrepSpoken = remaining;
            speak(toLocalizedNumber(remaining, null));
          }
        }
      }, 200);
    }
  };

  const beginTestTimer = () => {
    if (!timerDuration) return;

    speak(t('camera.start'));

    const startTime = Date.now();
    setTestTimer(timerDuration);

    // Clear any existing timeout
    if (testTimerIntervalRef.current) {
      clearTimeout(testTimerIntervalRef.current);
    }

    let lastSpoken = timerDuration + 1;

    if (timerWorkerRef.current) {
      timerWorkerRef.current.onmessage = (e) => {
        const { type, remaining } = e.data;
        if (type === 'testTick') {
          setTestTimer(remaining);
          if (remaining <= 5 && remaining > 0 && remaining < lastSpoken) {
            lastSpoken = remaining;
            speak(toLocalizedNumber(remaining, null));
          }
        } else if (type === 'testComplete') {
          setTestTimer(null);
          speak(t('camera.assessmentComplete'));
          setTimeout(() => {
            if(handleCaptureRef.current) handleCaptureRef.current();
          }, 300);
        }
      };
      timerWorkerRef.current.postMessage({ type: 'startTest', duration: timerDuration });
    } else {
      // Fallback
      const tick = () => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, timerDuration - elapsed);

        if (remaining <= 0) {
          testTimerIntervalRef.current = null;
          setTestTimer(null);
          speak(t('camera.assessmentComplete'));
          setTimeout(() => {
            if(handleCaptureRef.current) handleCaptureRef.current();
          }, 300);
        } else {
          setTestTimer(remaining);
          if (remaining <= 5 && remaining < lastSpoken) {
            lastSpoken = remaining;
            speak(toLocalizedNumber(remaining, null));
          }
          testTimerIntervalRef.current = setTimeout(tick, 100);
        }
      };
      testTimerIntervalRef.current = setTimeout(tick, 100);
    }
  };

  return (
    <div className="flex-1 min-h-0 w-full flex justify-center items-center">
      <div className="relative w-full max-w-[calc((100vh-280px)*9/16)] aspect-[9/16] rounded-[2.5rem] overflow-hidden bg-black shadow-2xl">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted
          className={`absolute inset-0 w-full h-full object-cover ${isMirrored ? 'scale-x-[-1]' : ''}`}
        />
        <canvas
          ref={blurCanvasRef}
          className={`absolute inset-0 w-full h-full object-cover ${isMirrored ? 'scale-x-[-1]' : ''} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}
        />
      
      {/* Vignette effect to focus on the person */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.8)] z-0"></div>
      
      {isLoading && !cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-40">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
          <p className="text-white/60 text-sm font-medium">{t('camera.connecting')}</p>
        </div>
      )}

      {isAILoading && !isLoading && !cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-md z-40 px-8">
          {!aiLoadError ? (
            <>
              <div className="w-16 h-16 relative mb-6">
                <div className="absolute inset-0 border-4 border-cyan-400/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-cyan-400 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-cyan-400 font-bold text-sm">
                  {Math.round(loadingProgress)}%
                </div>
              </div>
              <p className="text-white font-bold text-lg tracking-wide">{t('camera.loadingModel')}</p>
              <p className="text-white/60 text-sm mt-2 text-center">{t('camera.initializing')}</p>
              
              {/* Progress Bar */}
              <div className="w-full max-w-xs h-2 bg-white/10 rounded-full mt-6 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
            </>
          ) : (
            <div className="text-center p-6 bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl max-w-sm">
              <i className="fas fa-clock text-amber-500 text-4xl mb-4 animate-pulse"></i>
              <p className="text-white font-bold text-lg mb-2">{t('camera.loadDelayed')}</p>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                {t('camera.loadDelayedHint')}
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setBypassAILoad(true)}
                  className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-2xl transition-all shadow-[0_4px_12px_rgba(8,145,178,0.3)]"
                >
                  {t('camera.proceedManual')}
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-2xl transition-all"
                >
                  {t('common.reloadPage')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {cameraError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 p-6 text-center">
          <div className="bg-white p-6 rounded-3xl shadow-2xl">
            <i className="fas fa-exclamation-triangle text-rose-500 text-4xl mb-4"></i>
            <p className="text-slate-800 font-bold mb-4">{cameraError}</p>
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => {
                  window.location.reload();
                }}
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold"
              >
                {t('common.refreshPage')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Countdown UI */}
      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-md z-30">
          <div className="text-center">
             <div className="text-[12rem] font-black text-white animate-pulse leading-none">{countdown}</div>
             <p className="text-white font-black text-2xl mt-8 tracking-widest uppercase animate-bounce">{t('camera.getReady')}</p>
          </div>
        </div>
      )}
  
      {/* Test Timer UI */}
      {testTimer !== null && (
        <div className="absolute top-6 left-0 right-0 flex justify-center z-20 pointer-events-none">
          <div className="flex items-center gap-3">
            <div className="bg-rose-600 text-white font-black px-5 py-2 rounded-2xl shadow-xl text-xl flex items-center gap-2 border-2 border-rose-400">
              <i className="fas fa-stopwatch animate-pulse"></i>
              {testTimer}{t('camera.seconds')}
            </div>
            {(guidelineType === 'squat' || guidelineType === 'pushup') && (
              <div className="bg-indigo-600 text-white font-black px-5 py-2 rounded-2xl shadow-xl text-xl flex items-center gap-2 border-2 border-indigo-400">
                <i className="fas fa-dumbbell"></i>
                {autoReps} {t('camera.reps')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Large center rep count for squat/pushup */}
      {testTimer !== null && (guidelineType === 'squat' || guidelineType === 'pushup') && (
        <div className="absolute inset-0 flex items-center justify-center z-15 pointer-events-none">
          <div className="text-[8rem] font-black text-white/30 leading-none select-none">
            {autoReps}
          </div>
        </div>
      )}

      {/* Real-time Pose Feedback */}
      {poseFeedback && testTimer !== null && (
        <div className="absolute top-32 left-0 right-0 flex justify-center z-20 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-md text-cyan-300 font-bold px-6 py-3 rounded-full shadow-lg border border-cyan-500/30 animate-in fade-in slide-in-from-bottom-4">
            {poseFeedback}
          </div>
        </div>
      )}

      {/* Controls Area */}
      <div className="absolute bottom-10 left-0 right-0 flex justify-center px-8 z-20">
        {timerDuration && testTimer === null ? (
          <button 
            onClick={startTestTimer}
            disabled={isAILoading}
            className={`w-full py-4 font-black text-xl rounded-2xl transition-all flex items-center justify-center gap-2 border ${isAILoading ? 'bg-black/30 backdrop-blur-sm border-white/10 text-white/50 cursor-not-allowed' : 'bg-black/30 backdrop-blur-sm border-white/20 text-white hover:bg-black/50 active:scale-95'}`}
          >
            <i className="fas fa-play"></i> {isAILoading ? t('common.loading') : t('camera.startTimer', { duration: timerDuration })}
          </button>
        ) : autoCapture && !isStarted && countdown === null ? (
          <button 
            onClick={() => setIsStarted(true)}
            disabled={isAILoading}
            className={`w-full py-4 font-bold text-xl rounded-2xl transition-all flex justify-center items-center gap-2 border ${isAILoading ? 'bg-black/30 backdrop-blur-sm border-white/10 text-white/50 cursor-not-allowed' : 'bg-black/30 backdrop-blur-sm border-white/20 text-white hover:bg-black/50 active:scale-95'}`}
          >
            <span>{isAILoading ? t('common.loading') : t('camera.captureCountdown')}</span>
          </button>
        ) : !autoCapture && testTimer === null && countdown === null && (
          <button 
            onClick={handleCapture}
            disabled={!isCameraReady}
            className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all disabled:opacity-50 border-4 border-slate-200"
          >
            <div className="w-14 h-14 rounded-full border-4 border-indigo-600 flex items-center justify-center">
               <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
            </div>
          </button>
        )}
        {!isCameraReady && (
          <button 
            type="button"
            onClick={() => {
              const mockCanvas = document.createElement('canvas');
              mockCanvas.width = 640;
              mockCanvas.height = 480;
              const ctx = mockCanvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = '#1e1b4b';
                ctx.fillRect(0, 0, 640, 480);
                ctx.font = '24px sans-serif';
                ctx.fillStyle = '#38bdf8';
                ctx.textAlign = 'center';
                ctx.fillText('MOCK SCAN CAPTURE', 320, 240);
              }
              onCapture(mockCanvas.toDataURL('image/jpeg', 0.8), 0, {
                reps: 0,
                footDrops: 0,
                swayScore: 0,
                formScore: 100,
                postureData: { mock: true }
              });
            }}
            className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl transition-all flex justify-center items-center gap-2 border border-red-500 shadow-lg active:scale-95"
            style={{ zIndex: 100 }}
            id="mock-camera-capture-btn"
          >
            [Dev Only] Mock Camera Scan Capture
          </button>
        )}
      </div>
 
      {/* Camera Switch Toggle Button */}
      {isCameraReady && testTimer === null && countdown === null && (
        <button
          onClick={toggleCamera}
          className="absolute top-4 right-4 w-12 h-12 bg-black/40 backdrop-blur-md rounded-full text-white flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.3)] border border-cyan-400/30 z-[60] hover:bg-black/60 hover:scale-105 active:scale-95 transition-all pointer-events-auto"
          title={t('camera.switchCamera')}
        >
          <i className="fas fa-sync-alt text-xl"></i>
        </button>
      )}

      <canvas ref={skeletonCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />
      <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export default CameraModule;
