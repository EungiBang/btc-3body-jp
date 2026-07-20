import React, { useState } from 'react';
import { PhysiognomyReport } from '../types';
import FaceFeedbackPanel from './FaceFeedbackPanel';

interface KFaceReportProps {
  report: PhysiognomyReport;
  imageSrc: string;
  onClose: () => void;
}

export default function KFaceReport({ report: rawReport, imageSrc, onClose }: KFaceReportProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(1.15);
  const userInfo = rawReport?.userInfo || { age: 0, gender: 'female' as const, name: '익명', memberType: 'new' as const };

  // AI 응답 데이터 누락 시 화면 다운(White Screen)을 방지하기 위한 안전한 기본값 병합
  // 문자열 강제 변환 헬퍼 (AI가 객체를 반환하여 React가 크래시되는 현상 방지)
  const safeString = (val: any, fallback: string) => {
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (val && typeof val === 'object') return JSON.stringify(val);
    return fallback;
  };

  const report = {
    ...rawReport,
    summary: safeString(rawReport?.summary, '관상 분석을 완료했습니다.'),
    score: typeof rawReport?.score === 'number' ? rawReport.score : Number(rawReport?.score) || 80,
    confidenceScore: typeof rawReport?.confidenceScore === 'number' ? rawReport.confidenceScore : Number(rawReport?.confidenceScore) || 85,
    wealthAndCareer: safeString(rawReport?.wealthAndCareer, '자신만의 강점을 살린다면 큰 성취가 기대됩니다.'),
    advice: safeString(rawReport?.advice, '긍정적인 마음가짐이 좋은 에너지를 만듭니다.'),
    animalMorphology: {
      type: safeString(rawReport?.animalMorphology?.type, '물형 분석 대기 중'),
      visualCharacteristics: safeString(rawReport?.animalMorphology?.visualCharacteristics, '특징을 분석하고 있습니다.'),
      geometricBasis: safeString(rawReport?.animalMorphology?.geometricBasis, '데이터 분석 중'),
      detailedAnalysis: safeString(rawReport?.animalMorphology?.detailedAnalysis, '상세 분석 데이터가 부족합니다.'),
      traits: Array.isArray(rawReport?.animalMorphology?.traits) ? rawReport.animalMorphology.traits.map((t: any) => safeString(t, '')) : [],
      animalMorphologyBlend: Array.isArray(rawReport?.animalMorphology?.animalMorphologyBlend) ? rawReport.animalMorphology.animalMorphologyBlend : []
    },
    traditionalAnalysis: {
      forehead: safeString(rawReport?.traditionalAnalysis?.forehead, '사고력이 뛰어나고 초년의 운기가 안정적입니다.'),
      eyebrows: safeString(rawReport?.traditionalAnalysis?.eyebrows, '주변 인맥이 탄탄하고 감정 조절 능력이 뛰어납니다.'),
      eyes: safeString(rawReport?.traditionalAnalysis?.eyes, '안목과 상황 판단력이 우수합니다.'),
      ears: safeString(rawReport?.traditionalAnalysis?.ears, '남의 말을 수용하는 지혜가 있으며 기초 체력이 우수합니다.'),
      nose: safeString(rawReport?.traditionalAnalysis?.nose, '자신의 주관이 뚜렷하며 재물 운용 능력이 좋습니다.'),
      cheekbones: safeString(rawReport?.traditionalAnalysis?.cheekbones, '목표를 향한 추진력이 강하고 사회적 위상을 갖출 잠재력이 있습니다.'),
      mouth: safeString(rawReport?.traditionalAnalysis?.mouth, '설득력이 뛰어나며 대인 관계가 원만합니다.'),
      jaw: safeString(rawReport?.traditionalAnalysis?.jaw, '기반이 튼튼하여 말년운이 좋고 부하운이 따릅니다.'),
      skin: safeString(rawReport?.traditionalAnalysis?.skin, '밝고 긍정적인 에너지를 띠고 있습니다.')
    },
    comprehensiveEvaluation: {
      health: safeString(rawReport?.comprehensiveEvaluation?.health, '타고난 체력이 좋으며, 꾸준한 관리가 필요한 시점입니다.'),
      wealthAndSuccess: safeString(rawReport?.comprehensiveEvaluation?.wealthAndSuccess, '자신만의 강점을 살린다면 큰 부와 명예를 얻을 수 있는 그릇입니다.'),
      loveAndRelationship: safeString(rawReport?.comprehensiveEvaluation?.loveAndRelationship, '사람을 끄는 매력이 있어 주변에 좋은 인연이 항상 따릅니다.'),
      threeBodySynthesis: safeString(rawReport?.comprehensiveEvaluation?.threeBodySynthesis, '물리적 강건함과 감성적 통찰, 그리고 지성적 판단이 조화롭게 에너지를 순환하고 있습니다.')
    },
    energy3Body7Code: {
      threeBodyAnalysis: safeString(rawReport?.energy3Body7Code?.threeBodyAnalysis, '에너지 밸런스가 안정적입니다.'),
      sevenCodeDetailed: Array.isArray(rawReport?.energy3Body7Code?.sevenCodeDetailed) ? rawReport.energy3Body7Code.sevenCodeDetailed : []
    },
    brightEnergy: {
      score: typeof rawReport?.brightEnergy?.score === 'number' ? rawReport.brightEnergy.score : Number(rawReport?.brightEnergy?.score) || 85,
      description: safeString(rawReport?.brightEnergy?.description, '밝고 긍정적인 오라를 뿜어냅니다.')
    },
    lifeStrategy: {
      career: safeString(rawReport?.lifeStrategy?.career, '꾸준한 노력으로 성취를 이룹니다.'),
      wealth: safeString(rawReport?.lifeStrategy?.wealth, '재물운이 점진적으로 상승합니다.')
    }
  };

  // 파라미터가 비어있거나, 배열이 아닌 문자열로 응답이 올 경우 map 함수 에러를 방지하기 위해 강제 배열화
  report.animalMorphology.traits = Array.isArray(report.animalMorphology.traits) ? report.animalMorphology.traits : [];
  report.animalMorphology.animalMorphologyBlend = Array.isArray(report.animalMorphology.animalMorphologyBlend) ? report.animalMorphology.animalMorphologyBlend : [];
  report.energy3Body7Code.sevenCodeDetailed = Array.isArray(report.energy3Body7Code.sevenCodeDetailed) ? report.energy3Body7Code.sevenCodeDetailed : [];

  const getAnimalEmoji = (type: string) => {
    if (!type) return '🐾';
    if (type.includes('호랑이')) return '🐅';
    if (type.includes('사자')) return '🦁';
    if (type.includes('여우')) return '🦊';
    if (type.includes('고양이')) return '🐈';
    if (type.includes('강아지') || type.includes('개')) return '🐕';
    if (type.includes('늑대')) return '🐺';
    if (type.includes('곰')) return '🐻';
    if (type.includes('토끼')) return '🐇';
    if (type.includes('사슴')) return '🦌';
    if (type.includes('말')) return '🐎';
    if (type.includes('원숭이')) return '🐒';
    if (type.includes('뱀')) return '🐍';
    if (type.includes('용')) return '🐉';
    if (type.includes('거북이')) return '🐢';
    if (type.includes('독수리') || type.includes('매')) return '🦅';
    if (type.includes('부엉이') || type.includes('올빼미')) return '🦉';
    if (type.includes('돼지')) return '🐖';
    if (type.includes('소')) return '🐂';
    if (type.includes('쥐')) return '🐁';
    if (type.includes('코끼리')) return '🐘';
    return '🐾';
  };
  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    const energyBlend = report.animalMorphology.animalMorphologyBlend?.map(b => `${b.type}(${b.matchPercentage}%)`).join(' + ') || report.animalMorphology.type;
    
    const shareText = `[🔮 AI 정밀 K-관상 분석 결과]

👤 대상자: ${report.userInfo?.name || '익명'}님
✨ 한줄 평: ${report.summary}

🦁 [나의 동물상 에너지]
▶ ${report.animalMorphology.type}
${report.animalMorphology.animalMorphologyBlend?.map(b => `  - ${b.type} (${b.matchPercentage}%)`).join('\n') || ''}
💡 주요 기질: ${report.animalMorphology.traits.map(t => `#${t}`).join(' ')}

💎 [종합 에너지 점수]
▶ ${report.score}점 / 100점

🎯 [성공 전략 포인트]
💼 커리어: ${report.lifeStrategy.career}
💰 금전운: ${report.lifeStrategy.wealth}

🌟 내면의 숨겨진 잠재력과 에너지를 지금 바로 확인해보세요!
자세한 결과 보기 👉 ${window.location.href}`;

    try {
      await navigator.clipboard.writeText(shareText);
      alert('결과가 클립보드에 복사되었습니다!\n원하는 카카오톡 채팅방에 붙여넣기(Paste) 해주세요.');
    } catch (err) {
      console.error('복사 실패:', err);
      alert('복사에 실패했습니다. 브라우저 설정을 확인해주세요.');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto animate-fade-in-up pb-20 relative">
      <div className="sticky top-4 right-4 z-50 flex justify-end print:hidden pointer-events-none" style={{ height: 0 }}>
         <div className="bg-slate-800/90 backdrop-blur shadow-lg border border-slate-700 rounded-full px-4 py-2 flex items-center gap-3 pointer-events-auto">
            <span className="text-xs font-bold text-slate-400">글자 크기</span>
            <button onClick={() => setZoomLevel(prev => Math.max(0.8, prev - 0.1))} className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-200 font-bold transition-colors">-</button>
            <span className="text-sm font-black text-fuchsia-400 w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
            <button onClick={() => setZoomLevel(prev => Math.min(1.8, prev + 0.1))} className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-200 font-bold transition-colors">+</button>
         </div>
      </div>
      
      <div className="space-y-8" style={{ zoom: zoomLevel }}>
      {/* Header Card */}
      <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700 shadow-2xl rounded-3xl p-8 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-fuchsia-500 via-indigo-500 to-cyan-500" />
        
        <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
          {/* Captured Image with Analysis VFX */}
          <div className="relative w-48 h-48 shrink-0 rounded-2xl overflow-hidden border border-slate-600 shadow-inner bg-slate-900">
            <img src={imageSrc} alt="Analyzed Face" className="w-full h-full object-cover" />
            
            {/* Tech Overlays */}
            <div className="absolute inset-0 bg-fuchsia-500/10 mix-blend-overlay" />
            <div className="absolute top-0 left-0 w-full h-12 bg-gradient-to-b from-transparent via-fuchsia-400/30 to-transparent animate-[scanPlane3D_3.5s_linear_infinite]" />
            <div className="absolute top-0 left-0 w-full h-[2px] bg-fuchsia-400 shadow-[0_0_8px_rgba(217,70,239,0.8)] animate-[scan_3s_ease-in-out_infinite]" />
            
            {/* Corner Brackets */}
            <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-fuchsia-500" />
            <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-fuchsia-500" />
            <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-fuchsia-500" />
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-fuchsia-500" />
          </div>

          <div className="flex-1 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-fuchsia-500/20 text-fuchsia-300 rounded-full text-sm font-semibold mb-3 border border-fuchsia-500/30">
              <i className="fas fa-id-badge text-fuchsia-300"></i>
              <span>분석 완료</span>
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">프리미엄 K-관상 분석</h2>
            <p className="text-fuchsia-300 font-medium text-lg mb-4">"{report.summary}"</p>
            
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-sm text-slate-400 font-medium">종합 에너지 점수</span>
                <span className="text-4xl font-black bg-gradient-to-br from-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
                  {report.score}<span className="text-2xl text-slate-600 font-normal">/100</span>
                </span>
              </div>
              <div className="w-px h-10 bg-slate-700" />
              <div className="flex flex-col flex-1 max-w-[200px]">
                <span className="text-sm text-slate-400 font-medium flex items-center gap-1.5 mb-1">
                  분석 신뢰도
                </span>
                <div className="flex items-center gap-3 w-full">
                  <span className="text-2xl font-bold text-white">
                    {report.confidenceScore || 85}<span className="text-sm text-slate-500 font-normal">%</span>
                  </span>
                  <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden border border-slate-600">
                    <div 
                      className={`h-full bg-gradient-to-r ${
                        (report.confidenceScore || 85) > 90 ? 'from-emerald-500 to-teal-400' :
                        (report.confidenceScore || 85) > 70 ? 'from-fuchsia-500 to-indigo-400' : 'from-amber-500 to-orange-400'
                      }`}
                      style={{ width: `${report.confidenceScore || 85}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-900/50 rounded-2xl p-6 text-left border border-slate-700">
          <div className="flex items-start gap-4">
            <i className="fas fa-sparkles text-2xl text-yellow-400 shrink-0 mt-1"></i>
            <div>
              <h3 className="text-white font-bold mb-2">AI 전문가의 조언</h3>
              <p className="text-slate-300 leading-relaxed">{report.advice}</p>
            </div>
          </div>
        </div>
      </div>

      {/* AI 학습 피드백 패널은 최하단으로 이동 */}

      {/* Animal Morphology section */}
      <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 space-y-8">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-bold mb-6 border border-indigo-500/30 uppercase tracking-widest">
              Animal Morphology Analysis
            </div>
            


            <h3 className="text-3xl font-black mb-4">
              {report.animalMorphology.type}
            </h3>

            {/* Visual Characteristics Description */}
            <div className="max-w-xl mx-auto px-6 py-4 bg-white/5 border border-white/10 rounded-2xl mb-8">
              <p className="text-indigo-100 text-sm md:text-base leading-relaxed italic">
                "{report.animalMorphology.visualCharacteristics}"
              </p>
            </div>
            
            {/* Morphology Blend Breakdown */}
            <div className="w-full max-w-xl mx-auto space-y-4 mb-10 bg-black/30 p-6 rounded-3xl border border-white/5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                  <i className="fas fa-wave-square text-indigo-300"></i>
                  Energy Blend
                </h4>
                <div className="text-[10px] text-slate-500 font-medium">TOP 3 MATCHES</div>
              </div>
              
              <div className="space-y-4">
                {report.animalMorphology.animalMorphologyBlend?.map((blend, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between items-end">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{blend.type}</span>
                        <span className="text-[10px] text-slate-400">· {blend.characteristic}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-fuchsia-400">{blend.matchPercentage}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${
                          idx === 0 ? 'from-fuchsia-500 to-indigo-500' : 
                          idx === 1 ? 'from-indigo-500 to-blue-500' : 'from-blue-500 to-cyan-500'
                        }`}
                        style={{ width: `${blend.matchPercentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Geometric Basis Badge */}
            <div className="mb-4 flex flex-col items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800 border border-slate-700 rounded-full">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Classification Basis</span>
                <span className="w-1 h-1 rounded-full bg-slate-500" />
                <span className="text-[11px] text-slate-300 font-medium">{report.animalMorphology.geometricBasis}</span>
              </div>
            </div>
            
            <p className="max-w-2xl text-slate-400 text-sm leading-relaxed mb-8 italic text-center">
              "귀하의 골격과 기하학적 비율은 {report.animalMorphology.type}의 기질을 강하게 띠고 있습니다."
            </p>
          </div>

          <div className="space-y-6">
            <div className="bg-black/30 rounded-2xl p-6 border border-white/5">
              <div className="flex items-center gap-2 text-fuchsia-400 font-bold text-lg mb-4">
                <i className="fas fa-brain"></i>
                물형 정밀 심층 분석 (Premium)
              </div>
              <p className="text-slate-300 leading-relaxed whitespace-pre-wrap text-sm">
                {report.animalMorphology.detailedAnalysis}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-lg border-b border-slate-700 pb-2">
                  <i className="fas fa-id-badge text-indigo-400"></i>
                  코드 및 기질 하이라이트
                </div>
                <div className="flex flex-wrap gap-2">
                  {report.animalMorphology.traits.map((trait, idx) => (
                    <span key={idx} className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm font-medium transition-colors hover:bg-slate-700 text-slate-200">
                      #{trait}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="space-y-4">
                 <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg border-b border-slate-700 pb-2">
                  <i className="fas fa-briefcase text-emerald-400"></i>
                  경제 및 사회적 잠재력
                </div>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {report.wealthAndCareer}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Traditional Physiognomy (이목구비 관상) section */}
      <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-700 pb-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
              <i className="fas fa-eye text-emerald-400"></i>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">이목구비 정밀 분석</h3>
              <p className="text-[11px] text-slate-400 uppercase tracking-widest">Traditional Face Features</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 이마 (Forehead) */}
            <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-700 hover:border-emerald-500/50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <i className="fas fa-brain text-emerald-400"></i>
                <h4 className="font-bold text-slate-200">이마 (초년과 지성)</h4>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                {report.traditionalAnalysis?.forehead || '사고력이 뛰어나고 초년의 운기가 안정적입니다.'}
              </p>
            </div>

            {/* 눈썹 (Eyebrows) */}
            <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-700 hover:border-emerald-500/50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <i className="fas fa-wave-square text-emerald-400"></i>
                <h4 className="font-bold text-slate-200">눈썹 (대인과 수명)</h4>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                {report.traditionalAnalysis?.eyebrows || '주변 인맥이 탄탄하고 감정 조절 능력이 뛰어납니다.'}
              </p>
            </div>

            {/* 눈 (Eyes) */}
            <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-700 hover:border-emerald-500/50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <i className="fas fa-eye text-emerald-400"></i>
                <h4 className="font-bold text-slate-200">눈 (안목과 통찰)</h4>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                {report.traditionalAnalysis?.eyes || '안목과 상황 판단력이 우수합니다.'}
              </p>
            </div>

            {/* 귀 (Ears) */}
            <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-700 hover:border-emerald-500/50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <i className="fas fa-deaf text-emerald-400"></i>
                <h4 className="font-bold text-slate-200">귀 (지혜와 생명력)</h4>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                {report.traditionalAnalysis?.ears || '남의 말을 수용하는 지혜가 있으며 기초 체력이 우수합니다.'}
              </p>
            </div>

            {/* 코 (Nose) */}
            <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-700 hover:border-emerald-500/50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <i className="fas fa-sort-amount-up text-emerald-400"></i>
                <h4 className="font-bold text-slate-200">코 (재물과 주관)</h4>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                {report.traditionalAnalysis?.nose || '자신의 주관이 뚜렷하며 재물 운용 능력이 좋습니다.'}
              </p>
            </div>

            {/* 광대뼈 (Cheekbones) */}
            <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-700 hover:border-emerald-500/50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <i className="fas fa-shield-alt text-emerald-400"></i>
                <h4 className="font-bold text-slate-200">광대 (권세와 투쟁)</h4>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                {report.traditionalAnalysis?.cheekbones || '목표를 향한 추진력이 강하고 사회적 위상을 갖출 잠재력이 있습니다.'}
              </p>
            </div>

            {/* 입 (Mouth) */}
            <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-700 hover:border-emerald-500/50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <i className="fas fa-comment-dots text-emerald-400"></i>
                <h4 className="font-bold text-slate-200">입 (언변과 포용력)</h4>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                {report.traditionalAnalysis?.mouth || '설득력이 뛰어나며 대인 관계가 원만합니다.'}
              </p>
            </div>

            {/* 턱 (Jaw) */}
            <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-700 hover:border-emerald-500/50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <i className="fas fa-anchor text-emerald-400"></i>
                <h4 className="font-bold text-slate-200">턱 (말년과 끈기)</h4>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                {report.traditionalAnalysis?.jaw || '기반이 튼튼하여 말년운이 좋고 부하운이 따릅니다.'}
              </p>
            </div>

            {/* 피부/기색 (Skin) */}
            <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-700 hover:border-emerald-500/50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <i className="fas fa-magic text-emerald-400"></i>
                <h4 className="font-bold text-slate-200">기색 (현재의 에너지)</h4>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                {report.traditionalAnalysis?.skin || '밝고 긍정적인 에너지를 띠고 있습니다.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 프리미엄 종합 평가 (Comprehensive Evaluation) */}
      <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 backdrop-blur-xl border border-indigo-500/30 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden mt-8 mb-8">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-fuchsia-500/20 rounded-full blur-3xl" />
        
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-3 border-b border-indigo-500/30 pb-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/50">
              <i className="fas fa-crown text-indigo-400"></i>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">프리미엄 종합 평가</h3>
              <p className="text-[11px] text-indigo-300 uppercase tracking-widest">Master's Comprehensive Evaluation</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 건강 (Health) */}
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-700 hover:border-indigo-500/50 transition-colors shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                  <i className="fas fa-heartbeat text-red-400"></i>
                </div>
                <h4 className="font-bold text-slate-100">건강 (Health)</h4>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                {report.comprehensiveEvaluation?.health || '타고난 체력이 좋으며, 꾸준한 관리가 필요한 시점입니다.'}
              </p>
            </div>

            {/* 부와 성공 (Wealth & Success) */}
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-700 hover:border-amber-500/50 transition-colors shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <i className="fas fa-coins text-amber-400"></i>
                </div>
                <h4 className="font-bold text-slate-100">사업과 성공 (Wealth)</h4>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                {report.comprehensiveEvaluation?.wealthAndSuccess || '자신만의 강점을 살린다면 큰 부와 명예를 얻을 수 있는 그릇입니다.'}
              </p>
            </div>

            {/* 연애와 관계 (Love & Relationship) */}
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-700 hover:border-pink-500/50 transition-colors shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center">
                  <i className="fas fa-kiss-wink-heart text-pink-400"></i>
                </div>
                <h4 className="font-bold text-slate-100">연애와 관계 (Love)</h4>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                {report.comprehensiveEvaluation?.loveAndRelationship || '사람을 끄는 매력이 있어 주변에 좋은 인연이 항상 따릅니다.'}
              </p>
            </div>
          </div>

          {/* 3바디 7코드 관점 총평 */}
          <div className="mt-6 bg-slate-900/80 p-6 rounded-2xl border border-indigo-500/50 shadow-inner">
            <div className="flex items-center gap-3 mb-3">
              <i className="fas fa-project-diagram text-indigo-400 text-xl"></i>
              <h4 className="text-lg font-bold text-indigo-300">3-Body 7-Code 마스터 총평</h4>
            </div>
            <p className="text-base text-slate-200 leading-relaxed italic border-l-4 border-indigo-500 pl-4">
              "{report.comprehensiveEvaluation?.threeBodySynthesis || '물리적 강건함과 감성적 통찰, 그리고 지성적 판단이 조화롭게 에너지를 순환하고 있습니다.'}"
            </p>
          </div>
        </div>
      </div>

      {/* Energy System section */}
      <div className="space-y-6">
        <h3 className="text-2xl font-bold text-white flex items-center gap-2">
          <i className="fas fa-bolt text-fuchsia-400"></i>
          에너지 정밀 분석: 3-Body & 7-Code
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 3-Body Section */}
          <div className="lg:col-span-4 space-y-4">
             <div className="bg-slate-800/80 backdrop-blur-xl text-white rounded-3xl p-6 shadow-xl border border-slate-700 h-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                    <i className="fas fa-brain text-indigo-400"></i>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">3-Body 통합 에너지</h4>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">Physical / Emotional / Mental</p>
                  </div>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed italic">
                  "{report.energy3Body7Code.threeBodyAnalysis}"
                </p>
                
                <div className="mt-8 space-y-4">
                  <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-700">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium text-slate-400 flex items-center gap-2">
                        <i className="fas fa-sparkles text-yellow-500"></i>
                        Bright Energy Score
                      </span>
                      <span className="text-lg font-bold text-yellow-400">{report.brightEnergy.score}%</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">{report.brightEnergy.description}</p>
                  </div>
                </div>
             </div>
          </div>

          {/* 7-Code Detailed Analysis Overlay */}
          <div className="lg:col-span-8">
            <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700 rounded-3xl p-8 shadow-xl relative overflow-hidden h-full">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <i className="fas fa-bolt text-9xl text-white"></i>
              </div>

              <div className="relative z-10 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <i className="fas fa-wave-square text-fuchsia-400"></i>
                    7-Code 에너지 핵심 상태 분석
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">ENERGY RESONANCE</span>
                </div>

                <div className="space-y-4">
                  {report.energy3Body7Code.sevenCodeDetailed.map((code, idx) => (
                    <div 
                      key={idx}
                      className="group bg-slate-900/50 rounded-2xl p-4 border border-slate-700 hover:border-fuchsia-500/50 transition-all hover:bg-slate-900/80"
                    >
                      <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex items-center gap-4 w-48 shrink-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-lg ${
                            code.state === 'Positive' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            code.state === 'Negative' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {code.score}%
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-200">Code {idx + 1}: {code.name}</div>
                            <div className="text-[10px] text-slate-500 font-medium uppercase">{code.region} · {code.bodyPart}</div>
                          </div>
                        </div>

                        <div className="flex-1 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              code.state === 'Positive' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              code.state === 'Negative' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {code.state === 'Positive' ? '긍정 에너지' : code.state === 'Negative' ? '정체/부정' : '중립적 상태'}
                            </span>
                            <div className="w-1/2 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                              <div 
                                className={`h-full ${
                                  code.state === 'Positive' ? 'bg-emerald-500' :
                                  code.state === 'Negative' ? 'bg-rose-500' : 'bg-amber-500'
                                }`}
                                style={{ width: `${code.score}%` }}
                              />
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            <span className="font-bold text-slate-300">현대적 해석:</span> {code.interpretation}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 전체 종합 총평 (3바디 7코드 이후) ── */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-fuchsia-950 backdrop-blur-xl border border-fuchsia-500/30 text-white rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-fuchsia-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
        
        <div className="relative z-10">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-fuchsia-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl shadow-fuchsia-500/30">
              <i className="fas fa-scroll text-2xl text-white" />
            </div>
            <span className="text-fuchsia-300 text-sm font-bold uppercase tracking-[0.3em]">Final Comprehensive Verdict</span>
            <h3 className="text-3xl font-black mt-3">🔮 AI 관상 종합 총평</h3>
            <p className="text-indigo-300/80 text-sm mt-2 font-medium">물형분석 · 이목구비 · 3바디 7코드 에너지를 모두 종합한 최종 평가</p>
          </div>

          {/* 한줄 총평 */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-6 text-center">
            <p className="text-xl font-bold text-fuchsia-200 leading-relaxed italic">
              "{report.summary}"
            </p>
          </div>

          {/* 핵심 종합 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-fuchsia-500/20 flex items-center justify-center">
                  <i className="fas fa-star text-fuchsia-400" />
                </div>
                <h4 className="font-bold text-slate-100">종합 에너지 점수</h4>
              </div>
              <div className="text-4xl font-black bg-gradient-to-r from-fuchsia-400 to-indigo-400 bg-clip-text text-transparent mb-2">
                {report.score}<span className="text-xl text-slate-600">/100</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 rounded-full" style={{ width: `${report.score}%` }} />
              </div>
            </div>

            <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <i className="fas fa-lightbulb text-amber-400" />
                </div>
                <h4 className="font-bold text-slate-100">맞춤 성공 전략</h4>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed mb-2"><strong className="text-amber-300">💼 커리어:</strong> {report.lifeStrategy.career}</p>
              <p className="text-sm text-slate-300 leading-relaxed"><strong className="text-emerald-300">💰 금전운:</strong> {report.lifeStrategy.wealth}</p>
            </div>
          </div>

          {/* 3바디 관점 종합 */}
          <div className="bg-slate-900/80 p-6 rounded-2xl border border-indigo-500/30">
            <div className="flex items-center gap-3 mb-3">
              <i className="fas fa-project-diagram text-indigo-400 text-xl" />
              <h4 className="text-lg font-bold text-indigo-300">3-Body 7-Code 최종 통합 평가</h4>
            </div>
            <p className="text-base text-slate-200 leading-relaxed italic border-l-4 border-fuchsia-500 pl-4">
              "{report.comprehensiveEvaluation?.threeBodySynthesis}"
            </p>
          </div>

          {/* AI 전문가 조언 */}
          <div className="mt-6 bg-gradient-to-r from-fuchsia-900/40 to-indigo-900/40 border border-fuchsia-500/20 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <i className="fas fa-sparkles text-2xl text-yellow-400 shrink-0 mt-1" />
              <div>
                <h4 className="text-white font-bold mb-2">AI 마스터의 최종 조언</h4>
                <p className="text-slate-300 leading-relaxed">{report.advice}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-4 pt-6">
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-6 py-3 bg-[#FEE500] hover:bg-[#FADA0A] text-[#191919] font-bold rounded-full transition-all shadow-sm active:scale-95"
        >
          <i className="fas fa-share-alt"></i>
          <span>카톡으로 결과 공유</span>
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-full transition-colors border border-slate-600 shadow-sm"
        >
          <i className="fas fa-print"></i>
          <span>인쇄하기</span>
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-6 py-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold rounded-full transition-colors shadow-lg shadow-fuchsia-500/30"
        >
          <i className="fas fa-redo"></i>
          <span>완료 / 다시하기</span>
        </button>
      </div>

      {/* AI 관상 정확도 피드백 패널 (최하단) */}
      <FaceFeedbackPanel userInfo={userInfo as any} report={report} />
      </div>
    </div>
  );
}
