// 7코드 건강 점검 모듈 — V5.0.8 원본 키워드 56개 전체 사용, 5페이지(11-11-11-11-12) 균등 분할
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { speak } from '../services/ttsService';

interface KeywordItem {
  keyword: string;
  keywordEn: string;
  keywordJa: string;
  codes: number[];
}

// V5.0.8 원본 56개 키워드 + 8개 긍정 키워드 영문 매핑
const ALL_KEYWORDS: KeywordItem[] = [
  // --- 1페이지 분량 (13개) ---
  { keyword: "Fear", keywordEn: "Fear", keywordJa: "恐怖", codes: [1] },
  { keyword: "Bowel Discomfort", keywordEn: "Bowel Discomfort", keywordJa: "腸の不快感", codes: [1] },
  { keyword: "Heavy Lower Body", keywordEn: "Heavy Lower Body", keywordJa: "下半身の重だるさ", codes: [1] }, // 下半身の重だるさ
  { keyword: "Stability", keywordEn: "Stability", keywordJa: "安定感", codes: [1] }, // [긍정 1]
  { keyword: "Control Issues", keywordEn: "Control Issues", keywordJa: "自己コントロールの難しさ", codes: [1, 3] },
  { keyword: "Anger", keywordEn: "Anger", keywordJa: "怒り", codes: [1, 3] },
  { keyword: "Food Cravings", keywordEn: "Food Cravings", keywordJa: "食欲暴走", codes: [1, 2] },
  { keyword: "Low Vitality", keywordEn: "Low Vitality", keywordJa: "活力低下", codes: [1, 2] },
  { keyword: "Joy", keywordEn: "Joy", keywordJa: "喜び", codes: [2] }, // [긍정 2]
  { keyword: "Defensive Posture", keywordEn: "Defensive Posture", keywordJa: "防御的姿勢", codes: [1, 2, 3] },
  { keyword: "Pelvic Discomfort", keywordEn: "Pelvic Discomfort", keywordJa: "骨盤の不快感", codes: [1, 2, 3] },
  { keyword: "Anxiety", keywordEn: "Anxiety", keywordJa: "不安", codes: [1, 2, 3] },
  { keyword: "Resentment", keywordEn: "Resentment", keywordJa: "恨み", codes: [1, 3, 5] },
  
  // --- 2페이지 분량 (13개) ---
  { keyword: "Chronic Fatigue", keywordEn: "Chronic Fatigue", keywordJa: "慢性疲労", codes: [1, 3, 5] },
  { keyword: "Fulfillment", keywordEn: "Fulfillment", keywordJa: "充実感", codes: [3] }, // [긍정 3]
  { keyword: "Heavy Responsibility", keywordEn: "Heavy Responsibility", keywordJa: "重い責任感", codes: [1, 3, 5] },
  { keyword: "Loneliness", keywordEn: "Loneliness", keywordJa: "孤独感", codes: [1, 2, 4] },
  { keyword: "Relationship Clinging", keywordEn: "Relationship Clinging", keywordJa: "対人関係への執着", codes: [1, 2, 4] },
  { keyword: "Cold Lower Abdomen", keywordEn: "Cold Lower Abdomen", keywordJa: "下腹部の冷え", codes: [1, 2, 4] },
  { keyword: "Financial Stress", keywordEn: "Financial Stress", keywordJa: "経済的ストレス", codes: [2] }, // 経済的ストレス
  { keyword: "Positivity", keywordEn: "Positivity", keywordJa: "肯定的思考", codes: [5] }, // [긍정 4]
  { keyword: "Shame / Guilt", keywordEn: "Shame / Guilt", keywordJa: "羞恥心・罪悪感", codes: [2] },
  { keyword: "Poor Abdominal Circulation", keywordEn: "Poor Abdominal Circulation", keywordJa: "お腹の血行不良", codes: [2] },
  { keyword: "Emotional Exhaustion", keywordEn: "Emotional Exhaustion", keywordJa: "感情の消耗", codes: [2, 4] },
  { keyword: "Jealousy", keywordEn: "Jealousy", keywordJa: "嫉妬", codes: [2, 4] },
  { keyword: "Frustration", keywordEn: "Frustration", keywordJa: "もどかしさ", codes: [2, 4, 6] },
  
  // --- 3페이지 분량 (13개) ---
  { keyword: "Excessive Empathy", keywordEn: "Excessive Empathy", keywordJa: "過剰な共感", codes: [2, 4, 6] },
  { keyword: "Love", keywordEn: "Love", keywordJa: "愛", codes: [4] }, // [긍정 5]
  { keyword: "Grudge / Blaming", keywordEn: "Grudge / Blaming", keywordJa: "怨み・他責", codes: [2, 4, 6] },
  { keyword: "Bloating / Indigestion", keywordEn: "Bloating / Indigestion", keywordJa: "胃もたれ・消化不良", codes: [3] },
  { keyword: "Competitiveness", keywordEn: "Competitiveness", keywordJa: "強い競争心", codes: [3] },
  { keyword: "Lack of Motivation", keywordEn: "Lack of Motivation", keywordJa: "意欲低下", codes: [3] },
  { keyword: "Authoritative Attitude", keywordEn: "Authoritative Attitude", keywordJa: "権威的な態度", codes: [3, 5] },
  { keyword: "Happiness", keywordEn: "Happiness", keywordJa: "幸せ", codes: [4] }, // [긍정 6]
  { keyword: "Suppression", keywordEn: "Suppression", keywordJa: "抑圧", codes: [3, 5] },
  { keyword: "Lethargy / Helplessness", keywordEn: "Lethargy / Helplessness", keywordJa: "無気力・無力感", codes: [3, 5, 7] },
  { keyword: "Inferiority Complex", keywordEn: "Inferiority Complex", keywordJa: "劣等感", codes: [3, 5, 7] },
  { keyword: "Difficulty Expressing", keywordEn: "Difficulty Expressing", keywordJa: "自己表現の難しさ", codes: [3, 5, 7] },
  { keyword: "Chest Tightness", keywordEn: "Chest Tightness", keywordJa: "胸の圧迫感", codes: [4] }, // 胸の圧迫感
  
  // --- 4페이지 분량 (13개) ---
  { keyword: "Chest Discomfort", keywordEn: "Chest Discomfort", keywordJa: "胸の不快感", codes: [4] },
  { keyword: "Serenity", keywordEn: "Serenity", keywordJa: "平穏", codes: [6] }, // [긍정 7]
  { keyword: "Emotional Hurt", keywordEn: "Emotional Hurt", keywordJa: "心の傷", codes: [4] },
  { keyword: "Cynicism", keywordEn: "Cynicism", keywordJa: "冷笑的態度", codes: [4, 6] },
  { keyword: "Misunderstandings", keywordEn: "Misunderstandings", keywordJa: "誤解", codes: [4, 6] },
  { keyword: "Sleep Disturbances", keywordEn: "Sleep Disturbances", keywordJa: "睡眠障害", codes: [4, 6, 7] },
  { keyword: "Derealization", keywordEn: "Derealization", keywordJa: "非現実感", codes: [4, 6, 7] },
  { keyword: "Low Mood / Gloom", keywordEn: "Low Mood / Gloom", keywordJa: "気分の落ち込み", codes: [4, 6, 7] },
  { keyword: "Shyness", keywordEn: "Shyness", keywordJa: "内気・人見知り", codes: [5] },
  { keyword: "Voice Strain", keywordEn: "Voice Strain", keywordJa: "発声のしにくさ", codes: [5] }, // 発声のしにくさ
  { keyword: "Stiff Neck / Throat", keywordEn: "Stiff Neck / Throat", keywordJa: "首・のどの凝り", codes: [5] },
  { keyword: "Confusion", keywordEn: "Confusion", keywordJa: "混乱", codes: [5, 7] },
  { keyword: "Ignorance / Unawareness", keywordEn: "Ignorance / Unawareness", keywordJa: "気づきのなさ", codes: [5, 7] },
  
  // --- 5페이지 분량 (12개) ---
  { keyword: "Heavy Head", keywordEn: "Heavy Head", keywordJa: "頭の重さ", codes: [5, 6, 7] },
  { keyword: "Information Overload", keywordEn: "Information Overload", keywordJa: "情報過多", codes: [5, 6, 7] },
  { keyword: "Gratitude", keywordEn: "Gratitude", keywordJa: "感謝", codes: [7] }, // [긍정 8]
  { keyword: "Tension / Tightness", keywordEn: "Tension / Tightness", keywordJa: "緊張・こわばり", codes: [5, 6, 7] },
  { keyword: "Eye Strain", keywordEn: "Eye Strain", keywordJa: "眼精疲労", codes: [6] },
  { keyword: "Hypersensitivity", keywordEn: "Hypersensitivity", keywordJa: "過敏さ", codes: [6] },
  { keyword: "Lack of Focus", keywordEn: "Lack of Focus", keywordJa: "集中力不足", codes: [6] },
  { keyword: "Block in Creativity", keywordEn: "Block in Creativity", keywordJa: "創造性の停滞", codes: [6, 7] },
  { keyword: "Disorientation", keywordEn: "Disorientation", keywordJa: "方向感覚の喪失", codes: [6, 7] },
  { keyword: "Sense of Isolation", keywordEn: "Sense of Isolation", keywordJa: "孤立感", codes: [7] },
  { keyword: "Loss of Presence", keywordEn: "Loss of Presence", keywordJa: "存在感の喪失", codes: [7] },
  { keyword: "Weakened Vital Energy", keywordEn: "Weakened Vital Energy", keywordJa: "気力の弱まり", codes: [7] },
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
  const { t, i18n } = useTranslation();
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);

  useEffect(() => {
    speak(t('speech.startSevenCodeTest'));
  }, [t]);

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
  const isJa = i18n.language?.startsWith('ja');

  return (
    <div className="flex flex-col items-center h-[calc(100vh-80px)] p-4 mx-auto max-w-5xl transition-all">
      {/* 헤더 영역 */}
      <div className="text-center mb-3 shrink-0">
        <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">{t('sevenCode.title')}</h2>
        <p className="text-gray-300 text-base sm:text-lg font-bold">
          {t('sevenCode.subtitle')}
        </p>
        <p className="text-gray-400 text-sm sm:text-base font-medium mt-1">
          {t('sevenCode.subNotice')} ({currentPage + 1} / {PAGES.length} Pages)
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
              <span className="w-full">{isJa ? item.keywordJa : item.keywordEn}</span>
            </button>
          );
        })}
      </div>

      {/* 네비게이션 버튼 - 항상 하단에 고정 */}
      <div className="flex justify-between w-full max-w-2xl mt-4 pb-2 shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-slate-500 text-sm font-medium">
            {t('sevenCode.thisPage')}: <span className="text-white font-black text-base">{t('sevenCode.pageSelectedCount', { count: pageSelectedCount })}</span>
          </span>
          <span className="text-slate-500 text-sm font-medium">
            {t('sevenCode.totalSelected')}: <span className="text-amber-400 font-black text-base">{t('sevenCode.totalSelectedCount', { count: selectedKeywords.length })}</span>
          </span>
        </div>
      </div>
      <div className="flex justify-between w-full max-w-2xl gap-3 pb-2 shrink-0">
        {currentPage > 0 && (
          <button onClick={handlePrev} className="flex-1 px-6 py-4 rounded-2xl text-xl font-bold bg-gray-700 text-white hover:bg-gray-600 transition-colors shadow-lg">
            <i className="fas fa-arrow-left mr-2" /> {t('common.prev')}
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
          {isLastPage ? <><i className="fas fa-check-circle mr-2" /> {t('common.complete')}</> : <>{t('common.next')} <i className="fas fa-arrow-right ml-2" /></>}
        </button>
      </div>
    </div>
  );
};

export default SevenCodeCheckModule;
