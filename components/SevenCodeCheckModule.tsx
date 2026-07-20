// 7코드 건강 점검 모듈 — V5.0.8 원본 키워드 56개 전체 사용, 5페이지(11-11-11-11-12) 균등 분할
import React, { useState, useEffect } from 'react';
import { speak } from '../services/ttsService';

interface KeywordItem {
  keyword: string;
  keywordEn: string;
  codes: number[];
}

// V5.0.8 원본 56개 키워드 + 8개 긍정 키워드 영문 매핑
const ALL_KEYWORDS: KeywordItem[] = [
  // --- 1페이지 분량 (13개) ---
  { keyword: "Fear", keywordEn: "Fear", codes: [1] },
  { keyword: "Bowel Discomfort", keywordEn: "Bowel Discomfort", codes: [1] },
  { keyword: "Heavy Lower Body", keywordEn: "Heavy Lower Body", codes: [1] },
  { keyword: "Stability", keywordEn: "Stability", codes: [1] }, // [긍정 1]
  { keyword: "Control Issues", keywordEn: "Control Issues", codes: [1, 3] },
  { keyword: "Anger", keywordEn: "Anger", codes: [1, 3] },
  { keyword: "Food Cravings", keywordEn: "Food Cravings", codes: [1, 2] },
  { keyword: "Low Vitality", keywordEn: "Low Vitality", codes: [1, 2] },
  { keyword: "Joy", keywordEn: "Joy", codes: [2] }, // [긍정 2]
  { keyword: "Defensive Posture", keywordEn: "Defensive Posture", codes: [1, 2, 3] },
  { keyword: "Pelvic Discomfort", keywordEn: "Pelvic Discomfort", codes: [1, 2, 3] },
  { keyword: "Anxiety", keywordEn: "Anxiety", codes: [1, 2, 3] },
  { keyword: "Resentment", keywordEn: "Resentment", codes: [1, 3, 5] },
  
  // --- 2페이지 분량 (13개) ---
  { keyword: "Chronic Fatigue", keywordEn: "Chronic Fatigue", codes: [1, 3, 5] },
  { keyword: "Fulfillment", keywordEn: "Fulfillment", codes: [3] }, // [긍정 3]
  { keyword: "Heavy Responsibility", keywordEn: "Heavy Responsibility", codes: [1, 3, 5] },
  { keyword: "Loneliness", keywordEn: "Loneliness", codes: [1, 2, 4] },
  { keyword: "Relationship Clinging", keywordEn: "Relationship Clinging", codes: [1, 2, 4] },
  { keyword: "Cold Lower Abdomen", keywordEn: "Cold Lower Abdomen", codes: [1, 2, 4] },
  { keyword: "Financial Stress", keywordEn: "Financial Stress", codes: [2] },
  { keyword: "Positivity", keywordEn: "Positivity", codes: [5] }, // [긍정 4]
  { keyword: "Shame / Guilt", keywordEn: "Shame / Guilt", codes: [2] },
  { keyword: "Poor Abdominal Circulation", keywordEn: "Poor Abdominal Circulation", codes: [2] },
  { keyword: "Emotional Exhaustion", keywordEn: "Emotional Exhaustion", codes: [2, 4] },
  { keyword: "Jealousy", keywordEn: "Jealousy", codes: [2, 4] },
  { keyword: "Frustration", keywordEn: "Frustration", codes: [2, 4, 6] },
  
  // --- 3페이지 분량 (13개) ---
  { keyword: "Excessive Empathy", keywordEn: "Excessive Empathy", codes: [2, 4, 6] },
  { keyword: "Love", keywordEn: "Love", codes: [4] }, // [긍정 5]
  { keyword: "Grudge / Blaming", keywordEn: "Grudge / Blaming", codes: [2, 4, 6] },
  { keyword: "Bloating / Indigestion", keywordEn: "Bloating / Indigestion", codes: [3] },
  { keyword: "Competitiveness", keywordEn: "Competitiveness", codes: [3] },
  { keyword: "Lack of Motivation", keywordEn: "Lack of Motivation", codes: [3] },
  { keyword: "Authoritative Attitude", keywordEn: "Authoritative Attitude", codes: [3, 5] },
  { keyword: "Happiness", keywordEn: "Happiness", codes: [4] }, // [긍정 6]
  { keyword: "Suppression", keywordEn: "Suppression", codes: [3, 5] },
  { keyword: "Lethargy / Helplessness", keywordEn: "Lethargy / Helplessness", codes: [3, 5, 7] },
  { keyword: "Inferiority Complex", keywordEn: "Inferiority Complex", codes: [3, 5, 7] },
  { keyword: "Difficulty Expressing", keywordEn: "Difficulty Expressing", codes: [3, 5, 7] },
  { keyword: "Chest Tightness", keywordEn: "Chest Tightness", codes: [4] },
  
  // --- 4페이지 분량 (13개) ---
  { keyword: "Chest Discomfort", keywordEn: "Chest Discomfort", codes: [4] },
  { keyword: "Serenity", keywordEn: "Serenity", codes: [6] }, // [긍정 7]
  { keyword: "Emotional Hurt", keywordEn: "Emotional Hurt", codes: [4] },
  { keyword: "Cynicism", keywordEn: "Cynicism", codes: [4, 6] },
  { keyword: "Misunderstandings", keywordEn: "Misunderstandings", codes: [4, 6] },
  { keyword: "Sleep Disturbances", keywordEn: "Sleep Disturbances", codes: [4, 6, 7] },
  { keyword: "Derealization", keywordEn: "Derealization", codes: [4, 6, 7] },
  { keyword: "Low Mood / Gloom", keywordEn: "Low Mood / Gloom", codes: [4, 6, 7] },
  { keyword: "Shyness", keywordEn: "Shyness", codes: [5] },
  { keyword: "Voice Strain", keywordEn: "Voice Strain", codes: [5] },
  { keyword: "Stiff Neck / Throat", keywordEn: "Stiff Neck / Throat", codes: [5] },
  { keyword: "Confusion", keywordEn: "Confusion", codes: [5, 7] },
  { keyword: "Ignorance / Unawareness", keywordEn: "Ignorance / Unawareness", codes: [5, 7] },
  
  // --- 5페이지 분량 (12개) ---
  { keyword: "Heavy Head", keywordEn: "Heavy Head", codes: [5, 6, 7] },
  { keyword: "Information Overload", keywordEn: "Information Overload", codes: [5, 6, 7] },
  { keyword: "Gratitude", keywordEn: "Gratitude", codes: [7] }, // [긍정 8]
  { keyword: "Tension / Tightness", keywordEn: "Tension / Tightness", codes: [5, 6, 7] },
  { keyword: "Eye Strain", keywordEn: "Eye Strain", codes: [6] },
  { keyword: "Hypersensitivity", keywordEn: "Hypersensitivity", codes: [6] },
  { keyword: "Lack of Focus", keywordEn: "Lack of Focus", codes: [6] },
  { keyword: "Block in Creativity", keywordEn: "Block in Creativity", codes: [6, 7] },
  { keyword: "Disorientation", keywordEn: "Disorientation", codes: [6, 7] },
  { keyword: "Sense of Isolation", keywordEn: "Sense of Isolation", codes: [7] },
  { keyword: "Loss of Presence", keywordEn: "Loss of Presence", codes: [7] },
  { keyword: "Weakened Vital Energy", keywordEn: "Weakened Vital Energy", codes: [7] },
];

const PAGE_COLORS = [
  'from-red-500 to-rose-500',
  'from-orange-500 to-amber-500',
  'from-yellow-500 to-lime-500',
  'from-emerald-500 to-teal-500',
  'from-indigo-500 to-purple-500'
];

// 64개를 13개씩, 마지막은 12개로 분할 (13 * 4 + 12 = 64)
const PAGES = [
  { color: PAGE_COLORS[0], keywords: ALL_KEYWORDS.slice(0, 13) },
  { color: PAGE_COLORS[1], keywords: ALL_KEYWORDS.slice(13, 26) },
  { color: PAGE_COLORS[2], keywords: ALL_KEYWORDS.slice(26, 39) },
  { color: PAGE_COLORS[3], keywords: ALL_KEYWORDS.slice(39, 52) },
  { color: PAGE_COLORS[4], keywords: ALL_KEYWORDS.slice(52, 64) },
];

interface SevenCodeCheckModuleProps {
  onComplete: (keywords: string[], weakestCode: number) => void;
}

const SevenCodeCheckModule: React.FC<SevenCodeCheckModuleProps> = ({ onComplete }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);

  useEffect(() => {
    speak("This is the 7-code health check. Please select all items that apply to you.");
  }, []);

  const toggleKeyword = (keyword: string) => {
    setSelectedKeywords(prev =>
      prev.includes(keyword) ? prev.filter(k => k !== keyword) : [...prev, keyword]
    );
  };

  const calculateWeakestCode = () => {
    // 각 코드별 penalty 누적
    const penaltyScores = [0, 0, 0, 0, 0, 0, 0];
    selectedKeywords.forEach(kwStr => {
      const found = ALL_KEYWORDS.find(k => k.keyword === kwStr);
      if (found) {
        found.codes.forEach(code => {
          if (code >= 1 && code <= 7) penaltyScores[code - 1] += 1;
        });
      }
    });

    // 코드별 총 매핑 키워드 수로 정규화하여 분포 편향 제거
    const codeWeights = [0, 0, 0, 0, 0, 0, 0];
    ALL_KEYWORDS.forEach(k => {
      k.codes.forEach(code => {
        if (code >= 1 && code <= 7) codeWeights[code - 1] += 1;
      });
    });

    const normalizedScores = penaltyScores.map((score, idx) =>
      codeWeights[idx] > 0 ? score / codeWeights[idx] : 0
    );

    // 정규화된 점수가 가장 높은 코드가 weakest. 동점 시 중간 코드(4) 부터 탐색
    let maxScore = -1;
    let weakestIndex = 3; // 기본값: 4코드(가슴, 중간 코드)
    const searchOrder = [3, 2, 4, 1, 5, 0, 6]; // 4→3→5→2→6→1→7 순서 (중앙 우선)
    searchOrder.forEach(idx => {
      if (normalizedScores[idx] > maxScore) {
        maxScore = normalizedScores[idx];
        weakestIndex = idx;
      }
    });

    return weakestIndex + 1;
  };

  const handleNext = () => {
    if (currentPage < PAGES.length - 1) {
      setCurrentPage(prev => prev + 1);
    } else {
      const weakestCode = calculateWeakestCode();
      const finalKeywords = selectedKeywords.length > 0 ? selectedKeywords : ["No specific symptoms"];
      onComplete(finalKeywords, weakestCode);
    }
  };

  const handlePrev = () => {
    if (currentPage > 0) setCurrentPage(prev => prev - 1);
  };

  const page = PAGES[currentPage];
  const isLastPage = currentPage === PAGES.length - 1;
  const pageSelectedCount = page.keywords.filter(k => selectedKeywords.includes(k.keyword)).length;

  return (
    <div className="flex flex-col items-center h-[calc(100vh-80px)] p-4 mx-auto max-w-5xl transition-all">
      {/* 헤더 영역 */}
      <div className="text-center mb-3 shrink-0">
        <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">7-Code Health Checklist</h2>
        <p className="text-gray-300 text-base sm:text-lg font-bold">
          Please select items corresponding to your physical or emotional discomforts.
        </p>
        <p className="text-gray-400 text-sm sm:text-base font-medium mt-1">
          Select all items that apply to you. ({currentPage + 1} / {PAGES.length} Pages)
        </p>
      </div>

      {/* 진행 바 */}
      <div className="w-full h-3 bg-gray-800 rounded-full mb-4 shrink-0">
        <div 
          className={`h-full bg-gradient-to-r ${PAGES[currentPage].color} rounded-full transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.6)]`}
          style={{ width: `${((currentPage + 1) / PAGES.length) * 100}%` }}
        />
      </div>

      {/* 키워드 그리드 - 반응형 크기 및 자동 줄바꿈 조정 */}
      <div className="grid grid-cols-3 md:grid-cols-4 gap-2 w-full flex-1 min-h-0 content-center overflow-y-auto py-2">
        {page.keywords.map(item => {
          const isSelected = selectedKeywords.includes(item.keyword);
          return (
            <button
              key={item.keyword}
              onClick={() => toggleKeyword(item.keyword)}
              className={`p-3 sm:p-4 md:p-5 min-h-[75px] rounded-2xl text-sm sm:text-base md:text-lg lg:text-xl font-black transition-all duration-200 transform hover:scale-[1.02] active:scale-95 leading-normal flex items-center justify-center text-center break-words whitespace-normal ${
                isSelected 
                  ? `bg-gradient-to-r ${page.color} text-white shadow-[0_0_30px_rgba(59,130,246,0.4)] border-2 border-white/30` 
                  : 'bg-gray-800 text-gray-200 hover:bg-gray-700 border-2 border-gray-700 hover:border-gray-500 shadow-lg'
              }`}
            >
              <span className="w-full">{item.keyword}</span>
            </button>
          );
        })}
      </div>

      {/* 네비게이션 버튼 - 항상 하단에 고정 */}
      <div className="flex justify-between w-full max-w-2xl mt-4 pb-2 shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-slate-500 text-sm font-medium">
            This Page: <span className="text-white font-black text-base">{pageSelectedCount} selected</span>
          </span>
          <span className="text-slate-500 text-sm font-medium">
            Total Selected: <span className="text-amber-400 font-black text-base">{selectedKeywords.length} selected</span>
          </span>
        </div>
      </div>
      <div className="flex justify-between w-full max-w-2xl gap-3 pb-2 shrink-0">
        {currentPage > 0 && (
          <button onClick={handlePrev} className="flex-1 px-6 py-4 rounded-2xl text-xl font-bold bg-gray-700 text-white hover:bg-gray-600 transition-colors shadow-lg">
            <i className="fas fa-arrow-left mr-2" /> Prev
          </button>
        )}
        <button
          onClick={handleNext}
          className={`flex-1 px-10 py-4 rounded-2xl text-xl font-black transition-all shadow-xl hover:shadow-blue-500/40 active:scale-95 ${
            isLastPage
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white'
              : `bg-gradient-to-r ${page.color} text-white`
          }`}
        >
          {isLastPage ? <><i className="fas fa-check-circle mr-2" /> Complete</> : <>Next <i className="fas fa-arrow-right ml-2" /></>}
        </button>
      </div>
    </div>
  );
};

export default SevenCodeCheckModule;
