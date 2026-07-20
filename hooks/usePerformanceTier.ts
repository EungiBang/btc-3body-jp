import { useState, useEffect } from 'react';

export type PerformanceTier = 'high' | 'medium' | 'low';

interface PerformanceInfo {
  tier: PerformanceTier;
  cpuCores: number;
  memoryGB: number | null;
  gpuRenderer: string;
  poseInterval: number;       // 포즈 추정 간격 (ms)
  videoWidth: number;          // 카메라 프리뷰 해상도
  videoHeight: number;
  drawSkeleton: boolean;       // 스켈레톤 표시 여부
  poseInputSize: number;       // 포즈 추정용 다운스케일 크기
}

const CACHE_KEY = 'btc_performance_tier';
const CACHE_VERSION = 'v1.3';

const getGPURenderer = (): string => {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'Unknown';
      }
    }
  } catch {}
  return 'Unknown';
};

/**
 * 간단한 벤치마크: Canvas 2D 그리기 + 기본 연산 속도 측정
 * 실제 TF.js를 로딩하지 않고도 대략적인 디바이스 성능을 판단합니다.
 */
const runBenchmark = (): number => {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 240;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 9999;

  const start = performance.now();
  
  // Canvas 드로잉 + 수학 연산 혼합 벤치마크
  for (let i = 0; i < 100; i++) {
    ctx.fillStyle = `rgba(${i % 256}, ${(i * 2) % 256}, ${(i * 3) % 256}, 0.5)`;
    ctx.fillRect(0, 0, 320, 240);
    ctx.getImageData(0, 0, 160, 120);
    
    // 수학 연산 부하
    let sum = 0;
    for (let j = 0; j < 10000; j++) {
      sum += Math.sin(j * 0.001) * Math.cos(j * 0.002);
    }
  }
  
  return performance.now() - start;
};

const determineTier = (): PerformanceInfo => {
  // 앱(Electron)일 경우 os 속성에서 정확한 100% 진짜 스펙을 읽어옵니다 (브라우저 제한 무시)
  const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : null;
  const isElectron = !!electronAPI;
  
  let cpuCores = navigator.hardwareConcurrency || 2;
  let memoryGB = (navigator as any).deviceMemory || null;

  if (isElectron && electronAPI.getSystemCpuCores && electronAPI.getSystemMemory) {
    try {
      cpuCores = electronAPI.getSystemCpuCores();
      const memBytes = electronAPI.getSystemMemory();
      memoryGB = Math.round(memBytes / (1024 * 1024 * 1024)); // 바이츠를 GB로 환산
    } catch (e) {
      console.error("OS 하드웨어 정보 읽기 실패:", e);
    }
  }

  const gpuRenderer = getGPURenderer();
  
  // 벤치마크 실행
  const benchmarkMs = runBenchmark();
  
  // 점수 산정 (낮을수록 좋음)
  let score = 0;
  
  // CPU 코어
  if (cpuCores >= 8) score += 3;
  else if (cpuCores >= 4) score += 2;
  else score += 0;
  
  // RAM
  if (memoryGB !== null) {
    if (memoryGB >= 8) score += 2;
    else if (memoryGB >= 4) score += 1;
    else score += 0;
  } else {
    score += 1; // 알 수 없으면 중간
  }
  
  // 벤치마크 결과
  if (benchmarkMs < 200) score += 3;
  else if (benchmarkMs < 500) score += 2;
  else if (benchmarkMs < 1000) score += 1;
  else score += 0;
  
  // GPU (알려진 저성능 GPU 감지)
  const gpuLower = gpuRenderer.toLowerCase();
  const isLowGPU = gpuLower.includes('intel hd') || 
                    gpuLower.includes('intel(r) hd') ||
                    gpuLower.includes('swiftshader') ||
                    gpuLower.includes('llvmpipe');
  if (isLowGPU) score -= 1;

  let tier: PerformanceTier;
  if (score >= 7) tier = 'high';
  else if (score >= 4) tier = 'medium';
  else tier = 'low';

  console.log(`[Performance] Score: ${score}, Tier: ${tier.toUpperCase()}, Benchmark: ${benchmarkMs.toFixed(0)}ms, Cores: ${cpuCores}, RAM: ${memoryGB}GB, GPU: ${gpuRenderer}`);

  // 티어별 설정
  const configs: Record<PerformanceTier, Omit<PerformanceInfo, 'cpuCores' | 'memoryGB' | 'gpuRenderer'>> = {
    high: {
      tier: 'high',
      poseInterval: 1500,
      videoWidth: 854,
      videoHeight: 480,
      drawSkeleton: true,
      poseInputSize: 320,
    },
    medium: {
      tier: 'medium',
      poseInterval: 2000,
      videoWidth: 640,
      videoHeight: 360,
      drawSkeleton: true,
      poseInputSize: 256,
    },
    low: {
      tier: 'low',
      poseInterval: 3000,
      videoWidth: 480,
      videoHeight: 270,
      drawSkeleton: false,   // 저사양에서는 스켈레톤 오버레이 제거
      poseInputSize: 192,
    },
  };

  return {
    ...configs[tier],
    cpuCores,
    memoryGB,
    gpuRenderer,
  };
};

export const usePerformanceTier = () => {
  const [perfInfo, setPerfInfo] = useState<PerformanceInfo | null>(null);

  useEffect(() => {
    // 캐시된 결과 확인
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.version === CACHE_VERSION) {
          console.log(`[Performance] Using cached tier: ${parsed.data.tier.toUpperCase()}`);
          setPerfInfo(parsed.data);
          return;
        }
      }
    } catch {}

    // 벤치마크 실행 (약간의 지연 후 — UI 렌더링 방해 안 하도록)
    const timer = setTimeout(() => {
      const info = determineTier();
      setPerfInfo(info);
      
      // 캐싱
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          version: CACHE_VERSION,
          timestamp: Date.now(),
          data: info,
        }));
      } catch {}
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // 캐시 초기화 (사양 변경 시 사용)
  const resetCache = () => {
    localStorage.removeItem(CACHE_KEY);
    const info = determineTier();
    setPerfInfo(info);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        version: CACHE_VERSION,
        timestamp: Date.now(),
        data: info,
      }));
    } catch {}
  };

  return { perfInfo, resetCache };
};
