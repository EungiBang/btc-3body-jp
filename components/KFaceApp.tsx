import React, { useState, useEffect } from 'react';
import KFaceCameraScanner from './KFaceCameraScanner';
import { PhysiognomyMetrics, PhysiognomyReport, UserInfo, MemberRecord } from '../types';
import { analyzePhysiognomy } from '../services/geminiService';
import { averageMetrics } from '../utils/physiognomy';
import { getRecordsLocally } from '../services/localDb';
import KFaceReport from './KFaceReport';
import { SystemCheckOverlay } from './SystemCheckOverlay';
import { getUsageStatus, incrementUsage, UsageStatus } from '../services/usageLimitService';

interface KFaceAppProps {
  userInfo?: UserInfo | null;
  onClose?: () => void;
  onBack?: () => void;
}

type KFaceStep = 'welcome' | 'scanner' | 'history_select' | 'analyzing' | 'report';

const KFaceApp: React.FC<KFaceAppProps> = ({ userInfo: parentUserInfo, onClose, onBack }) => {
  const [step, setStep] = useState<KFaceStep>('welcome');
  const [metricsList, setMetricsList] = useState<PhysiognomyMetrics[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [report, setReport] = useState<PhysiognomyReport | null>(null);
  const [localUserInfo, setLocalUserInfo] = useState<UserInfo | null>(parentUserInfo || null);
  const [historyRecords, setHistoryRecords] = useState<MemberRecord[]>([]);
  const [showSysCheck, setShowSysCheck] = useState(false);
  const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null);
  const [branchId, setBranchId] = useState<string>('');

  useEffect(() => {
    if (parentUserInfo) {
      setLocalUserInfo(parentUserInfo);
    }
  }, [parentUserInfo]);

  useEffect(() => {
    if (step === 'history_select') {
      const loadRecords = async () => {
        const records = await getRecordsLocally();
        // 얼굴 사진이 있는 기록만 필터링 (최신순)
        const validRecords = records.filter(r => r.images?.some(img => img.type === 'face'))
          .sort((a, b) => new Date(b.lastTestDate).getTime() - new Date(a.lastTestDate).getTime());
        setHistoryRecords(validRecords);
      };
      loadRecords();
    }
  }, [step]);

  useEffect(() => {
    const initUsage = async () => {
      let branch: any = null;
      const currentDeviceJson = localStorage.getItem('currentDevice');
      if (currentDeviceJson) {
        try {
          branch = JSON.parse(currentDeviceJson);
        } catch(e) {}
      }

      if (!branch) {
        if (window.electronAPI) {
          branch = await window.electronAPI.loadAuthToken();
        } else {
          const local = localStorage.getItem('branchAuth');
          if (local) branch = JSON.parse(local);
        }
      }
      
      const bId = branch?.branchId || branch?.id;
      if (bId) {
        setBranchId(bId);
        const status = await getUsageStatus(bId);
        setUsageStatus(status);
      }
    };
    initUsage();
  }, []);

  const checkUsage = (): boolean => {
    if (!usageStatus) return true;
    if (usageStatus.kfaceUsed >= usageStatus.kfaceLimit) {
      alert(`오늘 K-관상 일일 사용 한도(${usageStatus.kfaceLimit}회)를 모두 소진했습니다.\n환경 설정에서 한도를 늘려주세요.`);
      return false;
    }
    return true;
  };

  const handleScanComplete = async (metrics: PhysiognomyMetrics[], imageSrc: string) => {
    setCapturedImage(imageSrc);
    setMetricsList(metrics);
    setStep('analyzing');
    
    try {
      const avgMetrics = averageMetrics(metrics);
      const customerData = localUserInfo ? {
        displayName: localUserInfo.name,
        birthDate: localUserInfo.birthDate,
        gender: localUserInfo.gender
      } : undefined;
      
      const result = await analyzePhysiognomy(avgMetrics, customerData);
      if (localUserInfo) {
        result.userInfo = localUserInfo;
      }
      setReport(result);
      setStep('report');
      
      // 횟수 차감 반영
      if (branchId) {
        await incrementUsage(branchId, 'kface');
        setUsageStatus(prev => prev ? { ...prev, kfaceUsed: prev.kfaceUsed + 1 } : null);
      }
    } catch (err) {
      console.error('K-Face analysis failed:', err);
      alert('분석에 실패했습니다. 다시 시도해주세요.');
      setStep('welcome');
    }
  };

  const handleSelectHistory = async (record: MemberRecord) => {
    const faceImg = record.images?.find(img => img.type === 'face')?.dataUrl;
    if (!faceImg) {
      alert("해당 기록에 얼굴 사진이 존재하지 않습니다.");
      return;
    }
    
    if (record.report?.userInfo) {
      setLocalUserInfo(record.report.userInfo);
    }
    
    setStep('analyzing');
    
    try {
      const img = new Image();
      img.src = faceImg;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const { initializeMediaPipe } = await import('../services/mediapipe');
      const { calculateMetrics } = await import('../utils/physiognomy');
      
      const faceLandmarker = await initializeMediaPipe('IMAGE');
      const results = faceLandmarker.detect(img);

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0];
        const blendshapes = results.faceBlendshapes?.[0];
        
        if (blendshapes) {
          const metrics = calculateMetrics(landmarks, blendshapes);
          
          // Draw landmarks on the image for the report
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          const ctx = tempCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            ctx.fillStyle = 'rgba(217, 70, 239, 0.8)'; // fuchsia-500
            landmarks.forEach((point) => {
              ctx.beginPath();
              ctx.arc(point.x * tempCanvas.width, point.y * tempCanvas.height, Math.max(2, img.width / 300), 0, 2 * Math.PI);
              ctx.fill();
            });
            const finalImageSrc = tempCanvas.toDataURL('image/jpeg', 0.9);
            
            setCapturedImage(finalImageSrc);
            setMetricsList([metrics]);
            
            const customerData = record.report?.userInfo ? {
              displayName: record.report.userInfo.name,
              birthDate: record.report.userInfo.birthDate,
              gender: record.report.userInfo.gender
            } : localUserInfo ? {
              displayName: localUserInfo.name,
              birthDate: localUserInfo.birthDate,
              gender: localUserInfo.gender
            } : undefined;
            
            const reportResult = await analyzePhysiognomy(metrics, customerData);
            if (record.report?.userInfo) {
              reportResult.userInfo = record.report.userInfo;
            } else if (localUserInfo) {
              reportResult.userInfo = localUserInfo;
            }
            setReport(reportResult);
            setStep('report');
            
            // 횟수 차감 반영
            if (branchId) {
              await incrementUsage(branchId, 'kface');
              setUsageStatus(prev => prev ? { ...prev, kfaceUsed: prev.kfaceUsed + 1 } : null);
            }
          }
        } else {
          alert("얼굴 특징을 분석할 수 없습니다.");
          setStep('history_select');
        }
      } else {
        alert("사진에서 얼굴을 찾을 수 없습니다.");
        setStep('history_select');
      }
    } catch (err) {
      console.error("History image analysis failed:", err);
      alert("분석에 실패했습니다. 사진 품질을 확인해주세요.");
      setStep('history_select');
    }
  };

  return (
    <div className="w-full h-full bg-slate-900 text-white overflow-hidden flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center p-6 border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose || onBack}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
          >
            <i className="fas fa-times text-slate-300"></i>
          </button>
          <div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-indigo-400">
              K-관상 (Face Analysis)
            </h1>
            <p className="text-xs text-slate-400">프리미엄 물형관상 및 7코드 에너지 분석</p>
            {usageStatus && (
              <div className="mt-1 flex items-center gap-2 text-[10px] font-bold">
                <span className={`px-2 py-0.5 rounded-full ${usageStatus.kfaceUsed >= usageStatus.kfaceLimit ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'}`}>
                  오늘 잔여 횟수: {Math.max(0, usageStatus.kfaceLimit - usageStatus.kfaceUsed)} / {usageStatus.kfaceLimit}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col p-6 overflow-y-auto">
        {step === 'welcome' && (
          <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col justify-center gap-6">
            <div className="text-center mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-fuchsia-500/20 to-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_50px_rgba(147,51,234,0.3)]">
                <i className="fas fa-mask text-4xl text-fuchsia-400"></i>
              </div>
              <h2 className="text-3xl font-black mb-4">AI K-관상 스캐너</h2>
              <p className="text-slate-400">
                120프레임 이상의 미세 표정 및 랜드마크 분석을 통해<br />
                당신의 물형, 7코드 에너지 존, 운세 흐름을 도출합니다.
              </p>
            </div>

            <button 
              onClick={() => {
                if (!checkUsage()) return;
                setShowSysCheck(true); 
                setTimeout(() => { setShowSysCheck(false); setStep('scanner'); }, 2000); 
              }}
              className="group relative w-full p-6 bg-gradient-to-r from-fuchsia-600 to-indigo-600 rounded-3xl overflow-hidden shadow-[0_10px_30px_rgba(147,51,234,0.3)] hover:shadow-[0_15px_40px_rgba(147,51,234,0.5)] transition-all hover:-translate-y-1"
            >
              <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%] animate-[shimmer_3s_infinite]"></div>
              <div className="relative flex items-center gap-5">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                  <i className="fas fa-camera text-2xl text-white"></i>
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-xl font-bold text-white mb-1">직접 촬영하기</h3>
                  <p className="text-fuchsia-100 text-sm">실시간 카메라로 정밀한 랜드마크 스캔</p>
                </div>
                <i className="fas fa-chevron-right text-xl text-white/50 group-hover:text-white transition-colors"></i>
              </div>
            </button>

            <button 
              onClick={() => {
                if (!checkUsage()) return;
                setStep('history_select');
              }}
              className="group w-full p-6 bg-slate-800/80 border border-slate-700 hover:border-slate-600 rounded-3xl transition-all hover:bg-slate-800"
            >
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-slate-700 rounded-2xl flex items-center justify-center">
                  <i className="fas fa-history text-2xl text-slate-300"></i>
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-xl font-bold text-slate-200 mb-1">기존 회원 기록 재활용</h3>
                  <p className="text-slate-400 text-sm">이전에 측정했던 얼굴 사진을 불러와서 재분석</p>
                </div>
                <i className="fas fa-chevron-right text-xl text-slate-500 group-hover:text-slate-300 transition-colors"></i>
              </div>
            </button>
          </div>
        )}


        {step === 'scanner' && (
          <div className="flex-1 flex justify-center items-center">
            <KFaceCameraScanner onScanComplete={handleScanComplete} />
          </div>
        )}

        {step === 'history_select' && (
          <div className="max-w-3xl mx-auto w-full">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <i className="fas fa-history text-fuchsia-400"></i>
              기존 회원 사진 선택
            </h2>
            {historyRecords.length === 0 ? (
              <div className="text-center py-20 bg-slate-800/50 rounded-3xl border border-slate-700">
                <i className="fas fa-image text-5xl text-slate-600 mx-auto mb-4 block"></i>
                <p className="text-slate-400">얼굴 사진이 포함된 이전 기록이 없습니다.</p>
                <button onClick={() => setStep('welcome')} className="mt-6 px-6 py-2 bg-slate-700 rounded-full hover:bg-slate-600 transition-colors">뒤로가기</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {historyRecords.map(record => {
                  const faceImg = record.images?.find(img => img.type === 'face');
                  return (
                    <div 
                      key={record.id} 
                      onClick={() => handleSelectHistory(record)}
                      className="bg-slate-800 p-4 rounded-2xl border border-slate-700 hover:border-fuchsia-500/50 cursor-pointer transition-all flex items-center gap-4"
                    >
                      <img src={faceImg?.dataUrl} alt="Face" className="w-20 h-20 object-cover rounded-xl bg-black" />
                      <div>
                        <h4 className="font-bold text-lg">{record.report?.userInfo?.name || '익명'}</h4>
                        <p className="text-sm text-slate-400">{new Date(record.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {step === 'analyzing' && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative w-32 h-32 mb-8">
              <div className="absolute inset-0 border-4 border-fuchsia-500/30 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="fas fa-brain text-4xl text-fuchsia-400 animate-pulse"></i>
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">물형 및 7코드 분석 중...</h2>
            <p className="text-slate-400 text-center max-w-md">
              추출된 랜드마크 기반으로 프리미엄 관상학 분석을 진행하고 있습니다.<br/>
              약 10~15초 소요될 수 있습니다.
            </p>
          </div>
        )}

        {step === 'report' && report && capturedImage && (
          <KFaceReport 
            report={report} 
            imageSrc={capturedImage}
            onClose={() => {
              setStep('welcome');
              setReport(null);
              setCapturedImage(null);
            }} 
          />
        )}
      </div>

      {showSysCheck && <SystemCheckOverlay onComplete={() => {}} />}
    </div>
  );
};

export default KFaceApp;
