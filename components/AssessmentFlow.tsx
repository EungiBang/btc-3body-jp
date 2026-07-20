/// <reference types="vite/client" />
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AssessmentStep, CapturedImage, BodyReport, UserInfo, MemberRecord, BrainTestData } from '../types';
import pkg from '../package.json';
import CameraModule from './CameraModule';
import { analyzeHealth } from '../services/geminiService';
import { speak, initAudio } from '../services/ttsService';
import ReportDashboard from './ReportDashboard';
import UserInfoForm from './UserInfoForm';
import HistoryManager from './HistoryManager';
import Modal from './Modal';
import Toast from './Toast';
import { logUsage } from '../services/statsService';
import { SystemCheckOverlay } from './SystemCheckOverlay';
import { saveRecordLocally, deleteRecordLocally } from '../services/localDb';
import BrainTestModule from './BrainTestModule';
import { TmtBrainTestModule } from './TmtBrainTestModule';
import SevenCodeCheckModule from './SevenCodeCheckModule';
import KFaceApp from './KFaceApp';
import KTarotApp from './KTarotApp';
import { addToWaitingList, updateWaitingStatus, subscribeWaitingList, deleteWaitingMember, updateWaitingStarred } from '../services/eventService';
import { BRAND_NAME, SUB_NAME } from '@shared/constants/brand';
import { WaitingMember } from '../types';

const CHAKRA_MAP: Record<number, string> = {
  1: 'Code 1',
  2: 'Code 2',
  3: 'Code 3',
  4: 'Code 4',
  5: 'Code 5',
  6: 'Code 6',
  7: 'Code 7'
};

const HEALTH_NEEDS_EN: Record<string, string> = {
  sleep: '睡眠の質の向上',
  stress: 'ストレスの解消',
  emotion: '感情のコントロール',
  mental: 'メンタルケア・心の回復力',
  focus: '集中力と脳의明瞭さの向上',
  relationship: '人間関係の改善',
  stamina: '体力の向上',
  pain: '体の痛みの緩和',
  diet: '体重管理・ダイエット',
  anger: '怒りのコントロール',
  youth: 'アンチエイジング・若返り',
  happiness: '幸福感の向上'
};

const resizeImage = (dataUrl: string, maxWidth = 400): Promise<string> => {
  return new Promise((resolve) => {
    if (!dataUrl) {
      resolve('');
      return;
    }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress to 70% quality
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => {
      console.warn('Image loading failed in resizeImage');
      resolve(dataUrl); // Resolve with original dataUrl on error to prevent hang
    };
    img.src = dataUrl;
  });
};

const AssessmentFlow: React.FC = () => {
  const { t } = useTranslation();
  const [step, setStep] = useState<AssessmentStep | 'HISTORY'>(AssessmentStep.INTRO);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [report, setReport] = useState<BodyReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean, message: string, showRetry?: boolean }>({ isOpen: false, message: '', showRetry: false });
  const [toast, setToast] = useState<{ isVisible: boolean, message: string, type: 'success' | 'error' | 'info' }>({ isVisible: false, message: '', type: 'success' });
  const [hasStarted, setHasStarted] = useState(false);
  const [showSysCheck, setShowSysCheck] = useState(false);
  const [repInputModal, setRepInputModal] = useState<{ isOpen: boolean, step: AssessmentStep | null, dataUrl: string, formScore?: number, kneeAssisted?: boolean, postureData?: any }>({ isOpen: false, step: null, dataUrl: '' });
  const [repCount, setRepCount] = useState<string>('');
  const [manualRepPosture, setManualRepPosture] = useState<string>('Fair');
  // Balance test manual input modal
  const [balanceInputModal, setBalanceInputModal] = useState<{ isOpen: boolean, dataUrl: string, aiFootDrops: number, aiSwayScore: number }>({ isOpen: false, dataUrl: '', aiFootDrops: 0, aiSwayScore: 0 });
  const [manualFootDrops, setManualFootDrops] = useState<string>('0');
  const [manualSwayLevel, setManualSwayLevel] = useState<string>('3'); // 1~5 scale

  // State for outdoor event and queue integration
  const [activeEventCode, setActiveEventCode] = useState<string>(localStorage.getItem('activeEventCode') || '');
  const [currentBranchId, setCurrentBranchId] = useState<string>('');
  const [currentBranchName, setCurrentBranchName] = useState<string>('');
  const [isReceptionOnly, setIsReceptionOnly] = useState(false);
  const [isWaitingMemberActive, setIsWaitingMemberActive] = useState(false);
  const [activeWaitingId, setActiveWaitingId] = useState<string | null>(null);
  const [waitingList, setWaitingList] = useState<WaitingMember[]>([]);
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [selectedKeywordsToShow, setSelectedKeywordsToShow] = useState<{ name: string, keywords: string[], weakestCode: number } | null>(null);

  // Health needs assessment step state
  const [showHealthNeeds, setShowHealthNeeds] = useState(false);
  const [selectedHealthNeeds, setSelectedHealthNeeds] = useState<string[]>([]);
  const [customHealthNeed, setCustomHealthNeed] = useState('');
  const [pendingSevenCodeData, setPendingSevenCodeData] = useState<{ keywords: string[], weakestCode: number } | null>(null);

  // Branch info load and event listener effects
  useEffect(() => {
    const currentDeviceJson = localStorage.getItem('currentDevice');
    if (currentDeviceJson) {
      try {
        const device = JSON.parse(currentDeviceJson);
        setCurrentBranchId(device.branchId || 'unknown');
        
        import('../services/firebaseAuthService').then(({ getBranches }) => {
          getBranches().then(branches => {
            const matched = branches.find(b => b.id === device.branchId);
            if (matched) setCurrentBranchName(matched.name);
          });
        });
      } catch (e) {
        console.error('Failed to parse currentDevice info', e);
      }
    }

    const handleEventCodeChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      const code = customEvent.detail?.eventCode || '';
      setActiveEventCode(code);
    };

    window.addEventListener('eventCode:change', handleEventCodeChange);
    return () => {
      window.removeEventListener('eventCode:change', handleEventCodeChange);
    };
  }, []);

  // Real-time queue subscription effect
  useEffect(() => {
    if (!currentBranchId) return;
    
    const unsubscribe = subscribeWaitingList(
      currentBranchId,
      activeEventCode || null,
      (list) => {
        setWaitingList(list);
      }
    );
    
    return () => unsubscribe();
  }, [currentBranchId, activeEventCode]);

  // De-duplicated queue list (matching name, contact, age, gender)
  const uniqueWaitingList = waitingList.filter((member, index, self) =>
    self.findIndex(m => 
      m.name === member.name && 
      m.phone === member.phone && 
      m.age === member.age && 
      m.gender === member.gender
    ) === index
  );

  // Delete waitlisted person (batch-delete duplicates with same info)
  const handleDeleteWaiting = async (e: React.MouseEvent, member: WaitingMember) => {
    e.stopPropagation(); // Prevent measurement-start event propagation on card click
    
    if (!window.confirm(t('waitingList.deleteConfirm', { name: member.name }))) {
      return;
    }
    
    try {
      const duplicates = waitingList.filter(m => 
        m.name === member.name && 
        m.phone === member.phone && 
        m.age === member.age && 
        m.gender === member.gender
      );
      
      const deletePromises = duplicates.map(m => deleteWaitingMember(m.id));
      const results = await Promise.all(deletePromises);
      
      if (results.every(res => res)) {
        setToast({ isVisible: true, message: t('waitingList.deleteSuccess'), type: 'success' });
      } else {
        setToast({ isVisible: true, message: t('waitingList.deleteFailedPartial'), type: 'error' });
      }
    } catch (err) {
      console.error('[Queue] Delete error:', err);
      setToast({ isVisible: true, message: t('waitingList.deleteFailedError'), type: 'error' });
    }
  };

  // Arm raise manual verification modal
  const [armRaiseInputModal, setArmRaiseInputModal] = useState<{ isOpen: boolean, dataUrl: string, postureData: any }>({ isOpen: false, dataUrl: '', postureData: null });
  const [manualArmRaiseGrade, setManualArmRaiseGrade] = useState<string>('');

  // Flexibility manual verification modal
  const [flexInputModal, setFlexInputModal] = useState<{ isOpen: boolean, dataUrl: string, postureData: any }>({ isOpen: false, dataUrl: '', postureData: null });
  const [manualFlexGrade, setManualFlexGrade] = useState<string>('');

  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [pendingRecordId, setPendingRecordId] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [showDeviceSelect, setShowDeviceSelect] = useState(false);
  const [eyesClosed, setEyesClosed] = useState(true); // Balance test eye state (default: eyes closed)
  // Photo preview state (originalDataUrl: original for Gemini analysis, dataUrl: display/composite)
  const [previewData, setPreviewData] = useState<{ dataUrl: string; originalDataUrl: string; metadata?: any; validationResult?: { passed: boolean; message: string } | null } | null>(null);
  const [targetStepAfterUserInfo, setTargetStepAfterUserInfo] = useState<AssessmentStep | null>(null);

  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true, audio: false }).catch(() => {});
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
        setDevices(videoDevices);
      } catch (err) {
        console.error("Error enumerating devices:", err);
      }
    };
    getDevices();
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
  }, []);

  const getStepGuidance = (currentStep: AssessmentStep | 'HISTORY' | 'INTRO') => {
    switch (currentStep) {
      case AssessmentStep.INTRO:
        return t('assessment.introGuidance');
      case AssessmentStep.USER_INFO:
        return t('assessment.userInfoGuidance');
      case AssessmentStep.POSTURE_FRONT:
        return t('assessment.postureFrontGuidance');
      case AssessmentStep.POSTURE_SIDE:
        return t('assessment.postureSideGuidance');
      case AssessmentStep.BALANCE_TEST:
        return t('assessment.balanceTestGuidance');
      case AssessmentStep.BRAIN_MEMORY:
        return t('assessment.brainMemoryGuidance');
      case AssessmentStep.FACE_ANALYSIS:
        return t('assessment.faceAnalysisGuidance');
      case AssessmentStep.SEVEN_CODE_CHECK:
        return t('assessment.sevenCodeCheckGuidance');
      case AssessmentStep.ANALYZING:
        return t('assessment.analyzingGuidance');
      case AssessmentStep.REPORT:
        return t('assessment.reportGuidance');
      default:
        return "";
    }
  };

  useEffect(() => {
    const handleNavHome = () => {
      setTargetStepAfterUserInfo(null);
      setStep(AssessmentStep.INTRO);
    };
    const handleNavHistory = () => {
      setTargetStepAfterUserInfo(null);
      setStep('HISTORY');
    };
    const handleNavFaceAnalysis = () => {
      if (!userInfo) {
        setTargetStepAfterUserInfo(AssessmentStep.FACE_ANALYSIS);
        setStep(AssessmentStep.USER_INFO);
        return;
      }
      setStep(AssessmentStep.FACE_ANALYSIS);
    };
    const handleNavKFace = () => {
      alert('K-観相学サービスはまもなく開始されます。');
    };
    const handleNavKTarot = () => {
      alert('K-タロットサービスはまもなく開始されます。');
    };

    window.addEventListener('nav:home', handleNavHome);
    window.addEventListener('nav:history', handleNavHistory);
    window.addEventListener('nav:face_analysis', handleNavFaceAnalysis);
    window.addEventListener('nav:kface', handleNavKFace);
    window.addEventListener('nav:ktarot', handleNavKTarot);

    return () => {
      window.removeEventListener('nav:home', handleNavHome);
      window.removeEventListener('nav:history', handleNavHistory);
      window.removeEventListener('nav:face_analysis', handleNavFaceAnalysis);
      window.removeEventListener('nav:kface', handleNavKFace);
      window.removeEventListener('nav:ktarot', handleNavKTarot);
    };
  }, [userInfo]);

  useEffect(() => {
    // Only handle other startup tasks here, the TTS for intro is handled by getStepGuidance in the other useEffect
  }, [hasStarted]);

  const testSteps = [
    AssessmentStep.POSTURE_FRONT, AssessmentStep.POSTURE_SIDE,
    AssessmentStep.BALANCE_TEST, AssessmentStep.BRAIN_MEMORY,
    AssessmentStep.FACE_ANALYSIS, AssessmentStep.SEVEN_CODE_CHECK, AssessmentStep.ANALYZING
  ];
  useEffect(() => {
    const isTest = testSteps.includes(step as AssessmentStep);
    window.dispatchEvent(new CustomEvent('test:mode', { detail: { active: isTest } }));
  }, [step]);

  useEffect(() => {
    if (!hasStarted) return;
    const guidance = getStepGuidance(step);
    if (guidance) {
      speak(guidance);
    }
  }, [step, hasStarted]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (step === AssessmentStep.ANALYZING) {
      setAnalyzeProgress(0);
      const startTime = Date.now();
      interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setAnalyzeProgress(prev => {
          // 0~30s: 0→80%, 30~60s: 80→95%, 60~90s: 95→99%
          if (elapsed < 30) return Math.min(prev + 2.5, 80);
          if (elapsed < 60) return Math.min(prev + 0.5, 95);
          return Math.min(prev + 0.1, 99);
        });
      }, 300);
    }
    return () => clearInterval(interval);
  }, [step]);

  const saveRecord = async (rep: BodyReport, imgs: CapturedImage[]) => {
    try {
      // Resize images for storage to stay under the 1MB document limit
      const resizedImages = await Promise.all(imgs.map(async (img) => {
        const resized = {
          step: img.step,
          dataUrl: await resizeImage(img.dataUrl, 200) // Smaller thumbnails
        } as CapturedImage;
        
        if (img.reps !== undefined)         resized.reps = img.reps;
        if (img.duration !== undefined)      resized.duration = img.duration;
        if (img.formScore !== undefined)     resized.formScore = img.formScore;
        if (img.kneeAssisted !== undefined)  resized.kneeAssisted = img.kneeAssisted;
        if (img.balanceData !== undefined)   resized.balanceData = img.balanceData;
        
        return resized;
      }));

      const newRecord: MemberRecord = {
        id: rep.id,
        name: rep.userInfo.name,
        lastTestDate: rep.date,
        report: rep,
        images: resizedImages,
        ownerUid: 'local-branch'
      };
      
      const success = await saveRecordLocally(newRecord);
      if (success) {
        setToast({ isVisible: true, message: t(['assessment.dataSavedSuccess', 'report.dataSavedSuccess']), type: 'success' });
        
        // Usage statistics logging
        try {
          const deviceStr = localStorage.getItem('currentDevice');
          if (deviceStr) {
            const device = JSON.parse(deviceStr);
            if (device.branchId && device.id) {
              logUsage(device.branchId, device.id).catch(console.error);
            }
          }
        } catch (e) {
          console.error('Failed to log usage:', e);
        }

      } else {
        setToast({ isVisible: true, message: t(['assessment.saveFailed', 'report.saveFailed']), type: 'error' });
      }
    } catch (error) {
      console.error("Local DB Save Error:", error);
      setToast({ isVisible: true, message: t(['assessment.saveError', 'report.saveError']), type: 'error' });
    }
  };

  const handleUserSubmit = (info: UserInfo) => {
    setUserInfo(info);
    // Reset previous data on new measurement start (prevent duplicates after history view)
    setCapturedImages([]);
    setReport(null);
    // Always run 7-code survey right after personal info entry (pre-registration or one-stop)
    setStep(AssessmentStep.SEVEN_CODE_CHECK);
  };

  const handleCapture = (dataUrl: string, autoReps?: number, metadata?: any) => {
    // Merge autoReps(number) and metadata(object) into a single object for storage
    const mergedMetadata = { ...metadata, reps: autoReps };
    // Switch to preview after capture (originalDataUrl preserved for Gemini analysis)
    setPreviewData({ dataUrl, originalDataUrl: dataUrl, metadata: mergedMetadata, validationResult: null });
    speak("写真が正常に撮影されました。");

    // Post-capture validation: full-body check only on steps 1,2,4,5 (still shots)
    const requiresValidation = [
      AssessmentStep.POSTURE_FRONT, AssessmentStep.POSTURE_SIDE
    ].includes(step as AssessmentStep);

    if (requiresValidation) {
      // Draw captured image on canvas and validate with MoveNet
      const img = new Image();
      img.onload = async () => {
        try {
          await import('@tensorflow/tfjs-core');
          await import('@tensorflow/tfjs-backend-webgl');
          const poseDetection = await import('@tensorflow-models/pose-detection');
          
          // Create model
          let detector: any;
          try {
            detector = await poseDetection.createDetector(
              poseDetection.SupportedModels.MoveNet,
              { modelType: (poseDetection as any).movenet.modelType.SINGLEPOSE_THUNDER } // Thunder model for accuracy
            );
          } catch {
            // Skip validation and pass if model load fails
            setPreviewData(prev => prev ? { ...prev, validationResult: { passed: true, message: '' } } : null);
            return;
          }

          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          
          const poses = await detector.estimatePoses(canvas);
          detector.dispose();
          
          if (poses.length > 0) {
            const kps = poses[0].keypoints;
            const visibleCount = kps.filter(kp => (kp.score || 0) > 0.25).length;
            
            // Body joints required (face-only not allowed)
            const bodyPartNames = ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle'];
            const visibleBodyParts = kps.filter(kp => bodyPartNames.includes(kp.name || '') && (kp.score || 0) > 0.3);
            const hasShoulder = kps.some(kp => (kp.name === 'left_shoulder' || kp.name === 'right_shoulder') && (kp.score || 0) > 0.3);
            const hasHip = kps.some(kp => (kp.name === 'left_hip' || kp.name === 'right_hip') && (kp.score || 0) > 0.3);
            
            // Shoulder+hip required (but arm-raise and flexibility allow missing hips)
            const needsHip = step === AssessmentStep.POSTURE_FRONT || step === AssessmentStep.POSTURE_SIDE;
            const hasRequiredParts = hasShoulder && (!needsHip || hasHip);
            
            if (hasRequiredParts) {
              
              // Posture validation: verify correct posture via joint positions (joint count alone is insufficient)
              const getKpCheck = (name: string) => kps.find(kp => kp.name === name);
              const lSh = getKpCheck('left_shoulder'), rSh = getKpCheck('right_shoulder');
              const lHp = getKpCheck('left_hip'), rHp = getKpCheck('right_hip');
              const lKn = getKpCheck('left_knee'), rKn = getKpCheck('right_knee');
              const lAn = getKpCheck('left_ankle'), rAn = getKpCheck('right_ankle');
              
              // Posture validation for current step
              const currentStep = step;
              let postureError = '';
              
              // === Upright check: exclude flexibility (bending) ===
              if (currentStep !== ('FLEXIBILITY_TEST' as any)) {
                const shoulderY = ((lSh?.y || 0) + (rSh?.y || 0)) / (lSh && rSh ? 2 : 1);
                const hipY = ((lHp?.y || 0) + (rHp?.y || 0)) / (lHp && rHp ? 2 : 1);
                
                if (shoulderY > 0 && hipY > 0) {
                  // If shoulders below hips -> sitting or lying down
                  if (shoulderY > hipY) {
                    postureError = 'まっすぐに立っていません。立ち上がって再撮影してください。';
                  }
                  // If shoulder-hip distance too small -> upper body only or too bent (arm-raise allows upper body only)
                  const torsoHeight = Math.abs(hipY - shoulderY);
                  const imgH = canvas.height;
                  if (torsoHeight < imgH * 0.08 && currentStep !== ('ARM_RAISE_TEST' as any)) {
                    postureError = '胴体が曲がりすぎています。まっすぐに立ってください。';
                  }
                }
              }
              
              // === Front shot: both shoulders/hips must be visible ===
              if (!postureError && currentStep === AssessmentStep.POSTURE_FRONT) {
                const hasLeftSh = lSh && (lSh.score || 0) > 0.3;
                const hasRightSh = rSh && (rSh.score || 0) > 0.3;
                const hasLeftHp = lHp && (lHp.score || 0) > 0.3;
                const hasRightHp = rHp && (rHp.score || 0) > 0.3;
                
                if (!hasLeftSh || !hasRightSh || !hasLeftHp || !hasRightHp) {
                  postureError = '正面を向いていません。カメラをまっすぐ見てください。';
                } else {
                  // Check shoulder symmetry (rotated body causes width difference)
                  const shoulderWidth = Math.abs((lSh?.x || 0) - (rSh?.x || 0));
                  const hipWidth = Math.abs((lHp?.x || 0) - (rHp?.x || 0));
                  if (shoulderWidth > 0 && hipWidth > 0) {
                    // Shoulder width less than 20% of hip width suggests side view
                    if (shoulderWidth < hipWidth * 0.4) {
                      postureError = '正面を向いていないようです。カメラをまっすぐ見てください。';
                    }
                  }
                }
              }
              
              // === Side shot: validation completely removed per user request (always passes) ===
              if (!postureError && currentStep === AssessmentStep.POSTURE_SIDE) {
                // Side detection logic removed: any angle is accepted
              }
              
              if (postureError) {
                setPreviewData(prev => prev ? { ...prev, validationResult: { passed: false, message: postureError } } : null);
                speak(postureError);
                return;
              }

              // === Posture validation passed -> AI analysis overlay compositing ===
              const w = canvas.width;
              const h = canvas.height;
              const getKp = (name: string) => kps.find(kp => kp.name === name);
              const isFrontView = currentStep === AssessmentStep.POSTURE_FRONT;

              // -- Step 1: Background blur (keep body sharp) --
              const visKps = kps.filter(kp => (kp.score || 0) > 0.2);
              if (visKps.length > 2) {
                const xs = visKps.map(kp => kp.x);
                const ys = visKps.map(kp => kp.y);
                const padX = w * 0.1, padTop = h * 0.08, padBot = h * 0.05;
                const bL = Math.max(0, Math.min(...xs) - padX);
                const bT = Math.max(0, Math.min(...ys) - padTop);
                const bR = Math.min(w, Math.max(...xs) + padX);
                const bB = Math.min(h, Math.max(...ys) + padBot);
                const bCx = (bL + bR) / 2, bCy = (bT + bB) / 2;
                const bRx = (bR - bL) / 2 * 1.15, bRy = (bB - bT) / 2 * 1.1;

                const blurC = document.createElement('canvas');
                blurC.width = w; blurC.height = h;
                const bCtx = blurC.getContext('2d')!;
                bCtx.filter = 'blur(14px) brightness(0.4)';
                bCtx.drawImage(canvas, 0, 0);
                bCtx.filter = 'none';
                // Crop body region (with feathering)
                bCtx.globalCompositeOperation = 'destination-out';
                const fg = bCtx.createRadialGradient(bCx, bCy, Math.min(bRx, bRy) * 0.5, bCx, bCy, Math.max(bRx, bRy));
                fg.addColorStop(0, 'rgba(0,0,0,1)');
                fg.addColorStop(0.65, 'rgba(0,0,0,0.95)');
                fg.addColorStop(1, 'rgba(0,0,0,0)');
                bCtx.fillStyle = fg;
                bCtx.beginPath();
                bCtx.ellipse(bCx, bCy, bRx, bRy, 0, 0, Math.PI * 2);
                bCtx.fill();
                bCtx.globalCompositeOperation = 'source-over';
                ctx.drawImage(blurC, 0, 0);
              }

              // -- Step 2: Grid pattern --
              ctx.strokeStyle = 'rgba(100,200,255,0.06)';
              ctx.lineWidth = 0.5;
              for (let gx = 0; gx < w; gx += 30) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
              for (let gy = 0; gy < h; gy += 30) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
              ctx.strokeStyle = 'rgba(100,200,255,0.12)';
              ctx.lineWidth = 1;
              for (let gx = 0; gx < w; gx += 120) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
              for (let gy = 0; gy < h; gy += 120) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

              // -- Step 3: Skeleton connection lines --
              const connections = [
                ['left_shoulder', 'right_shoulder'],
                ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'],
                ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'],
                ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'],
                ['left_hip', 'right_hip'],
                ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'],
                ['right_hip', 'right_knee'], ['right_knee', 'right_ankle'],
              ];
              connections.forEach(([a, b]) => {
                const kpA = getKp(a); const kpB = getKp(b);
                if (kpA && kpB && (kpA.score || 0) > 0.15 && (kpB.score || 0) > 0.15) {
                  ctx.save();
                  ctx.shadowColor = 'rgba(0,255,170,0.8)'; ctx.shadowBlur = 14;
                  ctx.strokeStyle = 'rgba(0,255,170,0.7)'; ctx.lineWidth = 3;
                  ctx.beginPath(); ctx.moveTo(kpA.x, kpA.y); ctx.lineTo(kpB.x, kpB.y); ctx.stroke();
                  ctx.restore();
                  ctx.strokeStyle = 'rgba(180,255,230,0.9)'; ctx.lineWidth = 1.5;
                  ctx.beginPath(); ctx.moveTo(kpA.x, kpA.y); ctx.lineTo(kpB.x, kpB.y); ctx.stroke();
                }
              });

              // -- Step 4: Joint points --
              kps.forEach(kp => {
                if ((kp.score || 0) > 0.15) {
                  ctx.save();
                  ctx.shadowColor = 'rgba(0,200,255,0.9)'; ctx.shadowBlur = 15;
                  ctx.fillStyle = 'rgba(0,200,255,0.8)';
                  ctx.beginPath(); ctx.arc(kp.x, kp.y, 7, 0, Math.PI * 2); ctx.fill();
                  ctx.restore();
                  ctx.fillStyle = 'rgba(255,255,255,0.95)';
                  ctx.beginPath(); ctx.arc(kp.x, kp.y, 3.5, 0, Math.PI * 2); ctx.fill();
                }
              });

              // Label badge helper
              const drawLabel = (text: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left') => {
                ctx.save();
                ctx.font = 'bold 11px monospace'; ctx.textAlign = align;
                const tw = ctx.measureText(text).width + 14;
                const lx = align === 'right' ? x - tw : align === 'center' ? x - tw / 2 : x;
                ctx.fillStyle = 'rgba(0,10,30,0.8)';
                ctx.beginPath();
                const r = 4; const ly = y - 10; const lh = 20;
                ctx.moveTo(lx + r, ly); ctx.lineTo(lx + tw - r, ly);
                ctx.arcTo(lx + tw, ly, lx + tw, ly + r, r); ctx.arcTo(lx + tw, ly + lh, lx + tw - r, ly + lh, r);
                ctx.arcTo(lx, ly + lh, lx, ly + lh - r, r); ctx.arcTo(lx, ly, lx + r, ly, r);
                ctx.fill();
                ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
                ctx.fillStyle = color;
                ctx.fillText(text, lx + 7, y + 4);
                ctx.restore();
              };

              // -- Step 5: Front (FRONT) measurement annotations --
              if (isFrontView) {
                const ls = getKp('left_shoulder'), rs = getKp('right_shoulder');
                const lh2 = getKp('left_hip'), rh2 = getKp('right_hip');
                // Shoulder horizontal line + tilt
                if (ls && rs && (ls.score || 0) > 0.2 && (rs.score || 0) > 0.2) {
                  ctx.save(); ctx.setLineDash([8, 6]);
                  ctx.strokeStyle = 'rgba(255,200,50,0.8)'; ctx.lineWidth = 2;
                  ctx.beginPath(); ctx.moveTo(Math.max(0, ls.x - 40), ls.y); ctx.lineTo(Math.min(w, rs.x + 40), rs.y); ctx.stroke();
                  ctx.restore();
                  const sAngle = Math.abs(Math.atan2(rs.y - ls.y, rs.x - ls.x) * (180 / Math.PI));
                  const sColor = sAngle < 2 ? 'rgba(52,211,153,0.95)' : sAngle < 5 ? 'rgba(251,191,36,0.95)' : 'rgba(239,68,68,0.95)';
                  const sMx = (ls.x + rs.x) / 2, sMy = Math.min(ls.y, rs.y) - 20;
                  drawLabel(`Shoulder Tilt ${sAngle.toFixed(1)}°`, sMx, sMy, sColor, 'center');
                  const hDiff = Math.abs(ls.y - rs.y);
                  if (hDiff > 5) {
                    const side = ls.y < rs.y ? 'L' : 'R';
                    drawLabel(`${side} Shoulder High`, sMx, sMy - 22, sColor, 'center');
                  }
                }
                // Pelvic horizontal line + tilt
                if (lh2 && rh2 && (lh2.score || 0) > 0.2 && (rh2.score || 0) > 0.2) {
                  ctx.save(); ctx.setLineDash([8, 6]);
                  ctx.strokeStyle = 'rgba(255,100,100,0.8)'; ctx.lineWidth = 2;
                  ctx.beginPath(); ctx.moveTo(Math.max(0, lh2.x - 40), lh2.y); ctx.lineTo(Math.min(w, rh2.x + 40), rh2.y); ctx.stroke();
                  ctx.restore();
                  const hAngle = Math.abs(Math.atan2(rh2.y - lh2.y, rh2.x - lh2.x) * (180 / Math.PI));
                  const hColor = hAngle < 2 ? 'rgba(52,211,153,0.95)' : hAngle < 5 ? 'rgba(251,191,36,0.95)' : 'rgba(239,68,68,0.95)';
                  drawLabel(`Pelvis Tilt ${hAngle.toFixed(1)}°`, (lh2.x + rh2.x) / 2, Math.max(lh2.y, rh2.y) + 25, hColor, 'center');
                }
                // Center axis
                const nose = getKp('nose');
                if (nose && (nose.score || 0) > 0.2) {
                  ctx.save(); ctx.setLineDash([12, 8]);
                  ctx.strokeStyle = 'rgba(100,150,255,0.4)'; ctx.lineWidth = 1.5;
                  ctx.beginPath(); ctx.moveTo(nose.x, Math.max(0, nose.y - 40));
                  ctx.lineTo(nose.x, Math.min(h, (lh2?.y || h * 0.7) + 80));
                  ctx.stroke(); ctx.restore();
                }
              }

              // -- Step 6: Side (SIDE) measurement annotations --
              if (!isFrontView) {
                // Find most visible ear and shoulder
                const lEar = getKp('left_ear'), rEar = getKp('right_ear');
                const ear = (lEar && rEar) ? ((lEar.score || 0) > (rEar.score || 0) ? lEar : rEar) : (lEar || rEar);
                const lS = getKp('left_shoulder'), rS = getKp('right_shoulder');
                const shoulder = (lS && rS) ? ((lS.score || 0) > (rS.score || 0) ? lS : rS) : (lS || rS);
                const lH = getKp('left_hip'), rH = getKp('right_hip');
                const hip = (lH && rH) ? ((lH.score || 0) > (rH.score || 0) ? lH : rH) : (lH || rH);
                const lK = getKp('left_knee'), rK = getKp('right_knee');
                const knee = (lK && rK) ? ((lK.score || 0) > (rK.score || 0) ? lK : rK) : (lK || rK);
                const lA = getKp('left_ankle'), rA = getKp('right_ankle');
                const ankle = (lA && rA) ? ((lA.score || 0) > (rA.score || 0) ? lA : rA) : (lA || rA);

                // Ideal plumb line: ear-to-ankle vertical reference
                if (ear && ankle && (ear.score || 0) > 0.2 && (ankle.score || 0) > 0.2) {
                  ctx.save(); ctx.setLineDash([10, 6]);
                  ctx.strokeStyle = 'rgba(100,200,255,0.5)'; ctx.lineWidth = 2;
                  ctx.beginPath(); ctx.moveTo(ankle.x, Math.max(0, ear.y - 30)); ctx.lineTo(ankle.x, ankle.y + 20);
                  ctx.stroke(); ctx.restore();
                  drawLabel('Plumb Line', ankle.x + 10, ankle.y - 30, 'rgba(100,200,255,0.9)');
                }
                // Forward Head Angle -- forward head (turtle neck) indicator
                if (ear && shoulder && (ear.score || 0) > 0.2 && (shoulder.score || 0) > 0.2) {
                  const fha = Math.abs(Math.atan2(ear.x - shoulder.x, shoulder.y - ear.y) * (180 / Math.PI));
                  const fhaColor = fha < 5 ? 'rgba(52,211,153,0.95)' : fha < 15 ? 'rgba(251,191,36,0.95)' : 'rgba(239,68,68,0.95)';
                  const fhaLabel = fha < 5 ? 'Normal' : fha < 15 ? 'Mild Forward Head' : 'Forward Head Risk';
                  // Ear-shoulder connection line
                  ctx.save();
                  ctx.strokeStyle = fhaColor; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
                  ctx.beginPath(); ctx.moveTo(ear.x, ear.y); ctx.lineTo(shoulder.x, shoulder.y); ctx.stroke();
                  ctx.restore();
                  drawLabel(`FHA ${fha.toFixed(1)}° ${fhaLabel}`, Math.min(ear.x, shoulder.x) - 10, (ear.y + shoulder.y) / 2, fhaColor, 'right');
                }
                // Upper body tilt angle (shoulder-pelvis)
                if (shoulder && hip && (shoulder.score || 0) > 0.2 && (hip.score || 0) > 0.2) {
                  const trunkAngle = Math.abs(Math.atan2(shoulder.x - hip.x, hip.y - shoulder.y) * (180 / Math.PI));
                  const tColor = trunkAngle < 3 ? 'rgba(52,211,153,0.95)' : trunkAngle < 8 ? 'rgba(251,191,36,0.95)' : 'rgba(239,68,68,0.95)';
                  drawLabel(`Thoracic ${trunkAngle.toFixed(1)}°`, Math.max(shoulder.x, hip.x) + 15, (shoulder.y + hip.y) / 2, tColor);
                }
              }

              // -- Step 7: Bottom info bar --
              const barH = 36;
              ctx.fillStyle = 'rgba(0,10,30,0.85)';
              ctx.fillRect(0, h - barH, w, barH);
              ctx.strokeStyle = 'rgba(0,255,170,0.5)'; ctx.lineWidth = 1;
              ctx.beginPath(); ctx.moveTo(0, h - barH); ctx.lineTo(w, h - barH); ctx.stroke();
              ctx.font = 'bold 12px monospace';
              ctx.fillStyle = 'rgba(0,255,170,0.9)'; ctx.textAlign = 'left';
              ctx.fillText(`AI BODY SCAN · ${visibleCount}/17 joints`, 10, h - 12);
              ctx.fillStyle = 'rgba(100,200,255,0.9)'; ctx.textAlign = 'right';
              ctx.fillText('BTC 3-BODY AI ANALYZER', w - 10, h - 12);

              // Replace with composited image
              const analyzedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
              setPreviewData(prev => prev ? { ...prev, dataUrl: analyzedDataUrl, validationResult: { passed: true, message: `AI detected ${visibleCount} joints. Suitable for analysis.` } } : null);
            } else {
              setPreviewData(prev => prev ? { ...prev, validationResult: { passed: false, message: "全身が十分に写っていません。少し下がって再撮影してください。" } } : null);
              speak("全身が十分に写っていません。少し下がって再撮影してください。");
            }
          } else {
            // If Thunder model also fails, allow manual pass (do not block)
            setPreviewData(prev => prev ? { ...prev, validationResult: { passed: false, message: "AIが人物を明確に認識できませんでした。写真に問題がない場合は、手動で続行できます。" } } : null);
            speak("人物が検出されませんでした。写真を確認し、手動で進めるか再撮影してください。");
          }
        } catch (err) {
          console.error('Post-capture validation error:', err);
          // On validation failure, just pass through
          setPreviewData(prev => prev ? { ...prev, validationResult: { passed: true, message: '' } } : null);
        }
      };
      img.src = dataUrl;
    } else {
      // Steps not requiring validation pass immediately
      setPreviewData(prev => prev ? { ...prev, validationResult: { passed: true, message: '' } } : null);
    }
  };

  // Preview 'Confirm' -> proceed to next step
  const confirmCapture = () => {
    if (!previewData) return;
    // Use original image for Gemini analysis, composited image for display
    const { originalDataUrl, metadata: mergedMeta } = previewData;
    setPreviewData(null);

    let reps: number | undefined;
    let footDrops: number | undefined;
    let swayScore: number | undefined;
    let formScore: number | undefined;
    let kneeAssisted: boolean | undefined;
    let eyesClosedVal: boolean | undefined;
    let postureData: any;
    
    if (mergedMeta && typeof mergedMeta === 'object') {
      reps = mergedMeta.reps;
      footDrops = mergedMeta.footDrops;
      swayScore = mergedMeta.swayScore;
      formScore = mergedMeta.formScore;
      kneeAssisted = mergedMeta.kneeAssisted;
      postureData = mergedMeta.postureData;
      if (step === AssessmentStep.BALANCE_TEST) {
        eyesClosedVal = eyesClosed;
      }
    }
    
    // Show manual input modal for balance test step
    if (step === AssessmentStep.BALANCE_TEST) {
      setManualFootDrops(String(footDrops || 0));
      setManualSwayLevel(String(Math.min(5, Math.max(1, Math.round((swayScore || 0) / 20) + 1))));
      setBalanceInputModal({ isOpen: true, dataUrl: originalDataUrl, aiFootDrops: footDrops || 0, aiSwayScore: swayScore || 0 });
      return;
    }

    // Posture step checks (FRONT/SIDE) logic follows...
    // Posture steps (FRONT/SIDE): composite for report, original for Gemini
    const isPostureStep = [AssessmentStep.POSTURE_FRONT, AssessmentStep.POSTURE_SIDE].includes(step as AssessmentStep);
    const displayDataUrl = isPostureStep ? (previewData.dataUrl || originalDataUrl) : originalDataUrl;
    
    proceedToNextStep(step as AssessmentStep, displayDataUrl, reps, footDrops, swayScore, formScore, eyesClosedVal, kneeAssisted, postureData, undefined, isPostureStep ? originalDataUrl : undefined);
  };

  // Preview 'Retake' -> close preview and keep current step
  const retakeCapture = () => {
    setPreviewData(null);
    speak("Retaking the photo. Please get ready.");
  };

  const proceedToNextStep = (currentStep: AssessmentStep, dataUrl: string, reps?: number, footDrops?: number, swayScore?: number, formScore?: number, eyesClosedVal?: boolean, kneeAssisted?: boolean, postureData?: any, brainTestData?: BrainTestData, originalDataUrl?: string) => {
    const newImage: CapturedImage = { step: currentStep, dataUrl, reps, formScore, postureData };
    if (originalDataUrl) {
      newImage.originalDataUrl = originalDataUrl;
    }
    if (brainTestData) {
      newImage.brainTestData = brainTestData;
    }
    if (footDrops !== undefined && swayScore !== undefined) {
      newImage.balanceData = { footDrops, swayScore, eyesClosed: eyesClosedVal ?? true };
    }
    if (kneeAssisted !== undefined) {
      newImage.kneeAssisted = kneeAssisted;
    }
    const newImages = [...capturedImages, newImage];
    setCapturedImages(newImages);

    const steps = Object.values(AssessmentStep);
    const currentIndex = steps.indexOf(currentStep);
    const nextStep = steps[currentIndex + 1];

    if (nextStep === AssessmentStep.READY_FOR_ANALYSIS) {
      setStep(nextStep as AssessmentStep);
      speak("すべての測定が完了しました。画面の分析ボタンをクリックしてください。");
    } else if (nextStep === AssessmentStep.ANALYZING) {
      runAnalysis(newImages);
    } else {
      setStep(nextStep as AssessmentStep);
    }
  };



  const handleRepSubmit = () => {
    if (!repInputModal.step) return;
    const reps = parseInt(repCount, 10) || 0;
    const { step: modalStep, dataUrl, formScore: fs, kneeAssisted: ka, postureData: pd } = repInputModal;
    setRepInputModal({ isOpen: false, step: null, dataUrl: '' });
    setRepCount('');

    let manualFormScore = fs || 80;
    if (manualRepPosture === 'Perfect') manualFormScore = 100;
    else if (manualRepPosture === 'Good') manualFormScore = 85;
    else if (manualRepPosture === 'Fair') manualFormScore = 60;
    else if (manualRepPosture === 'Needs Work') manualFormScore = 40;

    const pdWithManual = { ...pd, manualPosture: manualRepPosture };

    // Pass formScore, kneeAssisted, postureData together to prevent data loss
    proceedToNextStep(modalStep!, dataUrl, reps, undefined, undefined, manualFormScore, undefined, ka, pdWithManual);
    setManualRepPosture('Fair');
  };

  // Balance test manual input complete
  const handleBalanceSubmit = () => {
    const fd = parseInt(manualFootDrops, 10) || 0;
    // swayLevel(1~5) -> swayScore(0~100): 1=VeryStable(0), 2=Stable(20), 3=Moderate(40), 4=Unstable(60), 5=VeryUnstable(80+)
    const sl = parseInt(manualSwayLevel, 10) || 3;
    const convertedSwayScore = Math.max(0, (sl - 1) * 20);
    setBalanceInputModal({ isOpen: false, dataUrl: '', aiFootDrops: 0, aiSwayScore: 0 });
    proceedToNextStep(AssessmentStep.BALANCE_TEST, balanceInputModal.dataUrl, undefined, fd, convertedSwayScore, undefined, eyesClosed);
  };

  // Arm raise manual verification complete
  const handleArmRaiseSubmit = () => {
    const { dataUrl, postureData } = armRaiseInputModal;
    // Override postureData with user-modified grade from modal
    const updatedPostureData = { ...postureData, armRaiseGrade: manualArmRaiseGrade };
    setArmRaiseInputModal({ isOpen: false, dataUrl: '', postureData: null });
    proceedToNextStep(('ARM_RAISE_TEST' as any), dataUrl, undefined, undefined, undefined, undefined, undefined, undefined, updatedPostureData);
  };

  // Flexibility manual verification complete
  const handleFlexSubmit = () => {
    const { dataUrl, postureData } = flexInputModal;
    // Override postureData with user-modified grade
    const updatedPostureData = { ...postureData, flexGrade: manualFlexGrade };
    setFlexInputModal({ isOpen: false, dataUrl: '', postureData: null });
    proceedToNextStep(('FLEXIBILITY_TEST' as any), dataUrl, undefined, undefined, undefined, undefined, undefined, undefined, updatedPostureData);
  };

  const runAnalysis = async (images: CapturedImage[]) => {
    if (!userInfo) return;
    setStep(AssessmentStep.ANALYZING);
    speak("このウェルネス分析は、健康管理のための姿勢、動き、認知機能を測定します。医療機器ではなく、医療診断用ではありません。AI分析には約1分かかります。");
    setIsAnalyzing(true);
    try {
      // For AI analysis, use original (un-overlaid) images for accuracy
      const aiOptimizedImages = await Promise.all(images.map(async (img) => ({
        ...img,
        dataUrl: await resizeImage(img.originalDataUrl || img.dataUrl, 800)
      })));

      const result = await analyzeHealth(userInfo, aiOptimizedImages);
      setReport(result);
      speak("分析レポートが生成されました。結果をご確認ください。");
      
      // Attempt to save to history, but don't crash if it fails
      // Delete pending record and save final report
      if (pendingRecordId) {
        try { await deleteRecordLocally(pendingRecordId); } catch (e) { console.warn('[DB] Pending delete failed:', e); }
        setPendingRecordId(null);
      }
      await saveRecord(result, images);
      
      // Update Firestore status to completed when queue measurement finishes
      if (activeWaitingId) {
        try {
          await updateWaitingStatus(activeWaitingId, 'completed');
        } catch (e) {
          console.warn('[EventService] Queue status update failed', e);
        }
        // Reset queue-related state
        setActiveWaitingId(null);
        setIsWaitingMemberActive(false);
      }
      
      setStep(AssessmentStep.REPORT);
    } catch (error) {
      console.error("Analysis Error:", error);
      const isQuotaError = error instanceof Error && (error.message.includes('quota') || error.message.includes('429') || error.message.includes('depleted') || error.message.includes('prepayment'));
      
      setErrorModal({ 
        isOpen: true, 
        message: isQuotaError 
          ? t(['assessment.quotaErrorText', 'report.serverErrorToast'])
          : t(['assessment.apiErrorText', 'report.serverErrorToast'], { error: error instanceof Error ? error.message : JSON.stringify(error) }),
        showRetry: true
      });
      // Stay on ANALYZING step or show a state where they can retry
    } finally {
      setIsAnalyzing(false);
    }
  };

  const retryAnalysis = () => {
    setErrorModal({ isOpen: false, message: '', showRetry: false });
    runAnalysis(capturedImages);
  };

  const repeatGuidance = () => {
    const guidance = getStepGuidance(step);
    if (guidance) {
      speak(guidance);
    }
  };

  const renderCameraStep = (stepBadge: string, stepTitle: string, stepNum: number, camModule: React.ReactNode) => {
    return (
      <div className="flex-1 flex flex-col p-3 overflow-auto bg-slate-900 rounded-2xl border border-slate-800 m-2 shadow-2xl relative">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="mb-2 flex justify-between items-center relative z-50">
            <div className="flex items-center gap-3">
              <span className="bg-indigo-600/80 text-white font-black text-xs px-3 py-1 rounded-full">
                {stepNum}/11
              </span>
              <h3 className="text-xl font-black text-white drop-shadow-sm">{stepTitle}</h3>
              <span className="text-slate-400 text-xs font-medium">{getStepGuidance(step)}</span>
            </div>
            <div className="flex items-center gap-3">
              {userInfo && (
                <div className="bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
                  <span>👤</span>
                  <span>{userInfo.name}</span>
                  <span className="text-amber-400/60">|</span>
                  <span>{userInfo.gender === 'male' ? 'M' : 'F'}</span>
                  <span className="text-amber-400/60">|</span>
                  <span>{userInfo.age} {t('userInfo.yearsOld')}</span>
                </div>
              )}
              {devices.length > 0 && (
                <div className="relative">
                  <button 
                    onClick={() => setShowDeviceSelect(!showDeviceSelect)}
                    className="w-12 h-12 bg-slate-800 border border-slate-700/80 text-slate-300 rounded-full flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all shadow-lg cursor-pointer relative"
                    title="Camera Settings"
                  >
                    <i className="fas fa-video text-lg"></i>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full text-[9px] flex items-center justify-center text-white font-bold border-2 border-slate-900">{devices.length}</div>
                  </button>
                  
                  {showDeviceSelect && (
                    <div className="absolute right-0 top-14 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 w-64 animate-fade-in">
                      <div className="text-xs text-slate-400 font-bold mb-2 px-2 pt-1"><i className="fas fa-camera mr-1"></i> {t('common.selectCamera')}</div>
                      <div className="flex flex-col gap-1">
                        {devices.map((device, idx) => (
                          <button
                            key={device.deviceId}
                            onClick={() => {
                              setSelectedDeviceId(device.deviceId);
                              localStorage.setItem('selectedCameraId', device.deviceId);
                              window.dispatchEvent(new CustomEvent('camera:change', { detail: { deviceId: device.deviceId } }));
                              setShowDeviceSelect(false);
                            }}
                            className={`text-left px-3 py-2 text-sm rounded-lg transition-all ${
                              selectedDeviceId === device.deviceId 
                                ? 'bg-indigo-600 font-bold text-white shadow-md' 
                                : 'text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            <i className={`fas fa-check mr-2 ${selectedDeviceId === device.deviceId ? 'opacity-100' : 'opacity-0'}`}></i>
                            {device.label || `Camera ${idx + 1}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <button 
                onClick={repeatGuidance}
                className="w-12 h-12 bg-slate-800 border border-slate-700/80 text-indigo-400 rounded-full flex items-center justify-center hover:bg-slate-700 hover:text-indigo-300 transition-all shadow-lg hover:rotate-12 cursor-pointer"
                title={t('common.repeatGuidance')}
              >
                <i className="fas fa-volume-up text-lg"></i>
              </button>
              
              <button 
                onClick={() => {
                  if (window.confirm(t('assessment.confirmStop'))) {
                    setStep(AssessmentStep.INTRO);
                  }
                }}
                className="w-12 h-12 bg-slate-800 border border-slate-700/80 text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all shadow-lg hover:rotate-12 cursor-pointer"
                title={t('common.goHome')}
              >
                <i className="fas fa-home text-lg"></i>
              </button>
            </div>
        </div>
        
        <div className="flex-1 relative z-10 rounded-2xl overflow-hidden border border-slate-700/80 shadow-[0_0_30px_rgba(0,0,0,0.5)] bg-black">
            {/* Photo preview screen - V3.1.0 process restored */}
            {previewData ? (() => {
              const vr = previewData.validationResult;
              const isValidating = vr === null || vr === undefined;
              const passed = vr?.passed ?? false;
              return (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-slate-900 p-4">
                {/* Top badge */}
                <div className={`backdrop-blur-sm text-white font-black px-5 py-1.5 rounded-full text-xs shadow-lg flex items-center gap-2 ${
                  isValidating ? 'bg-amber-500/90' : passed ? 'bg-emerald-500/90' : 'bg-rose-500/90'
                }`}>
                  <i className={`fas ${isValidating ? 'fa-spinner fa-spin' : passed ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
                  {isValidating ? t('assessment.previewValidating') : passed ? t('assessment.previewSuccess') : t('assessment.previewFail')}
                </div>
                
                {/* Captured photo */}
                <img 
                  src={previewData.dataUrl} 
                  alt="Capture preview" 
                  className={`max-h-[50%] w-auto object-contain rounded-2xl border-2 shadow-2xl ${
                    isValidating ? 'border-amber-500/50' : passed ? 'border-emerald-500/50' : 'border-rose-500/50'
                  }`}
                />

                {/* Validation result message */}
                {vr && vr.message && (
                  <div className={`text-sm font-bold px-4 py-2 rounded-xl ${
                    passed ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                  }`}>
                    <i className={`fas ${passed ? 'fa-check mr-1' : 'fa-exclamation-circle mr-1'}`}></i>
                    {vr.message}
                  </div>
                )}
                
                {/* Button area */}
                <div className="flex justify-center gap-6 mt-1">
                  <button
                    onClick={retakeCapture}
                    className="w-14 h-14 bg-slate-700 hover:bg-slate-600 text-white rounded-full transition-all flex items-center justify-center border-2 border-slate-500 shadow-lg"
                    title={t('common.retake')}
                  >
                    <i className="fas fa-redo-alt text-xl"></i>
                  </button>
                  <button
                    onClick={confirmCapture}
                    disabled={isValidating} // Allow manual proceed regardless of pass status
                    className={`w-14 h-14 rounded-full transition-all flex items-center justify-center shadow-lg border-2 ${
                      isValidating 
                        ? 'bg-slate-600 border-slate-500 text-slate-400 cursor-not-allowed opacity-50'
                        : !passed
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-amber-500/30 active:scale-[0.98] border-amber-400'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/30 active:scale-[0.98] border-indigo-400'
                    }`}
                    title={isValidating ? t('assessment.previewValidating') : !passed ? t('assessment.previewFail') : t('common.confirm')}
                  >
                    <i className={`fas ${!passed && !isValidating ? 'fa-forward' : 'fa-check'} text-2xl font-black`}></i>
                  </button>
                </div>
              </div>
              );
            })() : camModule}
        </div>
      </div>
    );
  };

  const renderContent = () => {

    if (!hasStarted) {
      return (
        <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-slate-900 w-full h-full">
          {/* Animated Background Orbs */}
          <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] bg-purple-500/10 rounded-full blur-[100px] animate-pulse"></div>
          
          <div className="relative z-10 max-w-lg w-full p-12 rounded-[2.5rem] text-center border border-white/10"
               style={{
                 background: 'rgba(15, 23, 42, 0.65)',
                 backdropFilter: 'blur(40px)',
                 boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
               }}>
            
            {/* 3-Body Scanner Motion Graphic */}
            <div className="relative w-36 h-36 mx-auto mb-10 flex items-center justify-center">
              <div className="absolute inset-0 border-t-2 border-l-2 border-indigo-500 rounded-full animate-spin" style={{ animationDuration: '6s' }}></div>
              <div className="absolute inset-2 border-b-2 border-r-2 border-emerald-400/70 rounded-full animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }}></div>
              <div className="absolute inset-4 border-t-2 border-dashed border-purple-500/50 rounded-full animate-spin" style={{ animationDuration: '8s' }}></div>
              <div className="absolute inset-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center z-10 shadow-[0_0_30px_rgba(99,102,241,0.6)] animate-pulse">
                <i className="fas fa-brain text-4xl text-white opacity-95 drop-shadow-md"></i>
              </div>
              <div className="absolute inset-0 w-full h-full animate-spin z-20 pointer-events-none" style={{ animationDuration: '10s' }}>
                 <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.8)] border-2 border-slate-900">
                   <div className="animate-spin" style={{ animationDuration: '10s', animationDirection: 'reverse' }}><i className="fas fa-running text-white text-[16px]"></i></div>
                 </div>
                 <div className="absolute bottom-3 right-1 w-9 h-9 bg-gradient-to-br from-rose-400 to-pink-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.8)] border-2 border-slate-900">
                   <div className="animate-spin" style={{ animationDuration: '10s', animationDirection: 'reverse' }}><i className="fas fa-heart text-white text-[14px]"></i></div>
                 </div>
                 <div className="absolute bottom-3 left-1 w-6 h-6 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.8)] border-2 border-slate-900">
                   <div className="animate-spin" style={{ animationDuration: '10s', animationDirection: 'reverse' }}><i className="fas fa-bolt text-white text-[10px]"></i></div>
                 </div>
              </div>
            </div>

            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-white to-indigo-200 mb-4 tracking-tight drop-shadow-sm">
              BTC 3Body 7Code AIウェルネスセンター
            </h2>
            <div className="w-12 h-1 bg-gradient-to-r from-indigo-500 to-blue-500 mx-auto rounded-full mb-6"></div>
            
            <p className="text-slate-300 mb-10 leading-relaxed text-sm font-medium">
              測定を円滑に進めるため音声ガイダンスを提供します。周囲を整理し、下のボタンを押してください。
            </p>

            <button 
              id="activate-assessment-btn"
              onClick={() => {
                // Run system check first when analysis system activation is clicked
                setShowSysCheck(true);
                initAudio().catch(() => {});
              }}
              className="relative overflow-hidden w-full group bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-5 rounded-2xl transition-all duration-300"
              style={{ boxShadow: '0 10px 25px -5px rgba(99,102,241,0.5)' }}
            >
              <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-[150%] skew-x-[-20deg] group-hover:translate-x-[250%] transition-transform duration-1000 ease-out"></div>
              <span className="relative z-10 flex items-center justify-center gap-2 text-lg tracking-wide">
                測定システムを起動 <i className="fas fa-play text-xs ml-1 relative top-[1px]"></i>
              </span>
            </button>
            <div className="mt-8 flex flex-col items-center justify-center gap-1 text-slate-500 text-[10px] font-semibold tracking-widest uppercase">
              <div className="flex gap-2">
                <span><i className="fas fa-microchip text-indigo-400"></i> AI Vision Processor</span>
                <span>•</span>
                <span><i className="fas fa-check-circle text-emerald-400"></i> System Ready</span>
              </div>
              <div className="mt-2 text-slate-600">v{pkg.version} Premium Edition</div>
            </div>
          </div>
        </div>
      );
    }

    if (step === 'HISTORY') {
      return <HistoryManager 
                onViewReport={(rec) => {
                  setReport(rec.report);
                  setCapturedImages(rec.images);
                  setStep(AssessmentStep.REPORT);
                }}
                onResumeAnalysis={(rec) => {
                  if (rec.report?.userInfo) {
                    setUserInfo(rec.report.userInfo);
                  }
                  setCapturedImages(rec.images || []);
                  setPendingRecordId(rec.id);
                  setStep(AssessmentStep.ANALYZING);
                  runAnalysis(rec.images || []);
                }}
                onClose={() => setStep(AssessmentStep.INTRO)} 
             />;
    }



    // ───── Health Needs Assessment Page (shown after 7-code completion) ─────
    const HEALTH_NEEDS_KEYS = [
      { key: 'sleep', defaultVal: 'I want to sleep better' },
      { key: 'stress', defaultVal: 'I want to relieve stress' },
      { key: 'emotion', defaultVal: 'I want to manage emotions' },
      { key: 'mental', defaultVal: 'I want to strengthen my mindset' },
      { key: 'focus', defaultVal: 'I want to improve focus' },
      { key: 'relationship', defaultVal: 'I want to improve relationships' },
      { key: 'stamina', defaultVal: 'I want to build stamina' },
      { key: 'pain', defaultVal: 'I want to relieve pain' },
      { key: 'diet', defaultVal: 'I want to manage my weight' },
      { key: 'anger', defaultVal: 'I want to control anger' },
      { key: 'youth', defaultVal: 'I want to feel younger' },
      { key: 'happiness', defaultVal: 'I want to be happier' }
    ];

    if (showHealthNeeds) {
      const handleHealthNeedsComplete = async () => {
        const finalNeeds = [...selectedHealthNeeds];
        if (customHealthNeed.trim()) {
          finalNeeds.push(customHealthNeed.trim());
        }
        // Save healthNeeds to userInfo
        if (userInfo) {
          setUserInfo({ ...userInfo, healthNeeds: finalNeeds });
        }
        setShowHealthNeeds(false);

        if (isReceptionOnly && pendingSevenCodeData) {
          // Pre-registration mode: register to queue
          try {
            if (userInfo) {
              await addToWaitingList({
                name: userInfo.name,
                phone: userInfo.phone || '',
                age: userInfo.age,
                gender: userInfo.gender,
                memberType: userInfo.memberType,
                birthDate: userInfo.birthDate,
                sevenCodeKeywords: pendingSevenCodeData.keywords,
                weakestCode: pendingSevenCodeData.weakestCode,
                branchId: currentBranchId,
                eventCode: activeEventCode || undefined,
                isStarred: false,
                healthNeeds: finalNeeds
              });
              setToast({ isVisible: true, message: '待機リストへの登録が完了しました。順番に測定いたします。', type: 'success' });
            }
          } catch (err) {
            console.error('[Queue] Registration error:', err);
            setToast({ isVisible: true, message: '待機リストへの登録に失敗しました。管理者にお問い合わせください。', type: 'error' });
          }
          setStep(AssessmentStep.INTRO);
          setCapturedImages([]);
          setReport(null);
          setUserInfo(null);
          setIsReceptionOnly(false);
        } else if (pendingSevenCodeData) {
          // One-stop mode: proceed to next measurement step
          proceedToNextStep(AssessmentStep.SEVEN_CODE_CHECK, '', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
          setCapturedImages(prev => {
            const newArr = [...prev];
            const idx = newArr.findIndex(i => i.step === AssessmentStep.SEVEN_CODE_CHECK);
            if (idx >= 0) {
              newArr[idx].sevenCodeKeywords = pendingSevenCodeData.keywords;
              newArr[idx].weakestCode = pendingSevenCodeData.weakestCode;
            }
            return newArr;
          });
        }
        setPendingSevenCodeData(null);
      };

      const toggleHealthNeed = (needKey: string) => {
        setSelectedHealthNeeds(prev =>
          prev.includes(needKey) ? prev.filter(n => n !== needKey) : [...prev, needKey]
        );
      };

      return (
        <div className="flex-1 flex flex-col items-center h-[calc(100vh-80px)] p-4 mx-auto max-w-5xl transition-all bg-slate-900">
          <div className="text-center mb-4 shrink-0">
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">気になる健康目標の選択</h2>
            <p className="text-gray-300 text-base sm:text-lg font-bold">
              改善したい項目を選択してください。
            </p>
            <p className="text-gray-400 text-sm sm:text-base font-medium mt-1">
              複数選択が可能です。
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full h-3 bg-gray-800 rounded-full mb-4 shrink-0">
            <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full w-full shadow-[0_0_15px_rgba(245,158,11,0.6)]" />
          </div>

          {/* Needs selection grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full flex-1 min-h-0 content-center overflow-y-auto">
            {HEALTH_NEEDS_KEYS.map(need => {
              const isSelected = selectedHealthNeeds.includes(need.key);
              return (
                <button
                   key={need.key}
                   onClick={() => toggleHealthNeed(need.key)}
                   className={`p-5 md:p-6 rounded-2xl text-lg md:text-xl font-black transition-all duration-200 transform hover:scale-[1.02] active:scale-95 leading-snug break-keep ${
                     isSelected
                       ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-[0_0_30px_rgba(245,158,11,0.4)] border-2 border-white/30'
                       : 'bg-gray-800 text-gray-200 hover:bg-gray-700 border-2 border-gray-700 hover:border-gray-500 shadow-lg'
                   }`}
                >
                  {HEALTH_NEEDS_EN[need.key] || need.defaultVal}
                </button>
              );
            })}
          </div>

          {/* Custom input */}
          <div className="w-full max-w-2xl mt-4 shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={customHealthNeed}
                onChange={(e) => setCustomHealthNeed(e.target.value)}
                placeholder="または、健康上の懸念を直接入力してください..."
                className="flex-1 px-4 py-3 rounded-xl bg-gray-800 text-white border-2 border-gray-700 focus:border-amber-500 outline-none text-base font-bold placeholder:text-gray-500"
              />
            </div>
          </div>

          {/* Selection status and complete button */}
          <div className="flex justify-between items-center w-full max-w-2xl mt-3 pb-2 shrink-0">
            <span className="text-slate-500 text-sm font-medium">
              {selectedHealthNeeds.length + (customHealthNeed.trim() ? 1 : 0)}個 選択済み
            </span>
          </div>
          <div className="flex justify-between w-full max-w-2xl gap-3 pb-2 shrink-0">
            <button
              onClick={() => {
                setShowHealthNeeds(false);
                setStep(AssessmentStep.SEVEN_CODE_CHECK);
              }}
              className="flex-1 px-6 py-4 rounded-2xl text-xl font-bold bg-gray-700 text-white hover:bg-gray-600 transition-colors shadow-lg"
            >
              <i className="fas fa-arrow-left mr-2" /> 前へ
            </button>
            <button
              onClick={handleHealthNeedsComplete}
              className="flex-1 px-10 py-4 rounded-2xl text-xl font-black transition-all shadow-xl hover:shadow-amber-500/40 active:scale-95 bg-gradient-to-r from-amber-500 to-orange-500 text-white"
            >
              <i className="fas fa-check-circle mr-2" /> {isReceptionOnly ? "完了" : "次へ"}
            </button>
          </div>
        </div>
      );
    }

    switch (step) {
      case AssessmentStep.INTRO:
        return (
          <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-slate-900 w-full h-full">
            <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '3s' }}></div>

            <div className="relative z-10 max-w-lg w-full p-8 md:p-10 rounded-[2.5rem] text-center border border-white/10"
                style={{
                  background: 'rgba(15, 23, 42, 0.65)',
                  backdropFilter: 'blur(40px)',
                  boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                }}>
              
              {/* Union event status badge */}
              {activeEventCode && (
                <div className="mb-6 inline-flex flex-col sm:flex-row items-center gap-3 px-5 py-2.5 bg-slate-900/90 border-2 border-indigo-500/60 rounded-3xl text-sm font-black text-white shadow-xl shadow-indigo-950/50">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-indigo-300 font-bold">屋外イベント開催中</span>
                  </div>
                  <div className="hidden sm:block text-slate-700">|</div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-base text-yellow-400 tracking-wider font-extrabold">{activeEventCode}</span>
                    <span className="px-2.5 py-1 bg-indigo-950 border border-indigo-500/30 text-xs font-extrabold rounded-xl text-indigo-200">
                      👥 待機: <strong className="text-white text-sm font-black">{uniqueWaitingList.length}</strong> 人
                    </span>
                  </div>
                </div>
              )}

              <div className="relative w-full aspect-video mx-auto mb-6 rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                <img src="/banner.png" alt="Hero" className="w-full h-full object-cover" />
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-fuchsia-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg">
                  Outdoor Booth Multi 2.0
                </div>
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-white mb-1 tracking-tight drop-shadow-sm">
                {BRAND_NAME}
              </h2>
              <p className="text-slate-400 mb-6 text-xs font-medium">
                {SUB_NAME}
              </p>

              {/* 4-mode flexible flow button layout */}
              <div className="flex flex-col gap-3 filter drop-shadow-xl">
                {/* 1. Instant All-in-One start */}
                <button 
                  id="start-onestop-btn"
                  onClick={() => {
                    initAudio().catch(() => {});
                    setIsReceptionOnly(false);
                    setIsWaitingMemberActive(false);
                    setActiveWaitingId(null);
                    setStep(AssessmentStep.USER_INFO);
                  }}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 rounded-xl hover:from-indigo-500 hover:to-purple-500 transition-all flex items-center justify-center gap-2.5 text-[15px] shadow-lg shadow-indigo-650/30 active:scale-[0.99]"
                >
                  <i className="fas fa-running text-sm"></i> 測定を開始する (ワンストップ) <i className="fas fa-chevron-right text-xs"></i>
                </button>

                {/* 2. Pre-registration */}
                <button 
                  id="start-preregister-btn"
                  onClick={() => {
                    initAudio().catch(() => {});
                    setIsReceptionOnly(true);
                    setIsWaitingMemberActive(false);
                    setActiveWaitingId(null);
                    setStep(AssessmentStep.USER_INFO);
                  }}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold py-3.5 rounded-xl hover:from-emerald-500 hover:to-teal-500 transition-all flex items-center justify-center gap-2.5 text-sm shadow-lg shadow-emerald-650/20 active:scale-[0.99]"
                >
                  <i className="fas fa-user-plus text-sm"></i> 事前登録 (7Codeウェルネスチェック)
                </button>

                {/* 3. Load waitlist */}
                <button 
                  onClick={() => {
                    initAudio().catch(() => {});
                    setShowWaitingModal(true);
                  }}
                  className="w-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 font-bold py-3.5 rounded-xl hover:bg-indigo-900/60 transition-all flex items-center justify-center gap-2.5 text-sm active:scale-[0.99] relative"
                >
                  <i className="fas fa-list-ol"></i> 待機リストのロード
                  {uniqueWaitingList.length > 0 ? (
                    <span className="absolute right-4 bg-indigo-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-bounce">
                      {uniqueWaitingList.length}
                    </span>
                  ) : (
                    <span className="absolute right-4 text-[10px] text-slate-500 font-bold">空</span>
                  )}
                </button>

                {/* 4. Completed results counseling */}
                <button 
                  onClick={() => setStep('HISTORY')}
                  className="w-full bg-slate-800/80 border border-slate-700 text-slate-300 font-bold py-3.5 rounded-xl hover:bg-slate-700 transition-all flex items-center justify-center gap-2.5 text-sm active:scale-[0.99]"
                >
                  <i className="fas fa-comments"></i> カウンセリング＆レポート
                </button>
                
                {/* K-Face / K-Tarot buttons removed */}
              </div>

              <div className="mt-8 flex items-center justify-center gap-2 text-slate-500 text-[9px] font-semibold tracking-widest uppercase">
                <i className="fas fa-satellite-dish text-indigo-900 animate-pulse"></i> POWERED BY GEMINI AI VISION
              </div>
            </div>
          </div>
        );

      case AssessmentStep.USER_INFO:
        return <UserInfoForm onSubmit={handleUserSubmit} />;

      case AssessmentStep.POSTURE_FRONT:
        return renderCameraStep("Step 1", "Front Posture Check", 1, <CameraModule key="front" onCapture={handleCapture} guidelineType="front" autoCapture={true} preferredDeviceId={selectedDeviceId} onDeviceChange={setSelectedDeviceId} />);

      case AssessmentStep.POSTURE_SIDE:
        return renderCameraStep("Step 2", "Side Posture Check", 2, <CameraModule key="side" onCapture={handleCapture} guidelineType="side" autoCapture={true} preferredDeviceId={selectedDeviceId} onDeviceChange={setSelectedDeviceId} />);

      case AssessmentStep.BALANCE_TEST:
        return (
          <div className="flex-1 flex flex-col">
            {/* Eye state toggle button */}
            <div className="flex items-center justify-center gap-3 px-6 pt-4 pb-2">
              <span className="text-slate-400 text-sm font-medium">測定条件:</span>
              <button
                onClick={() => setEyesClosed(true)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  eyesClosed
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <i className="fas fa-eye-slash mr-2"></i>目を閉じる (標準)
              </button>
              <button
                onClick={() => setEyesClosed(false)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  !eyesClosed
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/30'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <i className="fas fa-eye mr-2"></i>目を開ける (補正あり)
              </button>
              {!eyesClosed && (
                <span className="text-amber-400 text-xs font-medium animate-pulse">
                  <i className="fas fa-exclamation-triangle mr-1"></i>+2 ペナルティ適用
                </span>
              )}
            </div>
            {renderCameraStep("Age Test 01", "片足立ち (目を閉じる)", 3, <CameraModule key="balance" onCapture={handleCapture} guidelineType="balance" timerDuration={15} preferredDeviceId={selectedDeviceId} onDeviceChange={setSelectedDeviceId} />)}
          </div>
        );

      // PC-mode checks (ARM_RAISE_TEST, FLEXIBILITY_TEST, STRENGTH_SQUAT, STRENGTH_PUSHUP, BRAIN_REACTION) are removed.

      case AssessmentStep.BRAIN_MEMORY:
        return <BrainTestModule key={AssessmentStep.BRAIN_MEMORY} testType={AssessmentStep.BRAIN_MEMORY} onComplete={(dataUrl, testData) => proceedToNextStep(AssessmentStep.BRAIN_MEMORY, dataUrl, testData.memorySpan, undefined, undefined, undefined, undefined, undefined, undefined, testData)} preferredCameraId={selectedDeviceId} userInfo={userInfo} />;

      case AssessmentStep.FACE_ANALYSIS:
        return renderCameraStep("Step 10", "Face Age Analysis", 10, <CameraModule key="face" onCapture={handleCapture} guidelineType="face" autoCapture={true} preferredDeviceId={selectedDeviceId} onDeviceChange={setSelectedDeviceId} />);

      case AssessmentStep.KFACE:
        return <KFaceApp userInfo={userInfo} onClose={() => setStep(AssessmentStep.INTRO)} onBack={() => setStep(AssessmentStep.INTRO)} />;

      case AssessmentStep.KTAROT:
        return <KTarotApp onClose={() => setStep(AssessmentStep.INTRO)} onBack={() => setStep(AssessmentStep.INTRO)} />;

      case AssessmentStep.SEVEN_CODE_CHECK:
        return <SevenCodeCheckModule onComplete={async (keywords, weakestCode) => {
          // Navigate to health needs page after 7-code completion (common for both flows)
          setPendingSevenCodeData({ keywords, weakestCode });
          setSelectedHealthNeeds([]);
          setCustomHealthNeed('');
          setShowHealthNeeds(true);
        }} />;

      case AssessmentStep.READY_FOR_ANALYSIS:
        const stepChecklist = [
          { step: AssessmentStep.SEVEN_CODE_CHECK, icon: '🧩', label: '1. 7Codeチェック', hasImage: false },
          { step: AssessmentStep.POSTURE_FRONT, icon: '📸', label: '2. 正面姿勢', hasImage: true },
          { step: AssessmentStep.POSTURE_SIDE, icon: '📸', label: '3. 側面姿勢', hasImage: true },
          { step: AssessmentStep.BALANCE_TEST, icon: '⚖️', label: '4. バランステスト', hasImage: true },
          { step: AssessmentStep.BRAIN_MEMORY, icon: '🛒', label: '5. 脳の健康 (マート)', hasImage: false },
          { step: AssessmentStep.FACE_ANALYSIS, icon: '😊', label: '6. 顔年齢分析', hasImage: true },
        ];
        const isAllCompleted = stepChecklist.every(item => capturedImages.some(i => i.step === item.step));
        
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-900 overflow-y-auto w-full">
            <div className="max-w-md w-full bg-slate-800/80 border border-slate-700/60 rounded-3xl p-6 shadow-2xl text-center">
              <div className="mb-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
                  isAllCompleted ? 'bg-green-950/60 border border-green-500/30' : 'bg-amber-950/60 border border-amber-500/30'
                }`}>
                  <i className={`fas ${isAllCompleted ? 'fa-check text-green-400' : 'fa-exclamation text-amber-400'} text-3xl`}></i>
                </div>
                <h3 className="text-2xl font-black text-white mb-1">
                  {isAllCompleted ? 'すべての測定が完了しました！' : '一部の測定が未完了です'}
                </h3>
                <p className="text-slate-400 text-xs">
                  {isAllCompleted ? '以下の測定履歴を確認し、AI分析を開始してください。' : 'AI統合分析を行うには、すべての測定を完了する必要があります。'}
                </p>
              </div>
 
              <div className="bg-slate-800/50 rounded-2xl p-3 mb-4 border border-slate-700/50">
                <h4 className="text-white font-bold text-xs mb-2 flex items-center gap-2">
                  <i className="fas fa-clipboard-check text-emerald-400"></i> 測定履歴
                </h4>
                <div className="space-y-1.5">
                  {stepChecklist.map(item => {
                    const img = capturedImages.find(i => i.step === item.step);
                    const done = !!img;
                    return (
                      <div key={item.step} className="flex justify-between items-center bg-slate-900/60 rounded-xl px-3 py-2 text-xs font-bold text-slate-300">
                        <span className="flex items-center gap-2">
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          {!item.hasImage && img?.brainTestData?.reactionTimeMs !== undefined && (
                            <span className="text-emerald-300 text-[10px] font-bold">{img.brainTestData.reactionTimeMs}ms</span>
                          )}
                          {!item.hasImage && img?.brainTestData?.memoryCorrect !== undefined && (
                            <span className="text-emerald-300 text-[10px] font-bold">{img.brainTestData.memoryCorrect}問正解</span>
                          )}
                          {item.step === ('SEVEN_CODE_CHECK' as any) && img?.sevenCodeKeywords && (
                            <span className="text-emerald-300 text-[10px] font-bold">{img.sevenCodeKeywords.length}個</span>
                          )}
                          <span className="font-black">{done ? '✅ 完了' : '❌ 測定'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-indigo-900/30 border border-indigo-500/20 rounded-xl p-3 mb-5 text-center">
                <p className="text-indigo-200 text-[11px] font-bold leading-relaxed">
                  💾 測定データは分析開始時に自動的に保存されます。<br/>
                  エラーが発生した場合でも、再撮影なしで再分析が可能です。
                </p>
              </div>
 
              <button
                onClick={async () => {
                  if (!isAllCompleted) return;
                  
                  // Pre-save pending record to prevent data loss in case of API timeout
                  try {
                    const finalNeeds = userInfo.healthNeeds || [];
                    const pendingRecord: any = {
                      id: `${Date.now()}`,
                      timestamp: new Date().toISOString(),
                      userInfo,
                      images: capturedImages,
                      isReceptionOnly,
                      isStarred: false,
                      healthNeeds: finalNeeds,
                      ownerUid: 'local-branch'
                    };
                    await saveRecordLocally(pendingRecord);
                    setToast({ isVisible: true, message: '測定データが正常に保存されました。', type: 'success' });
                  } catch (e) {
                    console.warn('[DB] Pre-save failed:', e);
                  }
 
                  runAnalysis(capturedImages);
                }}
                disabled={!isAllCompleted}
                className={`w-full py-4 rounded-2xl text-lg font-black transition-all flex items-center justify-center gap-2 shadow-xl ${
                  isAllCompleted 
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 active:scale-95 shadow-indigo-500/20' 
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-70'
                }`}
              >
                <i className="fas fa-microchip"></i> AI統合分析を開始
              </button>
            </div>
          </div>
        );

      case AssessmentStep.ANALYZING:
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-900 text-center">
            <div className="relative w-24 h-24 mb-8">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 animate-spin"></div>
              <div className="absolute inset-2 bg-slate-900 rounded-full flex items-center justify-center">
                <span className="text-2xl font-black text-indigo-400">
                  <i className="fas fa-brain animate-pulse"></i>
                </span>
              </div>
            </div>
            <h3 className="text-3xl font-black text-white mb-4 tracking-tight">AIデータを分析中...</h3>
            <p className="text-slate-400 max-w-md mx-auto text-base leading-relaxed font-medium mt-4">
              <span className="block text-indigo-200 mb-2 font-bold bg-indigo-900/40 p-3 rounded-lg border border-indigo-500/20">
                このプログラムは、最新のAI技術を統合し、脳トレーニングセンター、研究所、大学の専門家によって研究・開発されました。<br/>
                <span className="text-[11px] text-indigo-300 mt-1 block">※ 本システムは、健康管理を支援するために姿勢、動き、記憶を測定するウェルネスプログラムであり、医療診断を目的としたものではありません。</span>
              </span>
              3Body測定モデルが、収集された身体データと運動データをマルチアングルで包括的に分析しています。<br/>
              <span className="text-indigo-400 mt-2 inline-block text-sm">約1分かかります。</span>
            </p>
          </div>
        );

      case AssessmentStep.REPORT:
        return report ? <ReportDashboard 
                          report={report} 
                          images={capturedImages}
                          onRestart={() => {
                            setStep(AssessmentStep.INTRO);
                            setCapturedImages([]);
                            setReport(null);
                            setUserInfo(null);
                          }} 
                        /> : null;

      default:
        return (
          <div className="flex-1 flex items-center justify-center bg-slate-900 text-white flex-col">
            <h2 className="text-2xl font-bold mb-4 text-red-400">🚧 Under Development 🚧</h2>
            <p className="text-slate-400 mb-6">The selected test ({step}) is currently preparing.</p>
            <button 
              onClick={() => setStep(AssessmentStep.INTRO)}
              className="bg-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-500 transition-all shadow-[0_0_15px_rgba(79,70,229,0.5)]"
            >
              <i className="fas fa-home mr-2"></i>Go to Intro
            </button>
          </div>
        );
    }
  };

  const renderDevMenu = () => {
    if (!import.meta.env.DEV) return null;
    return (
      <div className="fixed bottom-4 left-4 z-[9999] bg-black/80 backdrop-blur-md p-3 rounded-2xl shadow-2xl border border-white/20 flex flex-col gap-2 max-h-[80vh] overflow-y-auto custom-scrollbar">
        <div className="text-white/50 text-[10px] font-black uppercase tracking-widest text-center border-b border-white/10 pb-1 mb-1">
          <i className="fas fa-bug text-emerald-400 mr-1"></i> Dev Navigation
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.values(AssessmentStep).filter(s => ![AssessmentStep.READY_FOR_ANALYSIS].includes(s)).map(s => (
            <button
              key={s}
              onClick={() => {
                setStep(s);
                setErrorModal({ isOpen: false, message: '', showRetry: false });
                setRepInputModal({ isOpen: false, step: null, dataUrl: '' });
              }}
              className={`px-2 py-1.5 text-[10px] font-bold rounded-lg transition-all text-left ${
                step === s 
                  ? 'bg-indigo-600 text-white shadow-inner' 
                  : 'bg-white/5 text-white/70 hover:bg-white/15'
              }`}
            >
              {s.replace('_TEST', '').replace('POSTURE_', '')}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col">
      <Modal 
        isOpen={errorModal.isOpen}
        title="Analysis Error"
        message={errorModal.message}
        onClose={() => {
          setErrorModal({ isOpen: false, message: '', showRetry: false });
          if (!errorModal.showRetry) setStep(AssessmentStep.INTRO);
        }}
      >
        {errorModal.showRetry && (
          <div className="mt-6 space-y-2">
            <button 
              onClick={retryAnalysis}
              className="w-full px-4 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg text-sm"
            >
              🔄 Retry Analysis (Keep Data)
            </button>
            <button 
              onClick={() => {
                setErrorModal({ isOpen: false, message: '', showRetry: false });
                setStep(AssessmentStep.READY_FOR_ANALYSIS);
              }}
              className="w-full px-4 py-3 bg-slate-700 text-white font-bold rounded-2xl hover:bg-slate-600 transition-all text-sm"
            >
              📋 Return to Measurement Review
            </button>
            <button 
              onClick={() => {
                setErrorModal({ isOpen: false, message: '', showRetry: false });
                setStep(AssessmentStep.INTRO);
                setCapturedImages([]);
              }}
              className="w-full px-4 py-2 bg-transparent text-slate-400 font-bold rounded-2xl hover:text-white transition-all text-xs"
            >
              Restart from Beginning
            </button>
          </div>
        )}
      </Modal>
      <Modal 
        isOpen={repInputModal.isOpen}
        title="Exercise Result Review"
        message="Here are the AI-measured results. Please manually enter the accurate count and posture feedback."
        onClose={() => {}} // Prevent closing without input
      >
        <div className="mt-4 mb-4">
          <label className="block text-sm font-bold text-slate-700 mb-2">
            <i className="fas fa-redo mr-1 text-indigo-500"></i> Rep Count
          </label>
          <input 
            type="number" 
            value={repCount}
            onChange={(e) => setRepCount(e.target.value)}
            placeholder="e.g. 12"
            className="w-full text-center text-3xl font-black text-slate-800 py-3 bg-white border-2 border-indigo-100 rounded-2xl focus:outline-none focus:border-indigo-500 transition-colors"
            autoFocus
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-bold text-slate-700 mb-2">
            <i className="fas fa-check-circle mr-1 text-indigo-500"></i> Posture Rating (AI Penalty Applied)
          </label>
          <div className="grid grid-cols-4 gap-2">
            {['Perfect', 'Excellent', 'Average', 'Needs Work'].map(posture => (
              <button
                key={posture}
                onClick={() => setManualRepPosture(posture)}
                className={`py-2 px-1 rounded-xl border-2 text-xs font-bold transition-all ${
                  manualRepPosture === posture 
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' 
                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                }`}
              >
                {posture}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2 text-center">AI physical age calculation penalty is applied based on selection.</p>
        </div>

        <button 
          onClick={handleRepSubmit}
          disabled={!repCount}
          className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all disabled:opacity-50"
        >
          Complete
        </button>
      </Modal>

      <Modal 
        isOpen={armRaiseInputModal.isOpen}
        title="腕上げ測定結果の確認"
        message="AI測定による基準値が表示されています。必要に応じて手動で確認・編集してください。"
        onClose={() => {}}
      >
        <div className="mt-4 space-y-5">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-400 mb-1">📊 AI測定による基準値</div>
            <div className="flex gap-4 text-sm text-slate-600">
              <span>平均角度: <strong className="text-indigo-600">{armRaiseInputModal.postureData?.armAvgAngle}°</strong></span>
              <span>耳との密着度: <strong className="text-indigo-600">{armRaiseInputModal.postureData?.earProximity}</strong></span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              肘: {armRaiseInputModal.postureData?.elbowStraight ? '正常 (まっすぐ)' : '曲がっている (ペナルティ)'}
            </div>
          </div>
 
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              <i className="fas fa-child mr-1 text-indigo-500"></i> 最終評価を選択
            </label>
            <div className="flex flex-col gap-2">
              {['Excellent (180°)', 'Good (160°)', 'Normal (135°)', 'Poor (90°)', 'Very Poor (<90°)'].map(grade => (
                <button
                  key={grade}
                  onClick={() => setManualArmRaiseGrade(grade)}
                  className={`py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all text-left ${
                    manualArmRaiseGrade.startsWith(grade.split(' ')[0]) 
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' 
                      : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200'
                  }`}
                >
                  {grade === 'Excellent (180°)' ? '優秀 (180°)' : grade === 'Good (160°)' ? '良好 (160°)' : grade === 'Normal (135°)' ? '普通 (135°)' : grade === 'Poor (90°)' ? '要改善 (90°)' : '極めて要改善 (<90°)'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button 
          onClick={handleArmRaiseSubmit}
          className="w-full mt-5 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all"
        >
          完了
        </button>
      </Modal>

      <Modal 
        isOpen={flexInputModal.isOpen}
        title="柔軟性測定結果の確認"
        message="AI測定による基準値が表示されています。必要に応じて手動で確認・編集してください。"
        onClose={() => {}}
      >
        <div className="mt-4 space-y-5">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-400 mb-1">📊 AI測定による基準値</div>
            <div className="flex gap-4 text-sm text-slate-600">
              <span>手の位置: <strong className="text-indigo-600">{flexInputModal.postureData?.handPosition}</strong></span>
              <span>腰の曲げ角度: <strong className="text-indigo-600">{flexInputModal.postureData?.waistBendAngle}°</strong></span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              膝: {flexInputModal.postureData?.kneeStraight ? '正常 (まっすぐ)' : '曲がっている (ペナルティ)'}
            </div>
          </div>
 
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              <i className="fas fa-running mr-1 text-indigo-500"></i> 最終評価を選択
            </label>
            <div className="flex flex-col gap-2">
              {['Excellent (Palms Down)', 'Good (Fingertips)', 'Normal (Mid-Shin)', 'Poor (Upper Shin)', 'Very Poor (Knees)'].map(grade => (
                <button
                  key={grade}
                  onClick={() => setManualFlexGrade(grade)}
                  className={`py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all text-left ${
                    manualFlexGrade.startsWith(grade.split(' ')[0]) 
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' 
                      : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200'
                  }`}
                >
                  {grade === 'Excellent (Palms Down)' ? '優秀 (手のひらがつく)' : grade === 'Good (Fingertips)' ? '良好 (指先がつく)' : grade === 'Normal (Mid-Shin)' ? '普通 (すねの中間)' : grade === 'Poor (Upper Shin)' ? '要改善 (すねの上部)' : '極めて要改善 (膝まで)'}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
              <i className="fas fa-info-circle text-indigo-400 mr-1"></i>
              膝や腰の曲がり具合に基づいて、AIによる自動ペナルティが適用される場合があります。
            </p>
          </div>
        </div>
        <button 
          onClick={handleFlexSubmit}
          className="w-full mt-5 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all"
        >
          完了
        </button>
      </Modal>

      {renderContent()}
      {showSysCheck && (
        <SystemCheckOverlay onComplete={() => {
          setShowSysCheck(false);
          if (!hasStarted) {
            setHasStarted(true);
          }
        }} />
      )}
      {/* 参加者待機リスト */}
      {showWaitingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-3xl w-full p-8 relative max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setShowWaitingModal(false)}
              className="absolute right-6 top-6 w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white transition-all cursor-pointer border border-slate-700"
            >
              <i className="fas fa-times"></i>
            </button>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center">
                <i className="fas fa-users text-lg"></i>
              </div>
              <div className="text-left">
                <h3 className="text-2xl font-black text-white">参加者待機リスト</h3>
                <p className="text-slate-500 text-sm mt-0.5 font-bold">
                  {activeEventCode ? `イベントモード開催中 (${activeEventCode})` : "ローカル待機リスト"}
                </p>
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-[300px]">
          {uniqueWaitingList.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <i className="fas fa-users-slash text-4xl mb-3 opacity-50"></i>
              <p className="text-sm font-bold">待機中の参加者はいません。</p>
              <p className="text-xs opacity-75">ブースで参加者を登録してください。</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
              {[...uniqueWaitingList]
                .sort((a, b) => {
                  if (a.isStarred && !b.isStarred) return -1;
                  if (!a.isStarred && b.isStarred) return 1;
                  return a.createdAt - b.createdAt;
                })
                .map((member, index) => (
                  <div 
                    key={member.id}
                    className={`group border rounded-2xl p-4 flex items-center justify-between transition-all ${
                      member.isStarred
                        ? 'bg-rose-50 border-rose-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600">
                        {index + 1}
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-slate-800 text-lg flex items-center gap-2">
                          {member.name}
                          {member.weakestCode !== undefined && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedKeywordsToShow({
                                  name: member.name,
                                  keywords: member.sevenCodeKeywords || [],
                                  weakestCode: member.weakestCode || 1
                                });
                              }}
                              className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold"
                            >
                              コード{member.weakestCode}要改善
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mt-1">
                          <span>{member.age} 歳</span>
                          <span>•</span>
                          <span>{member.gender === 'male' ? '男性' : '女性'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => handleDeleteWaiting(e, member)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-rose-200 active:scale-95"
                      >
                        <i className="fas fa-trash-alt"></i> 削除
                      </button>
                      <button
                        onClick={async () => {
                          setUserInfo({
                            name: member.name,
                            gender: member.gender,
                            age: member.age,
                            phone: member.phone,
                            memberType: member.memberType,
                            birthDate: member.birthDate,
                            healthNeeds: member.healthNeeds || []
                          });
                          
                          const mockSevenCodeImage: CapturedImage = {
                            step: AssessmentStep.SEVEN_CODE_CHECK,
                            dataUrl: '',
                            sevenCodeKeywords: member.sevenCodeKeywords || [],
                            weakestCode: member.weakestCode || 1
                          };
                          setCapturedImages([mockSevenCodeImage]);
                          setIsWaitingMemberActive(true);
                          setActiveWaitingId(member.id);
                          
                          await updateWaitingStatus(member.id, 'measuring');
                          setShowWaitingModal(false);
                          setStep(AssessmentStep.POSTURE_FRONT);
                          speak(`Starting assessment for ${member.name}.`);
                        }}
                        className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-base font-black transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer border border-indigo-500/20"
                      >
                        <i className="fas fa-play text-[9px]"></i>
                        <span>Start Scan</span>
                      </button>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 text-center flex justify-between items-center text-sm text-slate-500 font-bold">
              <span>Total: <strong className="text-indigo-400 text-lg">{uniqueWaitingList.length}</strong> person(s)</span>
              <span>Click Start Scan to begin measuring.</span>
            </div>
          </div>
        </div>
      )}

      {/* 7-code selection detail modal */}
      {selectedKeywordsToShow && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setSelectedKeywordsToShow(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedKeywordsToShow(null)}
              className="absolute right-5 top-5 w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white transition-all cursor-pointer border border-slate-700"
            >
              <i className="fas fa-times text-sm"></i>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center">
                <i className="fas fa-clipboard-list text-base"></i>
              </div>
              <div className="text-left">
                <h3 className="text-base font-bold text-white">{selectedKeywordsToShow.name}'s 7-Code Checklist</h3>
                <p className="text-slate-500 text-[10px] mt-0.5 font-bold">
                  {selectedKeywordsToShow.keywords.length} selected symptoms
                </p>
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-800/80 rounded-2xl p-4 text-left mb-5">
              <div className="text-xs text-indigo-300 font-bold mb-3 flex items-center gap-1.5">
                <i className="fas fa-exclamation-circle"></i>
                Weakest: Code {selectedKeywordsToShow.weakestCode}
              </div>
              {selectedKeywordsToShow.keywords.length === 0 ? (
                <p className="text-slate-400 text-xs text-center py-6">No symptoms or emotions selected.</p>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto pr-1">
                  {selectedKeywordsToShow.keywords.map((kw, idx) => (
                    <span key={idx} className="bg-indigo-950/80 text-indigo-300 border border-indigo-900/50 px-2.5 py-1.5 rounded-xl text-xs font-semibold">
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedKeywordsToShow(null)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all cursor-pointer"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      <Toast 
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
      {renderDevMenu()}
    </div>
  );
};

export default AssessmentFlow;
