import React, { useState, useEffect } from 'react';
import { getActiveApiKey, setCustomApiKey, isUsingCustomKey } from '../services/geminiService';
import { getBranches } from '../services/firebaseAuthService';
import { getUsageStatus, updateDailyLimit, UsageStatus } from '../services/usageLimitService';
import { performFullBackup, getLastBackupTime, getLastBackupCount } from '../services/backupService';
import { createEvent, checkEventExists } from '../services/eventService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [usingCustom, setUsingCustom] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [branchInfo, setBranchInfo] = useState<any>(null);
  
  // 사용 한도 상태
  const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null);
  const [hardwareId, setHardwareId] = useState<string>('Unknown');
  const [appVersion, setAppVersion] = useState<string>('Unknown');
  
  // 카메라 상태
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  
  // 백업 상태
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [lastBackupCount, setLastBackupCount] = useState<number>(0);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupResult, setBackupResult] = useState<string | null>(null);

  // 연합 행사 모드 상태 추가
  const [activeEventCode, setActiveEventCode] = useState<string>('');
  const [eventInput, setEventInput] = useState<string>('');
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [isJoiningEvent, setIsJoiningEvent] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);

  // 연합 행사 핸들러 구현
  const handleCreateEvent = async () => {
    if (!branchInfo) return;
    setIsCreatingEvent(true);
    setEventError(null);
    try {
      const branchId = branchInfo.branchId || branchInfo.id || 'unknown';
      const branchName = branchInfo.branchName || 'Unknown Branch';
      const code = await createEvent(branchId, branchName);
      setActiveEventCode(code);
      setEventInput(code);
      localStorage.setItem('activeEventCode', code);
      window.dispatchEvent(new CustomEvent('eventCode:change', { detail: { eventCode: code } }));
    } catch (e) {
      setEventError('Failed to create event code.');
    } finally {
      setIsCreatingEvent(false);
    }
  };

  const handleJoinEvent = async () => {
    if (!eventInput || !eventInput.trim()) {
      setEventError('Please enter the event code.');
      return;
    }
    setIsJoiningEvent(true);
    setEventError(null);
    try {
      const code = eventInput.trim();
      const exists = await checkEventExists(code);
      if (exists) {
        setActiveEventCode(code);
        localStorage.setItem('activeEventCode', code);
        window.dispatchEvent(new CustomEvent('eventCode:change', { detail: { eventCode: code } }));
      } else {
        setEventError('This event code does not exist or has expired.');
      }
    } catch (e) {
      setEventError('An error occurred while joining the event.');
    } finally {
      setIsJoiningEvent(false);
    }
  };

  const handleLeaveEvent = () => {
    setActiveEventCode('');
    setEventInput('');
    localStorage.removeItem('activeEventCode');
    window.dispatchEvent(new CustomEvent('eventCode:change', { detail: { eventCode: '' } }));
    setEventError(null);
  };

  useEffect(() => {
    if (isOpen) {
      setUsingCustom(isUsingCustomKey());
      const currentKey = getActiveApiKey();
      if (isUsingCustomKey()) {
        setApiKey(currentKey);
      } else {
        setApiKey('');
      }
      setSaved(false);

      // 연합 행사 코드 불러오기
      const savedEventCode = localStorage.getItem('activeEventCode') || '';
      setActiveEventCode(savedEventCode);
      setEventInput(savedEventCode);
      setEventError(null);
      
      // Load branch info (v4 currentDevice 활용)
      const loadBranchAndUsage = async () => {
        let branch: any = null;
        
        // 1. V4 currentDevice 로컬 스토리지 확인
        const currentDeviceJson = localStorage.getItem('currentDevice');
        if (currentDeviceJson) {
          try {
            branch = JSON.parse(currentDeviceJson);
            setHardwareId(branch.id || 'Unknown');
            
            if (window.electronAPI && window.electronAPI.getAppVersion) {
              window.electronAPI.getAppVersion().then(setAppVersion);
            }
            if (window.electronAPI && window.electronAPI.getHardwareId) {
              window.electronAPI.getHardwareId().then((id: string) => {
                if (id) setHardwareId(id);
              });
            }
            
            // v4는 branchId만 있으므로, 실제 지점명(name)을 DB에서 가져와 매핑
            let actualBranchName = branch.branchId;
            try {
              const branches = await getBranches();
              const matched = branches.find(b => b.id === branch.branchId);
              if (matched) actualBranchName = matched.name;
            } catch (err) {
              console.error("Failed to fetch branch name", err);
            }

            // v4 스키마 매핑
            branch = {
              ...branch,
              branchName: actualBranchName || 'Unknown Branch',
              adminName: branch.adminName || 'Unknown',
              contact: branch.contact || 'Not registered',
              createdAt: branch.createdAt
            };
          } catch(e) {}
        }
        
        // 2. 하위 호환성 (V3 branchAuth) - v4 기기가 없을 때만
        if (!branch) {
          if (window.electronAPI) {
            branch = await window.electronAPI.loadAuthToken();
          } else {
            const local = localStorage.getItem('branchAuth');
            if (local) branch = JSON.parse(local);
          }
        }
        
        if (branch) {
          setBranchInfo(branch);
          const branchId = branch.branchId || branch.id;
          if (branchId) {
            const status = await getUsageStatus(branchId);
            setUsageStatus(status);
          }
        }
      };
      
      loadBranchAndUsage();
      
      // 백업 정보 로드
      setLastBackup(getLastBackupTime());
      setLastBackupCount(getLastBackupCount());
      setBackupResult(null);

      // 카메라 목록 가져오기
      const getDevices = async () => {
        try {
          // 권한 요청 시도 (이미 있으면 바로 넘어감)
          await navigator.mediaDevices.getUserMedia({ video: true, audio: false }).catch(() => {});
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
          setDevices(videoDevices);
          const savedId = localStorage.getItem('selectedCameraId');
          if (savedId && videoDevices.find(d => d.deviceId === savedId)) {
            setSelectedDeviceId(savedId);
          } else if (videoDevices.length > 0) {
            setSelectedDeviceId(videoDevices[0].deviceId);
          }
        } catch (err) {
          console.error("Error enumerating devices:", err);
        }
      };
      getDevices();
      
      const handleDeviceChange = () => getDevices();
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      };
    }
  }, [isOpen]);


  const handleSave = () => {
    setCustomApiKey(apiKey);
    setUsingCustom(isUsingCustomKey());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setCustomApiKey('');
    setApiKey('');
    setUsingCustom(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleManualBackup = async () => {
    setIsBackingUp(true);
    setBackupResult(null);
    try {
      const result = await performFullBackup();
      setLastBackup(getLastBackupTime());
      setLastBackupCount(getLastBackupCount());
      if (result.synced > 0) {
        setBackupResult(`✅ ${result.synced} new record(s) synced (Total: ${result.total})`);
      } else {
        setBackupResult(`✅ All data is already synchronized (Total: ${result.total})`);
      }
    } catch (e) {
      setBackupResult('❌ An error occurred during backup.');
    } finally {
      setIsBackingUp(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
              <i className="fas fa-cog text-lg"></i>
            </div>
            <h2 className="text-xl font-bold text-slate-800">Settings</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-all"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* API Key Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-2">
              <i className="fas fa-key text-amber-500 mr-2"></i>
              Gemini API Key
            </label>
            <p className="text-xs text-slate-400 mb-3">
              A default API key is configured. To use your personal API key, enter it below.
            </p>
            
            {/* Current status */}
            <div className={`mb-3 p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
              usingCustom 
                ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              <i className={`fas ${usingCustom ? 'fa-user-edit' : 'fa-shield-alt'}`}></i>
              {usingCustom ? 'Using Custom API Key' : 'Using Default API Key'}
            </div>

            {/* Input */}
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter custom API key (Optional)"
                className="w-full px-4 py-3 pr-12 border-2 border-slate-200 rounded-xl focus:border-indigo-400 focus:outline-none transition-all text-sm bg-slate-50"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <i className={`fas ${showKey ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            {usingCustom && (
              <button
                onClick={handleReset}
                className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all text-sm"
              >
                Restore Default Key
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!apiKey.trim() && !usingCustom}
              className={`flex-1 py-3 font-bold rounded-xl transition-all text-sm ${
                saved 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400'
              }`}
            >
              {saved ? '✅ Saved' : 'Save'}
            </button>
          </div>
        </div>

        {/* Camera Selection Section */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <i className="fas fa-camera text-indigo-500"></i>
            Camera Settings
          </h3>
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <label className="block text-xs font-bold text-slate-500 mb-2">Select Default Camera</label>
            <select
              value={selectedDeviceId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedDeviceId(newId);
                localStorage.setItem('selectedCameraId', newId);
                window.dispatchEvent(new CustomEvent('camera:change', { detail: { deviceId: newId } }));
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-400"
            >
              <option value="">Auto Select</option>
              {devices.map((device, idx) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-2">
              <i className="fas fa-info-circle mr-1"></i>
              The selected camera will be used as default across the application.
            </p>
          </div>
        </div>


        {/* Union Event Section */}
        {branchInfo && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <i className="fas fa-users text-indigo-500"></i>
              Joint Event Mode
            </h3>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-4">
              {activeEventCode ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-500">Active Event Code</span>
                    <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full animate-pulse">Active</span>
                  </div>
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-center font-mono font-black text-sm text-indigo-700 tracking-wider">
                    {activeEventCode}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 text-center">
                    * Waiting list and health check records are shared in real-time under this event code.
                  </p>
                  <button
                    onClick={handleLeaveEvent}
                    className="w-full mt-3 py-2.5 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-sign-out-alt"></i> End & Exit Event
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Generate or enter an event code when hosting joint events with other branches to share queue and test data in real-time.
                  </p>
                  
                  {/* 주관 기기: 코드 생성 */}
                  <button
                    onClick={handleCreateEvent}
                    disabled={isCreatingEvent}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    {isCreatingEvent ? (
                      <><i className="fas fa-spinner fa-spin"></i> Creating Event...</>
                    ) : (
                      <><i className="fas fa-plus-circle"></i> Create New Joint Event (Host)</>
                    )}
                  </button>
                  
                  <div className="flex items-center gap-2 my-2 text-xs text-slate-400">
                    <div className="flex-1 h-px bg-slate-200"></div>
                    <span>OR</span>
                    <div className="flex-1 h-px bg-slate-200"></div>
                  </div>

                  {/* 지원 기기: 코드 입력 참가 */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5">Enter Event Joining Code</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={eventInput}
                        onChange={(e) => setEventInput(e.target.value.toUpperCase())}
                        placeholder="EVT_XXXX..."
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-indigo-400 uppercase font-mono"
                      />
                      <button
                        onClick={handleJoinEvent}
                        disabled={isJoiningEvent || !eventInput.trim()}
                        className="px-4 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 text-white font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1"
                      >
                        {isJoiningEvent ? 'Joining...' : 'Join Event'}
                      </button>
                    </div>
                    {eventError && (
                      <p className="text-[10px] text-rose-500 mt-1.5 font-bold">
                        <i className="fas fa-exclamation-circle mr-1"></i> {eventError}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Branch Info Section */}
        {branchInfo && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <i className="fas fa-store-alt text-indigo-500"></i>
              Branch Registration Info
            </h3>
            <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Branch Name</span>
                <span className="text-slate-800 font-black">{branchInfo.branchName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Manager</span>
                <span className="text-slate-800 font-black">{branchInfo.adminName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Contact</span>
                <span className="text-slate-800 font-black">{branchInfo.contact || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Authentication Status</span>
                <span className="text-emerald-600 font-black">
                  {branchInfo.status === 'active' ? 'Activated (v4)' : 'Local Auth (v3)'}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200/60 mt-1">
                <span className="text-slate-400 font-medium text-xs">Registration Date</span>
                <span className="text-slate-500 font-medium text-xs">
                  {branchInfo.createdAt 
                    ? new Date(
                        branchInfo.createdAt.seconds 
                        ? branchInfo.createdAt.seconds * 1000 
                        : branchInfo.createdAt
                      ).toLocaleDateString()
                    : branchInfo.verifiedAt ? new Date(branchInfo.verifiedAt).toLocaleDateString() : 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-slate-100 mt-1 pt-2">
                <span className="text-slate-500 font-medium">Device ID</span>
                <span className="font-mono text-xs text-slate-400 max-w-[150px] truncate" title={hardwareId}>
                  {hardwareId}
                </span>
              </div>
            </div>
            
            {/* K관상/K타로 일일 사용 한도 관리 */}
            {usageStatus && (
              <div className="mt-4 bg-fuchsia-50/50 rounded-xl p-4 border border-fuchsia-100/50">
                <h4 className="text-xs font-bold text-fuchsia-800 mb-3 flex items-center justify-between">
                  <span><i className="fas fa-magic text-fuchsia-500 mr-1"></i> AI Premium Analysis Limits</span>
                  <span className="text-[10px] text-fuchsia-600/70 font-normal">Today (Cloud Synced)</span>
                </h4>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-700">K-Physiognomy</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600 font-bold">
                        <strong className="text-fuchsia-600">{usageStatus.kfaceUsed}</strong> / {usageStatus.kfaceLimit} times
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-fuchsia-100/50 pt-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-700">K-Tarot</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600 font-bold">
                        <strong className="text-indigo-600">{usageStatus.ktarotUsed}</strong> / {usageStatus.ktarotLimit} times
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 py-2 text-center border-t border-fuchsia-100/30">
                  <p className="text-[10px] text-fuchsia-600/80">
                    * If you exceed the limits, please contact the main office to request an increase.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Cloud Backup Section */}
        {branchInfo && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <i className="fas fa-cloud-upload-alt text-emerald-500"></i>
              Central Server Backup
            </h3>
            <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500">Last Backup</span>
                  <span className="text-sm font-bold text-slate-700">
                    {lastBackup 
                      ? new Date(lastBackup).toLocaleString('en-US', { 
                          month: '2-digit', day: '2-digit', 
                          hour: '2-digit', minute: '2-digit', hour12: false 
                        })
                      : 'No Backup History'}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs text-slate-500">Synced Records</span>
                  <span className="text-sm font-bold text-emerald-600">{lastBackupCount} record(s)</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-3">
                <i className="fas fa-info-circle"></i>
                <span>Auto-backup: Runs every 30 minutes while the app is active.</span>
              </div>

              <button
                onClick={handleManualBackup}
                disabled={isBackingUp}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  isBackingUp
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200'
                }`}
              >
                {isBackingUp ? (
                  <><i className="fas fa-spinner fa-spin"></i> Syncing...</>
                ) : (
                  <><i className="fas fa-cloud-upload-alt"></i> Sync Now</>
                )}
              </button>
              
              {backupResult && (
                <p className="mt-2 text-xs text-center font-medium text-slate-600">{backupResult}</p>
              )}
            </div>
          </div>
        )}

        {/* App Info */}
        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <div className="text-center text-xs text-slate-400">
            <strong className="text-slate-500">BTC 3Body AI Analyzer</strong> v{appVersion}
            <p className="mt-1 opacity-60">Powered by Gemini AI Vision</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
