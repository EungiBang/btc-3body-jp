import React, { useEffect, useRef, useState } from 'react';
import { initializeMediaPipe } from '../services/mediapipe';
import { calculateMetrics } from '../utils/physiognomy';
import { PhysiognomyMetrics } from '../types';

interface CameraScannerProps {
  onScanComplete: (metrics: PhysiognomyMetrics[], imageSrc: string) => void;
}

export default function CameraScanner({ onScanComplete }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const metricsBuffer = useRef<PhysiognomyMetrics[]>([]);
  const isScanning = useRef(false);
  const requestRef = useRef<number>(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const [retryCount, setRetryCount] = useState(0);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    setIsReady(false);
    setRetryCount(prev => prev + 1);
  };

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function setupCamera() {
      const constraints = {
        video: { 
          facingMode: facingMode, 
          width: { ideal: 640 }, 
          height: { ideal: 480 } 
        }
      };

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('이 브라우저에서는 카메라 기능을 지원하지 않습니다.');
        }

        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
          console.warn('Primary camera constraints failed, trying fallback:', e);
          // Try with very basic constraints
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: true 
          });
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Use onloadeddata for better compatibility on some systems
          videoRef.current.onloadeddata = () => {
            if (videoRef.current) {
              videoRef.current.play().catch(e => {
                console.error("Video play error:", e);
                setError("비디오 재생을 시작할 수 없습니다. 화면을 터치해 보세요.");
              });
              setIsReady(true);
              setError(null);
            }
          };
        }
      } catch (err: any) {
        console.error('Camera setup error detail:', err);
        if (err.name === 'NotAllowedError' || err.message?.includes('denied')) {
          setError('카메라 접근 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해 주세요.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('연결된 카메라를 찾을 수 없습니다.');
        } else {
          setError(`카메라를 시작할 수 없습니다: ${err.message || '장치가 사용 중이거나 지원되지 않습니다.'}`);
        }
      }
    }

    setupCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      cancelAnimationFrame(requestRef.current);
    };
  }, [retryCount]);

  useEffect(() => {
    if (!isReady) return;

    async function processVideo() {
      const faceLandmarker = await initializeMediaPipe();
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      let lastVideoTime = -1;
      let lastLandmarks: any[] = [];
      let movementThreshold = 0.015; // Stability threshold

      function renderLoop() {
        if (!video || !canvas || !ctx) return;

        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const results = faceLandmarker.detectForVideo(video, performance.now());

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Draw Face Guide Overlay (항상 표시)
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          const radiusX = canvas.width * 0.22;
          const radiusY = canvas.height * 0.32;

          ctx.beginPath();
          ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 8]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Guide Text (항상 표시)
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.font = 'bold 16px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText("얼굴을 타원 안에 맞추고,", centerX, centerY - radiusY - 45);
          ctx.fillText("귀가 보이도록 머리를 넘겨주세요.", centerX, centerY - radiusY - 25);
          ctx.fillText("카메라를 눈높이 정면에 위치시켜주세요", centerX, centerY - radiusY - 5);

          if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            const landmarks = results.faceLandmarks[0];
            const blendshapes = results.faceBlendshapes?.[0];

            // Stability check
            let isMovingTooMuch = false;
            if (lastLandmarks.length > 0) {
              const diff = Math.sqrt(
                Math.pow(landmarks[1].x - lastLandmarks[1].x, 2) + 
                Math.pow(landmarks[1].y - lastLandmarks[1].y, 2)
              );
              if (diff > movementThreshold) isMovingTooMuch = true;
            }
            lastLandmarks = landmarks;

            // Helper for mirrored drawing
            const getX = (x: number) => (1 - x) * canvas.width;
            const getY = (y: number) => y * canvas.height;

            // Draw mesh with color feedback
            ctx.strokeStyle = isMovingTooMuch ? 'rgba(255, 0, 0, 0.3)' : 'rgba(0, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            landmarks.forEach((point) => {
              ctx.beginPath();
              ctx.arc(getX(point.x), getY(point.y), 1, 0, 2 * Math.PI);
              ctx.fillStyle = isMovingTooMuch ? 'rgba(255, 0, 0, 0.5)' : 'rgba(0, 255, 255, 0.8)';
              ctx.fill();
            });

            if (isScanning.current && blendshapes) {
              // Only collect metrics if face is relatively stable
              if (!isMovingTooMuch) {
                const metrics = calculateMetrics(landmarks, blendshapes);
                metricsBuffer.current.push(metrics);
              }
              
              const count = metricsBuffer.current.length;
              const totalFrames = 120; // Increased for better stability
              const currentProgress = Math.min((count / totalFrames) * 100, 100);
              setProgress(currentProgress);

              // Region scanning VFX
              const regions = [
                { idx: 10, label: '상정(SPIRIT)', color: 'rgba(56, 189, 248, 0.4)' },
                { idx: 1, label: '물형(MORPHOLOGY)', color: 'rgba(168, 85, 247, 0.4)' },
                { idx: 152, label: '하정(PHYSICAL)', color: 'rgba(34, 197, 94, 0.4)' },
                { idx: 33, label: '좌오관', color: 'rgba(251, 191, 36, 0.4)' },
                { idx: 263, label: '우오관', color: 'rgba(251, 191, 36, 0.4)' },
              ];

              const currentRegionIdx = Math.floor((count / totalFrames) * regions.length);
              const region = regions[currentRegionIdx % regions.length];
              
              if (region && !isMovingTooMuch) {
                const p = landmarks[region.idx];
                const rx = getX(p.x);
                const ry = getY(p.y);
                
                ctx.beginPath();
                ctx.arc(rx, ry, 40 + Math.sin(Date.now() / 100) * 10, 0, 2 * Math.PI);
                ctx.fillStyle = region.color;
                ctx.fill();
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                ctx.fillStyle = 'white';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(region.label, rx, ry - 55);
              }

              if (isMovingTooMuch) {
                  ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
                  ctx.font = 'bold 14px sans-serif';
                  ctx.textAlign = 'center';
                  ctx.fillText("움직임을 멈추고 정면을 응시해주세요", canvas.width / 2, canvas.height - 40);
              }

              if (metricsBuffer.current.length >= totalFrames) {
                isScanning.current = false;
                
                // Capture the final frame (Mirrored to match UI)
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.save();
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                ctx.restore();
                
                ctx.fillStyle = 'rgba(34, 211, 238, 0.8)';
                landmarks.forEach((point) => {
                  ctx.beginPath();
                  // We draw relative to the already mirrored image in the canvas context
                  // But wait, the context was restored. 
                  // If we want landmarks to align on top of the mirrored image captured above:
                  ctx.arc(getX(point.x), getY(point.y), 1.5, 0, 2 * Math.PI);
                  ctx.fill();
                });
                
                const imageSrc = canvas.toDataURL('image/jpeg', 0.9);
                onScanComplete(metricsBuffer.current, imageSrc);
                return; // Stop loop
              }
            }
          }
        }
        requestRef.current = requestAnimationFrame(renderLoop);
      }
      
      requestRef.current = requestAnimationFrame(renderLoop);
    }

    processVideo();
  }, [isReady, onScanComplete]);

  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsAnalyzingImage(true);
    try {
      const imageUrl = URL.createObjectURL(file);
      const img = new Image();
      img.src = imageUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const faceLandmarker = await initializeMediaPipe('IMAGE');
      const results = faceLandmarker.detect(img);

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0];
        const blendshapes = results.faceBlendshapes?.[0];
        
        if (blendshapes) {
          const metrics = calculateMetrics(landmarks, blendshapes);
          
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          const ctx = tempCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            ctx.fillStyle = 'rgba(34, 211, 238, 0.8)';
            landmarks.forEach((point) => {
              ctx.beginPath();
              ctx.arc(point.x * tempCanvas.width, point.y * tempCanvas.height, Math.max(2, img.width / 300), 0, 2 * Math.PI);
              ctx.fill();
            });
            const finalImageSrc = tempCanvas.toDataURL('image/jpeg', 0.9);
            onScanComplete([metrics], finalImageSrc);
          }
        } else {
          alert("얼굴 특징을 분석할 수 없습니다. 다른 사진을 시도해주세요.");
        }
      } else {
        alert("얼굴을 찾을 수 없습니다. 정면 얼굴 사진을 업로드해주세요.");
      }
    } catch (err) {
      console.error("Image analysis error:", err);
      alert("이미지 분석 중 오류가 발생했습니다.");
    } finally {
      setIsAnalyzingImage(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const startScan = () => {
    metricsBuffer.current = [];
    setProgress(0);
    isScanning.current = true;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('링크가 복사되었습니다. Safari나 Chrome 브라우저 주소창에 붙여넣기 해주세요.');
  };

  const handleRetry = () => {
    setError(null);
    setIsReady(false);
    setRetryCount(prev => prev + 1);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white rounded-3xl border border-red-100 shadow-xl text-gray-800 max-w-md mx-auto mt-10">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <i className="fas fa-exclamation-circle text-3xl text-red-500"></i>
        </div>
        <h3 className="text-xl font-bold mb-2 text-gray-900">카메라 접근 실패</h3>
        <p className="text-center text-gray-600 mb-6 leading-relaxed">
          {error}
          <br /><br />
          <span className="font-semibold text-red-500">💡 미리보기 화면이나 인앱 브라우저</span>에서는 보안상 카메라가 작동하지 않을 수 있습니다. 
          <br />아래 버튼을 눌러 <span className="font-bold text-gray-900">새 창(새 탭)</span>에서 앱을 단독으로 실행해주세요.
        </p>
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={handleRetry}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-full transition-colors shadow-md w-full"
          >
            <i className="fas fa-redo"></i>
            <span>다시 시도하기</span>
          </button>
          <label className={`flex items-center justify-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-full transition-colors shadow-md w-full cursor-pointer ${isAnalyzingImage ? 'opacity-70 pointer-events-none' : ''}`}>
            <i className="fas fa-upload"></i>
            <span>{isAnalyzingImage ? '사진 분석 중...' : '사진 업로드하여 분석하기'}</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={isAnalyzingImage} />
          </label>
          <button
            onClick={() => window.open(window.location.href, '_blank')}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-full transition-colors shadow-sm w-full"
          >
            <i className="fas fa-external-link-alt"></i>
            <span>새 창에서 열기 (카메라 사용)</span>
          </button>
          <button
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-full transition-colors w-full"
          >
            <i className="fas fa-copy"></i>
            <span>앱 링크 복사하기</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[3/4] bg-gray-900 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover -scale-x-100"
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {/* Camera Switch Toggle Button */}
      {isReady && !isScanning.current && (
        <button
          onClick={toggleCamera}
          className="absolute top-4 right-4 w-12 h-12 bg-black/40 backdrop-blur-md rounded-full text-white flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.3)] border border-cyan-400/30 z-[60] hover:bg-black/60 hover:scale-105 active:scale-95 transition-all"
          title="카메라 방향 전환"
        >
          <i className="fas fa-sync-alt text-xl"></i>
        </button>
      )}

      {/* Overlay UI */}
      <div className="absolute inset-0 flex flex-col items-center justify-between p-6 bg-gradient-to-t from-gray-900/80 via-transparent to-gray-900/40">
        <div className="text-center mt-4">
          <h3 className="text-white font-medium text-lg tracking-wide drop-shadow-md">
            {isScanning.current ? "정밀 스캔 중..." : "얼굴을 화면 중앙에 맞춰주세요"}
          </h3>
          <p className="text-white/70 text-sm mt-1 drop-shadow-md">
            {isScanning.current ? "자연스럽게 표정을 지어보세요" : "준비가 되면 아래 버튼을 눌러주세요"}
          </p>
        </div>

        <div className="relative w-64 h-64">
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-cyan-400/50 animate-[spin_20s_linear_infinite]" />
          {isScanning.current && (
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle
                cx="128"
                cy="128"
                r="126"
                fill="none"
                stroke="rgba(34, 211, 238, 0.2)"
                strokeWidth="4"
              />
              <circle
                cx="128"
                cy="128"
                r="126"
                fill="none"
                stroke="rgba(34, 211, 238, 1)"
                strokeWidth="4"
                strokeDasharray="791.68"
                strokeDashoffset={791.68 - (791.68 * progress) / 100}
                className="transition-all duration-100 ease-linear"
              />
            </svg>
          )}
        </div>

        <div className="mb-4 flex flex-col items-center gap-3 w-full px-8">
          {!isScanning.current ? (
            <>
              <button
                onClick={startScan}
                disabled={!isReady || isAnalyzingImage}
                className="flex items-center justify-center gap-2 w-full py-4 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-700 disabled:text-gray-400 text-gray-950 font-semibold rounded-full transition-all active:scale-95 shadow-[0_0_20px_rgba(34,211,238,0.4)]"
              >
                <i className="fas fa-camera text-lg"></i>
                <span>안면 노화 분석 시작</span>
              </button>
              <label className={`flex items-center justify-center gap-2 w-full py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-full transition-all cursor-pointer backdrop-blur-sm border border-white/10 ${isAnalyzingImage ? 'opacity-50 pointer-events-none' : ''}`}>
                <i className="fas fa-image text-lg"></i>
                <span>{isAnalyzingImage ? '분석 중...' : '사진 업로드'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={isAnalyzingImage} />
              </label>
            </>
          ) : (
            <div className="text-cyan-400 font-mono text-xl font-bold drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
              {Math.round(progress)}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
