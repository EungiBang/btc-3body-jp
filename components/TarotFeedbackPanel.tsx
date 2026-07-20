import React, { useState } from 'react';
import { UserInfo, DiagnosticFeedback } from '../types';
import { saveTarotFeedback } from '../services/feedbackService';

interface TarotFeedbackPanelProps {
  userInfo: UserInfo;
  concern: string;
  cards: { past: string; present: string; future: string };
  reportData: string;
}

type Step = 'idle' | 'submitting' | 'done';
type RatingType = DiagnosticFeedback['tarotRating'];

const TarotFeedbackPanel: React.FC<TarotFeedbackPanelProps> = ({ userInfo, concern, cards, reportData }) => {
  const [step, setStep] = useState<Step>('idle');
  const [tarotRating, setTarotRating] = useState<RatingType | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!tarotRating) return;
    setStep('submitting');
    try {
      await saveTarotFeedback(
        { age: userInfo.age, gender: userInfo.gender },
        {
          concern,
          cards,
          reportData,
        },
        {
          tarotRating,
          notes: notes.trim() || undefined,
          submittedAt: new Date().toISOString(),
        }
      );
      setStep('done');
    } catch {
      setError('저장 실패. 다시 시도해 주세요.');
      setStep('idle');
    }
  };

  const ratingOptions: { value: RatingType; label: string; emoji: string; color: string }[] = [
    { value: 'very_satisfied', label: '매우 소름 돋음', emoji: '🔮', color: '' },
    { value: 'satisfied', label: '대체로 맞음', emoji: '✨', color: '' },
    { value: 'normal', label: '보통', emoji: '😐', color: '' },
    { value: 'dissatisfied', label: '잘 안맞음', emoji: '😕', color: '' },
    { value: 'very_dissatisfied', label: '전혀 안맞음', emoji: '😡', color: '' }
  ];

  if (step === 'done') {
    return (
      <section className="print:hidden mt-8 mb-4">
        <div className="bg-indigo-900/40 border border-indigo-500/30 rounded-3xl p-8 flex items-center gap-5 animate-fade-in">
          <div className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(99,102,241,0.5)]">
            <span className="text-2xl">✨</span>
          </div>
          <div>
            <h4 className="text-lg font-black text-indigo-200">우주의 기운이 기록되었습니다!</h4>
            <p className="text-sm font-medium text-indigo-300 mt-1">
              소중한 피드백이 누적되어 다음 타로 해설의 영적 통찰력을 높이게 됩니다.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (step === 'submitting') {
    return (
      <section className="print:hidden mt-8 mb-4">
        <div className="bg-slate-900/50 backdrop-blur-md border border-slate-700 rounded-3xl p-8 flex items-center gap-4 animate-pulse">
          <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-300 font-medium">아카식 레코드에 기록 중...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="print:hidden mt-8 mb-4 space-y-4">
      <div className="bg-slate-900/60 backdrop-blur-lg border border-indigo-500/30 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        
        <div className="flex items-center gap-3 mb-6 relative z-10">
          <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center shrink-0 border border-indigo-500/50">
            <span className="text-xl">🔮</span>
          </div>
          <div>
            <h4 className="text-lg font-black text-slate-100">K-타로 해석 평가</h4>
            <p className="text-sm font-medium text-slate-400">이번 타로 해석이 현재 고민 상황과 얼마나 잘 맞았나요?</p>
          </div>
        </div>

        <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700 mb-6 relative z-10">
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {ratingOptions.map(opt => {
                const isSelected = tarotRating === opt.value;
                return (
                  <button
                    key={opt.value!}
                    onClick={() => setTarotRating(opt.value)}
                    className={`flex items-center gap-1.5 px-4 py-3 rounded-xl border transition-all ${
                      isSelected 
                        ? 'ring-2 ring-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)] bg-indigo-500/20 border-indigo-500 text-indigo-100' 
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-xl">{opt.emoji}</span>
                    <span className={`text-sm font-bold ${isSelected ? '' : 'font-medium'}`}>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-300 block mb-2">추가 의견 (선택)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="예: 과거 상황은 소름 돋게 맞았는데, 해결책이 조금 추상적임."
              rows={2}
              className="w-full px-4 py-3 rounded-2xl border border-slate-700 text-sm text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-900/50 transition-colors"
            />
          </div>
        </div>

        {error && <p className="text-sm text-rose-500 font-bold mb-4 relative z-10">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!tarotRating}
          className={`w-full py-4 text-white font-black rounded-2xl transition-all shadow-md relative z-10 ${
            tarotRating 
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:scale-[1.01] active:scale-95 shadow-indigo-500/30' 
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
          }`}
        >
          {tarotRating ? '평가 제출하여 AI 통찰력 높이기' : '정확도 버튼을 먼저 선택해주세요'}
        </button>
      </div>
    </section>
  );
};

export default TarotFeedbackPanel;
