import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import CameraModule from './CameraModule';

interface SystemCheckOverlayProps {
  onComplete: () => void;
}

export const SystemCheckOverlay: React.FC<SystemCheckOverlayProps> = ({ onComplete }) => {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<'pc' | 'camera' | 'done'>('pc');
  const [pcStatus, setPcStatus] = useState<'excellent' | 'normal' | 'poor'>('normal');
  const [cpuCores, setCpuCores] = useState<number>(0);
  const [ramSize, setRamSize] = useState<number>(0);
  const [isCheckingPc, setIsCheckingPc] = useState(true);
  
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(localStorage.getItem('selectedCameraId') || '');
  const [showDeviceSelect, setShowDeviceSelect] = useState(false);

  useEffect(() => {
    if (phase === 'camera') {
      const getDevices = async () => {
        try {
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
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'pc') {
      const cores = navigator.hardwareConcurrency || 4;
      // @ts-ignore - deviceMemory is not standard in all target environments (like iOS), but widely supported in Chromium
      const ram = (navigator as any).deviceMemory || 4;
      
      setCpuCores(cores);
      setRamSize(ram);

      setTimeout(() => {
        if (cores >= 8 && ram >= 8) {
          setPcStatus('excellent');
        } else if (cores >= 4 && ram >= 4) {
          setPcStatus('normal');
        } else {
          setPcStatus('poor');
        }
        setIsCheckingPc(false);
      }, 1500); // 심미적인 점검 시간 (진단 이펙트)
    }
  }, [phase]);

  const handleCameraCapture = (dataUrl: string) => {
    // 사진이 정상적으로 촬영되면 카메라와 조명 테스트 통과!
    setPhase('done');
    setTimeout(() => {
      onComplete();
    }, 1500);
  };

  return (
    <div className="absolute inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center p-6">
      {phase === 'pc' && (
        <div className="bg-slate-800 p-10 rounded-[2.5rem] border border-slate-700 shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-w-md w-full text-center animate-fade-in">
          <div className="w-24 h-24 mx-auto bg-indigo-900/30 rounded-full flex items-center justify-center mb-8 border border-indigo-500/30">
            <i className={`fas fa-microchip text-4xl ${isCheckingPc ? 'text-indigo-400 animate-pulse' : 'text-emerald-400'}`}></i>
          </div>
          <h3 className="text-2xl font-black text-white mb-8 tracking-tight">{t('systemCheck.title')}</h3>
          
          <div className="space-y-4 text-left mb-10">
            <div className="flex justify-between items-center bg-slate-900/50 p-5 rounded-2xl border border-slate-700/50">
              <span className="text-slate-400 font-medium">{t('systemCheck.cpuCores')}</span>
              <span className="text-white font-bold">{isCheckingPc ? <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> : `${cpuCores} Core`}</span>
            </div>
            <div className="flex justify-between items-center bg-slate-900/50 p-5 rounded-2xl border border-slate-700/50">
              <span className="text-slate-400 font-medium">{t('systemCheck.ramSize')}</span>
              <span className="text-white font-bold">{isCheckingPc ? <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> : `${ramSize} ${t('systemCheck.ramGb')}`}</span>
            </div>
            
            {!isCheckingPc && (
              <div className={`p-5 rounded-2xl border-2 font-black text-center text-lg mt-6 shadow-inner ${
                pcStatus === 'excellent' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' :
                pcStatus === 'normal' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' :
                'bg-rose-500/10 border-rose-500/50 text-rose-400'
              }`}>
                {t('systemCheck.systemScore')} {
                  pcStatus === 'excellent' ? t('systemCheck.scoreExcellent') :
                  pcStatus === 'normal' ? t('systemCheck.scoreNormal') :
                  t('systemCheck.scorePoor')
                }
              </div>
            )}
          </div>

          <button 
            id="syscheck-next-btn"
            onClick={() => setPhase('camera')}
            disabled={isCheckingPc}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-5 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_10px_20px_-5px_rgba(99,102,241,0.4)]"
          >
            {t('systemCheck.nextStep')} <i className="fas fa-arrow-right ml-2 text-xs"></i>
          </button>
        </div>
      )}

      {phase === 'camera' && (
        <div className="w-full max-w-3xl bg-slate-800 p-8 rounded-[2.5rem] border border-slate-700 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col items-center animate-fade-in relative overflow-hidden">
          <div className="text-center mb-6 z-10">
            <span className="text-indigo-400 font-bold text-xs tracking-widest mb-2 block">{t('systemCheck.step2')}</span>
            <h3 className="text-3xl font-black text-white tracking-tight">{t('systemCheck.cameraCheckTitle')}</h3>
            
            {devices.length > 0 && (
              <div className="mt-4 flex justify-center items-center relative z-20">
                <button 
                  onClick={() => setShowDeviceSelect(!showDeviceSelect)}
                  className="bg-slate-700 border border-slate-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-slate-600 transition-all"
                >
                  <i className="fas fa-video text-indigo-400"></i>
                  <span>{t('systemCheck.selectCamera', { count: devices.length })}</span>
                  <i className="fas fa-chevron-down text-xs text-slate-400"></i>
                </button>
                
                {showDeviceSelect && (
                  <div className="absolute top-12 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 w-64 animate-fade-in">
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
          </div>
          
          <div className="w-full flex justify-center z-10" style={{ transform: 'scale(0.85)', transformOrigin: 'top center', marginBottom: '-10%' }}>
             <CameraModule 
               onCapture={handleCameraCapture} 
               guidelineType="face" 
               autoCapture={true}
               preferredDeviceId={selectedDeviceId}
             />
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="bg-slate-800 p-12 rounded-[2.5rem] border border-emerald-500/40 shadow-[0_20px_50px_rgba(16,185,129,0.2)] max-w-md w-full text-center animate-fade-in relative overflow-hidden">
          <div className="absolute inset-0 bg-emerald-500/5 animate-pulse"></div>
          <div className="w-28 h-28 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(16,185,129,0.3)] border-4 border-emerald-500/30">
            <i className="fas fa-check text-6xl text-emerald-400"></i>
          </div>
          <h3 className="text-3xl font-black text-white mb-3">{t('systemCheck.checkDone')}</h3>
          <p className="text-emerald-400 font-medium">
            {t('systemCheck.checkDoneDesc').split('\n').map((line, idx) => (
              <React.Fragment key={idx}>{line}<br/></React.Fragment>
            ))}
          </p>
        </div>
      )}
    </div>
  );
};
