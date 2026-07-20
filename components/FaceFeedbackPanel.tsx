import React, { useState } from 'react';
import { UserInfo, PhysiognomyReport, DiagnosticFeedback } from '../types';
import { saveFaceFeedback } from '../services/feedbackService';

interface FaceFeedbackPanelProps {
  userInfo: UserInfo;
  report: PhysiognomyReport;
}

type Step = 'idle' | 'submitting' | 'done';
type RatingType = DiagnosticFeedback['faceRating'];

const FaceFeedbackPanel: React.FC<FaceFeedbackPanelProps> = ({ userInfo, report }) => {
  const [step, setStep] = useState<Step>('idle');
  const [faceRating, setFaceRating] = useState<RatingType | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!faceRating) return;
    setStep('submitting');
    try {
      await saveFaceFeedback(
        { age: userInfo.age, gender: userInfo.gender },
        {
          animalFace: report.animalMorphology?.type || '분석 없음',
          metrics: report.traditionalAnalysis || {},
          summary: report.summary,
        },
        {
          faceRating,
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
    { value: 'very_satisfied', label: '매우 잘 맞음', emoji: '😍', color: 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' },
    { value: 'satisfied', label: '대체로 맞음', emoji: '😊', color: 'text-teal-600 bg-teal-50 border-teal-200 hover:bg-teal-100' },
    { value: 'normal', label: '보통', emoji: '😐', color: 'text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100' },
    { value: 'dissatisfied', label: '잘 안맞음', emoji: '😕', color: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100' },
    { value: 'very_dissatisfied', label: '전혀 안맞음', emoji: '😡', color: 'text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100' }
  ];

  if (step === 'done') {
    return (
      <section className="print:hidden mt-10">
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-8 flex items-center gap-5 animate-fade-in">
          <div className="w-14 h-14 bg-emerald-400 rounded-2xl flex items-center justify-center shrink-0 shadow-md shadow-emerald-200">
            <span className="text-2xl">✅</span>
          </div>
          <div>
            <h4 className="text-lg font-black text-emerald-800">피드백 저장 완료!</h4>
            <p className="text-sm font-medium text-emerald-700 mt-1">
              소중한 피드백이 누적되어 다음 관상 진단의 정확도를 높이는 딥러닝 데이터로 활용됩니다.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (step === 'submitting') {
    return (
      <section className="print:hidden mt-10">
        <div className="bg-slate-900/50 backdrop-blur-md border border-slate-700 rounded-3xl p-8 flex items-center gap-4 animate-pulse">
          <div className="w-8 h-8 border-4 border-fuchsia-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-300 font-medium">딥러닝 데이터베이스에 기록 중...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="print:hidden mt-10 space-y-4">
      <div className="bg-slate-900/60 backdrop-blur-lg border border-fuchsia-500/30 rounded-3xl p-6 md:p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-fuchsia-500/20 rounded-xl flex items-center justify-center shrink-0 border border-fuchsia-500/50">
            <span className="text-xl">🎭</span>
          </div>
          <div>
            <h4 className="text-lg font-black text-slate-100">K-관상 정확도 평가</h4>
            <p className="text-sm font-medium text-slate-400">이번 관상 분석이 얼마나 잘 맞았는지 알려주세요.</p>
          </div>
        </div>

        <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700 mb-6">
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {ratingOptions.map(opt => {
                const isSelected = faceRating === opt.value;
                return (
                  <button
                    key={opt.value!}
                    onClick={() => setFaceRating(opt.value)}
                    className={`flex items-center gap-1.5 px-4 py-3 rounded-xl border transition-all ${
                      isSelected 
                        ? 'ring-2 ring-fuchsia-500 shadow-lg shadow-fuchsia-500/20 bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-100' 
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
              placeholder="예: 직업적인 부분은 매우 잘 맞았으나, 연애운은 약간 다름."
              rows={2}
              className="w-full px-4 py-3 rounded-2xl border border-slate-700 text-sm text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-fuchsia-500 bg-slate-900/50 transition-colors"
            />
          </div>
        </div>

        {error && <p className="text-sm text-rose-500 font-bold mb-4">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!faceRating}
          className={`w-full py-4 text-white font-black rounded-2xl transition-all shadow-md ${
            faceRating 
              ? 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:scale-[1.01] active:scale-95 shadow-fuchsia-500/30' 
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
          }`}
        >
          {faceRating ? '피드백 제출하여 AI 학습시키기' : '정확도 버튼을 먼저 선택해주세요'}
        </button>
      </div>
    </section>
  );
};

export default FaceFeedbackPanel;
