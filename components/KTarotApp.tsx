import React, { useState, useEffect } from 'react';
import { getUsageStatus, UsageStatus, incrementUsage } from '../services/usageLimitService';
import { getRecordsLocally } from '../services/localDb';
import MasterSelection from './tarot/MasterSelection';
import StickShaker from './tarot/StickShaker';
import CharacterCard from './tarot/CharacterCard';
import TarotFeedbackPanel from './TarotFeedbackPanel';
import { CHEONBUGYEONG_CHARS } from '../constants/tarot';
import { analyzeTarot } from '../services/geminiService';
import { CheonbugyeongCharacter, MemberRecord, UserInfo } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface KTarotAppProps {
  onClose: () => void;
  onBack?: () => void;
}

type Step = 'welcome' | 'history_select' | 'info_input' | 'concern_input' | 'master_selection' | 'shuffling' | 'analyzing' | 'report';

const KTarotApp: React.FC<KTarotAppProps> = ({ onClose, onBack }) => {
  const [step, setStep] = useState<Step>('welcome');
  const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null);
  const [branchId, setBranchId] = useState<string>('');
  
  // 상태 변수들
  const [userInfo, setUserInfo] = useState<UserInfo>({ name: '', age: 30, gender: 'female', isAgreed: true });
  const [concern, setConcern] = useState<string>('');
  const [selectedMaster, setSelectedMaster] = useState<string>('');
  const [drawnCards, setDrawnCards] = useState<{ past: CheonbugyeongCharacter; present: CheonbugyeongCharacter; future: CheonbugyeongCharacter } | null>(null);
  const [reportData, setReportData] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1.15);
  
  const [historyRecords, setHistoryRecords] = useState<MemberRecord[]>([]);

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
    if (!branchId || !usageStatus) return true; // 데이터 로드 전이거나 로컬 환경
    if (usageStatus.ktarotUsed >= usageStatus.ktarotLimit) {
      alert(`일일 K-타로 분석 한도(${usageStatus.ktarotLimit}회)를 초과했습니다. 관리자에게 문의하세요.`);
      return false;
    }
    return true;
  };

  const handleSelectRecord = (record: MemberRecord) => {
    if (!checkUsage()) return;
    
    // 이전 기록에서 인적사항 가져오기
    if (record.report?.userInfo) {
      setUserInfo(record.report.userInfo);
    } else {
      // report에 userInfo가 없는 예전 기록일 경우 대비 (추정)
      setUserInfo({ name: record.name, age: record.age, gender: record.gender, isAgreed: true });
    }
    setStep('concern_input');
  };

  const handleStartNew = () => {
    if (!checkUsage()) return;
    setStep('info_input');
  };

  const drawRandomCards = () => {
    const shuffled = [...CHEONBUGYEONG_CHARS].sort(() => 0.5 - Math.random());
    return {
      past: shuffled[0],
      present: shuffled[1],
      future: shuffled[2]
    };
  };

  const handleMasterSelect = (masterId: string) => {
    let finalMasterId = masterId;
    if (masterId === 'random') {
      const masterKeys = ['masterKi', 'cheonIn', 'hwan', 'doRyeong', 'ara'];
      finalMasterId = masterKeys[Math.floor(Math.random() * masterKeys.length)];
    }
    
    setSelectedMaster(finalMasterId);
    setDrawnCards(drawRandomCards());
    setStep('shuffling');

    // 셔플 후 분석으로 이동
    setTimeout(() => {
      setStep('analyzing');
    }, 4000);
  };

  useEffect(() => {
    if (step === 'analyzing' && drawnCards && !isAnalyzing) {
      setIsAnalyzing(true);
      const performAnalysis = async () => {
        try {
          const result = await analyzeTarot(
            concern,
            userInfo.name,
            userInfo.age.toString(),
            userInfo.gender,
            drawnCards.past,
            drawnCards.present,
            drawnCards.future,
            selectedMaster
          );
          setReportData(result);
          
          if (branchId) {
            await incrementUsage(branchId, 'ktarot');
            setUsageStatus(prev => prev ? { ...prev, ktarotUsed: prev.ktarotUsed + 1 } : null);
          }
          setStep('report');
        } catch (error: any) {
          alert(`분석 중 오류가 발생했습니다: ${error.message}`);
          setStep('master_selection');
        } finally {
          setIsAnalyzing(false);
        }
      };
      performAnalysis();
    }
  }, [step, drawnCards, isAnalyzing, concern, userInfo, selectedMaster, branchId]);


  // 로컬 기록 불러오기 (history_select 진입 시)
  useEffect(() => {
    if (step === 'history_select') {
      const loadRecords = async () => {
        try {
          const records = await getRecordsLocally();
          setHistoryRecords(records.sort((a, b) => new Date(b.lastTestDate).getTime() - new Date(a.lastTestDate).getTime()));
        } catch (e) {
          console.error("Failed to load records", e);
        }
      };
      loadRecords();
    }
  }, [step]);


  return (
    <div className="w-full h-full bg-slate-900 text-white overflow-hidden flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center p-6 border-b border-white/10 bg-black/20 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose || onBack}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
          >
            <i className="fas fa-times text-slate-300"></i>
          </button>
          <div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-indigo-400">
              천부경 타로 (K-Tarot)
            </h1>
            <p className="text-xs text-slate-400">우주의 원리로 풀어내는 운명의 나침반</p>
            {usageStatus && (
              <div className="mt-1 flex items-center gap-2 text-[10px] font-bold">
                <span className={`px-2 py-0.5 rounded-full ${usageStatus.ktarotUsed >= usageStatus.ktarotLimit ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50' : 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/50'}`}>
                  오늘 잔여 횟수: {Math.max(0, usageStatus.ktarotLimit - usageStatus.ktarotUsed)} / {usageStatus.ktarotLimit}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {step !== 'welcome' && step !== 'report' && (
            <button
              onClick={() => setStep('welcome')}
              className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition-colors"
            >
              <i className="fas fa-home mr-2"></i>처음으로
            </button>
        )}
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col">
        {step === 'welcome' && (
          <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col justify-center gap-6">
            <div className="text-center mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-fuchsia-500/20 to-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_50px_rgba(147,51,234,0.3)] border border-fuchsia-500/30">
                <i className="fas fa-star-and-crescent text-4xl text-fuchsia-400"></i>
              </div>
              <h2 className="text-3xl font-black mb-4">천부경 타로</h2>
              <p className="text-slate-400">
                천부경 81자의 우주적 에너지를 통해<br />
                당신의 과거, 현재, 그리고 미래의 흐름을 읽어드립니다.
              </p>
            </div>

            <button 
              onClick={handleStartNew}
              className="group relative w-full p-6 bg-gradient-to-r from-fuchsia-600 to-indigo-600 rounded-3xl overflow-hidden shadow-[0_10px_30px_rgba(147,51,234,0.3)] hover:shadow-[0_15px_40px_rgba(147,51,234,0.5)] transition-all hover:-translate-y-1"
            >
              <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%] animate-[shimmer_3s_infinite]"></div>
              <div className="relative flex items-center gap-5">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                  <i className="fas fa-user-plus text-2xl text-white"></i>
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-xl font-bold text-white mb-1">직접 정보 입력하기</h3>
                  <p className="text-fuchsia-100/70 text-sm">신규 회원이거나 새로 정보를 입력하려면 선택하세요.</p>
                </div>
                <i className="fas fa-chevron-right text-white/50 group-hover:translate-x-2 transition-transform"></i>
              </div>
            </button>

            <button 
              onClick={() => {
                if (!checkUsage()) return;
                setStep('history_select');
              }}
              className="group relative w-full p-6 bg-slate-800 rounded-3xl overflow-hidden border border-slate-700 hover:border-indigo-500/50 shadow-lg hover:shadow-[0_10px_30px_rgba(99,102,241,0.2)] transition-all hover:-translate-y-1"
            >
              <div className="relative flex items-center gap-5">
                <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20">
                  <i className="fas fa-history text-2xl text-indigo-400"></i>
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-xl font-bold text-white mb-1">기존 회원 불러오기</h3>
                  <p className="text-slate-400 text-sm">과거 진단 기록의 인적사항을 재활용합니다.</p>
                </div>
                <i className="fas fa-chevron-right text-slate-500 group-hover:translate-x-2 transition-transform"></i>
              </div>
            </button>
          </div>
        )}

        {step === 'history_select' && (
          <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2">기존 기록 선택</h2>
                <p className="text-slate-400">누구의 운명을 상담하시겠습니까?</p>
              </div>
              <button onClick={() => setStep('welcome')} className="px-4 py-2 bg-slate-800 rounded-lg text-sm hover:bg-slate-700">뒤로가기</button>
            </div>
            
            <div className="flex-1 bg-slate-800/50 rounded-2xl border border-slate-700 overflow-y-auto p-4">
              {historyRecords.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <p>이전 진단 기록이 없습니다.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {historyRecords.map(record => (
                    <div 
                      key={record.id}
                      onClick={() => handleSelectRecord(record)}
                      className="p-4 bg-slate-800 border border-slate-600 rounded-xl hover:border-fuchsia-500 hover:shadow-[0_0_15px_rgba(147,51,234,0.3)] cursor-pointer transition-all flex items-center gap-4"
                    >
                      <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-xl text-slate-300">
                        {record.gender === 'male' ? <i className="fas fa-mars text-blue-400"></i> : <i className="fas fa-venus text-rose-400"></i>}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-lg">{record.name} <span className="text-sm font-normal text-slate-400">({record.age}세)</span></h4>
                        <p className="text-xs text-slate-500">최근 진단: {new Date(record.lastTestDate).toLocaleDateString()}</p>
                      </div>
                      <i className="fas fa-chevron-right text-slate-600"></i>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'info_input' && (
          <div className="max-w-md mx-auto w-full flex flex-col justify-center h-full">
            <h2 className="text-2xl font-bold mb-6 text-center">인적사항 입력</h2>
            <div className="space-y-4 bg-slate-800 p-6 rounded-2xl border border-slate-700">
              <div>
                <label className="block text-sm text-slate-400 mb-1">이름</label>
                <input 
                  type="text" 
                  value={userInfo.name} 
                  onChange={e => setUserInfo({...userInfo, name: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-fuchsia-500 text-white"
                  placeholder="이름을 입력하세요"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">나이</label>
                  <input 
                    type="number" 
                    value={userInfo.age} 
                    onChange={e => setUserInfo({...userInfo, age: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-fuchsia-500 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">성별</label>
                  <select 
                    value={userInfo.gender}
                    onChange={e => setUserInfo({...userInfo, gender: e.target.value as 'male'|'female'})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-fuchsia-500 text-white"
                  >
                    <option value="female">여성</option>
                    <option value="male">남성</option>
                  </select>
                </div>
              </div>
              <button 
                onClick={() => {
                  if (userInfo.name.trim() === '') return alert('이름을 입력해주세요.');
                  setStep('concern_input');
                }}
                className="w-full py-4 bg-gradient-to-r from-fuchsia-600 to-indigo-600 rounded-xl font-bold hover:shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all mt-4"
              >
                다음 단계로
              </button>
            </div>
          </div>
        )}

        {step === 'concern_input' && (
          <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col justify-center">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-black mb-4">어떤 고민이 있으신가요?</h2>
              <p className="text-slate-400">구체적으로 적어주실수록 타로 마스터가 더 정확한 해답을 드릴 수 있습니다.<br/><span className="text-fuchsia-300">({userInfo.name}님, {userInfo.age}세)</span></p>
            </div>
            
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-fuchsia-600 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <textarea
                value={concern}
                onChange={e => setConcern(e.target.value)}
                placeholder="예: 요즘 새로운 사업을 준비 중인데 앞으로의 금전운과 대인관계가 궁금합니다."
                className="relative w-full h-48 bg-slate-900 text-white border-2 border-slate-700 focus:border-fuchsia-500 rounded-2xl p-6 text-lg resize-none outline-none shadow-inner"
              />
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  if (concern.trim().length < 5) return alert('고민을 5자 이상 자세히 적어주세요.');
                  setStep('master_selection');
                }}
                className="px-8 py-4 bg-white text-slate-900 rounded-full font-bold shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105 transition-transform"
              >
                마스터 선택하기 <i className="fas fa-arrow-right ml-2"></i>
              </button>
            </div>
          </div>
        )}

        {step === 'master_selection' && (
          <div className="flex-1 flex items-center">
             <MasterSelection onMasterSelect={handleMasterSelect} />
          </div>
        )}

        {step === 'shuffling' && (
          <div className="flex-1">
             <StickShaker mode="SHUFFLING" />
          </div>
        )}

        {step === 'analyzing' && drawnCards && (
          <div className="flex-1 flex flex-col items-center justify-center">
             <StickShaker mode="INTERPRETING" />
             
             {/* 뽑힌 카드 미리보기 */}
             <div className="absolute bottom-10 flex gap-4 md:gap-8 justify-center w-full px-4 scale-75 md:scale-100 origin-bottom animate-[slide-up_1s_ease-out]">
                <CharacterCard character={drawnCards.past} label="과거" />
                <CharacterCard character={drawnCards.present} label="현재" />
                <CharacterCard character={drawnCards.future} label="미래" />
             </div>
          </div>
        )}

        {step === 'report' && drawnCards && (
          <div className="max-w-5xl mx-auto w-full animate-fade-in flex flex-col gap-6 relative">
            
            <div className="sticky top-0 z-50 flex justify-end print:hidden pointer-events-none mb-[-1rem]">
               <div className="bg-slate-800/90 backdrop-blur shadow-lg border border-slate-700 rounded-full px-4 py-2 flex items-center gap-3 pointer-events-auto">
                  <span className="text-xs font-bold text-slate-400">글자 크기</span>
                  <button onClick={() => setZoomLevel(prev => Math.max(0.8, prev - 0.1))} className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-200 font-bold transition-colors">-</button>
                  <span className="text-sm font-black text-fuchsia-400 w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
                  <button onClick={() => setZoomLevel(prev => Math.min(1.8, prev + 0.1))} className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-200 font-bold transition-colors">+</button>
               </div>
            </div>
            
            <div className="flex flex-col gap-6 pb-20" style={{ zoom: zoomLevel }}>
            {/* 리포트 상단 영역 */}
            <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 md:p-8 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
               
               <h2 className="text-3xl font-black mb-2 relative z-10 text-white">천부경 타로 해석서</h2>
               <p className="text-fuchsia-300 relative z-10 mb-8">{userInfo.name}님의 고민: "{concern}"</p>
               
               {/* 카드 결과 영역 */}
               <div className="flex flex-wrap md:flex-nowrap justify-center gap-6 md:gap-12 relative z-10">
                  <CharacterCard character={drawnCards.past} label="과거 에너지" />
                  <CharacterCard character={drawnCards.present} label="현재 상황" />
                  <CharacterCard character={drawnCards.future} label="미래의 흐름" />
               </div>
            </div>

            {/* 마크다운 리포트 영역 */}
            <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-3xl p-8 md:p-12 shadow-2xl markdown-tarot">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {reportData}
                </ReactMarkdown>
            </div>

            {/* AI 학습 피드백 패널 */}
            {userInfo && (
              <TarotFeedbackPanel
                userInfo={userInfo}
                concern={concern}
                cards={drawnCards}
                reportData={reportData}
              />
            )}

            {/* 하단 네비게이션 */}
            <div className="flex justify-center mt-4 mb-10 pb-10">
               <button 
                  onClick={() => setStep('welcome')}
                  className="px-8 py-4 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 font-bold transition-colors"
                >
                  <i className="fas fa-home mr-2"></i>홈으로 돌아가기
               </button>
            </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default KTarotApp;
