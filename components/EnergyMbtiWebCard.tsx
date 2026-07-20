// 웹 환경에서 에너지 MBTI 분석 결과와 16가지 유형 도감을 카드 형태로 제공하는 리액트 컴포넌트

import React, { useState } from 'react';
import { ENERGY_MBTI_DATA, EnergyMbtiDetail } from '@shared/ai/scoring/mbti';

const characterImages: Record<string, string> = {
  peag_aura_monarch: './assets/images/characters/peag_aura_monarch.png',
  peaf_exhausted_bulldozer: './assets/images/characters/peaf_exhausted_bulldozer.png',
  pecg_playful_alchemist: './assets/images/characters/pecg_playful_alchemist.png',
  pecf_wandering_dancer: './assets/images/characters/pecf_wandering_dancer.png',
  psag_silent_sentinel: './assets/images/characters/psag_silent_sentinel.png',
  psaf_lonely_guardian: './assets/images/characters/psaf_lonely_guardian.png',
  pscg_master_artisan: './assets/images/characters/pscg_master_artisan.png',
  pscf_blocked_stoic: './assets/images/characters/pscf_blocked_stoic.png',
  meag_wise_strategist: './assets/images/characters/meag_wise_strategist.png',
  meaf_overheated_thinker: './assets/images/characters/meaf_overheated_thinker.png',
  mecg_cosmic_muse: './assets/images/characters/mecg_cosmic_muse.png',
  mecf_tempest_wizard: './assets/images/characters/mecf_tempest_wizard.png',
  msag_stoic_analyst: './assets/images/characters/msag_stoic_analyst.png',
  msaf_anxious_scholar: './assets/images/characters/msaf_anxious_scholar.png',
  mscg_zen_master: './assets/images/characters/mscg_zen_master.png',
  mscf_ethereal_mystic: './assets/images/characters/mscf_ethereal_mystic.png',
};

interface EnergyMbtiWebCardProps {
  mbtiCode: string;
  testDate?: string;
  isSimpleView?: boolean;
  onClose?: () => void;
}

export const EnergyMbtiWebCard: React.FC<EnergyMbtiWebCardProps> = ({
  mbtiCode,
  testDate,
  isSimpleView = false,
  onClose,
}) => {
  const [selectedCode, setSelectedCode] = useState<string>(mbtiCode);
  const [viewMode, setViewMode] = useState<'detail' | 'list'>('detail');

  const cardData: EnergyMbtiDetail | undefined = ENERGY_MBTI_DATA[selectedCode];

  if (!cardData) {
    return null;
  }

  const imageSource = characterImages[cardData.imageKey];

  // 간단 뷰 레이아웃
  if (isSimpleView) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center gap-6 max-w-2xl mx-auto">
        {/* Glow Effect */}
        <div 
          className="absolute -right-20 -top-20 w-40 h-40 rounded-full blur-[80px] opacity-40 pointer-events-none"
          style={{ backgroundColor: cardData.primaryColors[0] || '#6c5ce7' }}
        />
        
        {/* 캐릭터 이미지 영역 */}
        <div className="w-40 h-40 bg-slate-950/80 rounded-2xl flex items-center justify-center p-3 border border-slate-800 shrink-0 relative z-10">
          {imageSource ? (
            <img src={imageSource} alt={cardData.name} className="w-full h-full object-contain" />
          ) : (
            <div 
              className="w-24 h-24 rounded-full blur-sm opacity-60"
              style={{ backgroundColor: cardData.primaryColors[0] }}
            />
          )}
        </div>

        {/* 텍스트 정보 영역 */}
        <div className="flex-1 text-left relative z-10 w-full">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="bg-indigo-500/10 text-indigo-400 text-xs font-black border border-indigo-500/20 px-3 py-1 rounded-lg">
              {cardData.code}
            </span>
            {testDate && (
              <span className="text-[10px] text-slate-500 font-bold">
                Measured: {testDate}
              </span>
            )}
          </div>
          <h4 className="text-white text-2xl font-black mb-1">{cardData.name}</h4>
          <p className="text-slate-400 text-xs font-medium mb-3">{cardData.englishName}</p>
          <div className="bg-slate-950/50 border border-slate-850 rounded-xl p-3.5">
            <p className="text-emerald-400 text-sm font-bold leading-relaxed">
              "{cardData.summary}"
            </p>
            <p className="text-slate-400 text-xs font-medium mt-1 leading-relaxed">
              * Detailed temperament analysis and daily energy guide will be unlocked during professional counseling (detailed report).
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 상세 뷰 레이아웃
  return (
    <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden max-w-2xl mx-auto flex flex-col text-slate-800">
      {viewMode === 'detail' ? (
        <div className="flex flex-col">
          {/* 상단 뱃지 라인 */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <span className="text-indigo-600 text-xs font-black tracking-widest uppercase">
              🔮 Energy Type Snapshot
            </span>
            <span className="bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-1 rounded-full border border-indigo-100">
              {selectedCode === mbtiCode && testDate ? `Measured: ${testDate}` : 'Encyclopedia View'}
            </span>
          </div>

          {/* 캐릭터 이미지 영역 */}
          <div className="w-full bg-slate-50 py-8 flex items-center justify-center border-b border-slate-100">
            <div className="w-56 h-56 flex items-center justify-center">
              {imageSource ? (
                <img src={imageSource} alt={cardData.name} className="w-full h-full object-contain" />
              ) : (
                <div 
                  className="w-36 h-36 rounded-full blur-md opacity-50"
                  style={{ backgroundColor: cardData.primaryColors[0] }}
                />
              )}
            </div>
          </div>

          {/* 본문 정보 패널 */}
          <div className="p-6 text-left">
            <div className="flex justify-between items-center mb-4">
              <span className="bg-indigo-50 border border-indigo-100 text-indigo-600 text-sm font-black px-3.5 py-1 rounded-xl">
                {cardData.code}
              </span>
              <div className="flex gap-1.5">
                {cardData.primaryColors.map((color, index) => (
                  <span 
                    key={index} 
                    className="w-2.5 h-2.5 rounded-full border border-black/10 inline-block" 
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <h3 className="text-slate-900 text-3xl font-black tracking-tight">{cardData.name}</h3>
            <p className="text-slate-400 text-sm font-medium mt-1 mb-5">{cardData.englishName}</p>

            <p className="text-emerald-600 text-lg font-black leading-snug mb-3">"{cardData.summary}"</p>
            <p className="text-slate-600 text-sm leading-relaxed mb-6 font-medium">{cardData.description}</p>

            <div className="space-y-4 mb-6">
              {/* 과학적 분석 */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <h5 className="text-slate-900 font-black text-sm mb-2 flex items-center gap-1.5">
                  <span>🧬</span> 3-Body & 7-Code Analysis
                </h5>
                <p className="text-slate-600 text-xs font-medium leading-relaxed">{cardData.threeBodyAnalysis}</p>
              </div>

              {/* 에너지 흐름 조언 */}
              <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/50">
                <h5 className="text-slate-900 font-black text-sm mb-2 flex items-center gap-1.5">
                  <span>🃏</span> Daily Energy Fortune
                </h5>
                <p className="text-slate-600 text-xs font-medium leading-relaxed">{cardData.energyFortune}</p>
              </div>

              {/* 럭키 처방전 */}
              <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100/50">
                <h5 className="text-slate-900 font-black text-sm mb-2 flex items-center gap-1.5">
                  <span>⚡</span> Lucky Energy Prescription
                </h5>
                <p className="text-slate-650 text-xs font-black leading-relaxed">
                  💡 Suggested Carry & Training: <span className="text-emerald-700 font-bold">{cardData.luckyPrescription}</span>
                </p>
              </div>
            </div>

            {/* 도감 탐색 메뉴 */}
            <div className="flex gap-3 mt-6 border-t border-slate-100 pt-6">
              {selectedCode !== mbtiCode ? (
                <button
                  onClick={() => setSelectedCode(mbtiCode)}
                  className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-3.5 rounded-2xl transition-all text-sm border border-emerald-200"
                >
                  👤 View My Energy Type
                </button>
              ) : (
                <button
                  onClick={() => setViewMode('list')}
                  className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-3.5 rounded-2xl transition-all text-sm border border-indigo-200"
                >
                  📖 16 Temperament Encyclopedia
                </button>
              )}
            </div>

            {onClose && (
              <button 
                onClick={onClose}
                className="w-full mt-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3.5 rounded-2xl transition-all text-sm border border-slate-200"
              >
                Close Report
              </button>
            )}
          </div>
        </div>
      ) : (
        /* 백과도감 격자 목록 뷰 */
        <div className="p-6 flex flex-col h-[75vh]">
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-100">
            <h3 className="text-slate-900 font-black text-lg">📖 16 Energy Types Encyclopedia</h3>
            <button
              onClick={() => setViewMode('detail')}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl border border-slate-200 text-xs transition-colors"
            >
              Back to Detail →
            </button>
          </div>
          
          <p className="text-slate-550 text-xs font-medium leading-relaxed mb-5">
            Feel free to browse all energy temperaments and personalized 3-body guidelines.
          </p>

          <div className="flex-1 overflow-y-auto pr-1 space-y-4 max-h-[50vh] custom-scrollbar grid grid-cols-2 gap-3 pb-4">
            {Object.values(ENERGY_MBTI_DATA).map((item) => {
              const itemImage = characterImages[item.imageKey];
              const isMyType = item.code === mbtiCode;
              
              return (
                <div
                  key={item.code}
                  onClick={() => {
                    setSelectedCode(item.code);
                    setViewMode('detail');
                  }}
                  className={`bg-slate-50 hover:bg-indigo-50/40 border rounded-2xl p-4 flex flex-col items-center transition-all cursor-pointer ${
                    isMyType ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-indigo-200'
                  }`}
                >
                  <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden mb-3 border border-slate-200 relative">
                    {itemImage ? (
                      <img src={itemImage} alt={item.name} className="w-[85%] h-[85%] object-contain" />
                    ) : (
                      <div className="w-12 h-12 rounded-full opacity-60" style={{ backgroundColor: item.primaryColors[0] }} />
                    )}
                    {isMyType && (
                      <span className="absolute bottom-0 inset-x-0 bg-emerald-500 text-white text-[8px] font-black text-center py-0.5">
                        My Type
                      </span>
                    )}
                  </div>
                  <span className="text-indigo-600 font-black text-sm">{item.code}</span>
                  <span className="text-slate-700 font-bold text-xs mt-1 text-center truncate w-full">{item.name}</span>
                </div>
              );
            })}
          </div>

          {onClose && (
            <button 
              onClick={onClose}
              className="w-full mt-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3.5 rounded-2xl transition-all text-sm border border-slate-200 shrink-0"
            >
              Close Report
            </button>
          )}
        </div>
      )}
    </div>
  );
};
export default EnergyMbtiWebCard;
