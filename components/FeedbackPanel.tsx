/**
 * FeedbackPanel.tsx
 * 결과 페이지 하단에 표시되는 관리자 피드백 UI
 * "이 분석이 얼마나 정확했나요?" → 피드백 저장 → Few-Shot 학습 데이터 누적
 */

import React, { useState } from 'react';
import { BodyReport, DiagnosticFeedback } from '../types';
import { saveFeedback } from '../services/feedbackService';

interface FeedbackPanelProps {
  report: BodyReport;
}

type Step = 'idle' | 'submitting' | 'done';
type RatingType = DiagnosticFeedback['physicalRating'];

const FeedbackPanel: React.FC<FeedbackPanelProps> = ({ report }) => {
  const [step, setStep] = useState<Step>('idle');
  const [physicalRating, setPhysicalRating] = useState<RatingType | null>(null);
  const [faceRating, setFaceRating] = useState<RatingType | null>(null);
  const [brainRating, setBrainRating] = useState<RatingType | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const canSubmit = physicalRating && faceRating && brainRating;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setStep('submitting');
    try {
      await saveFeedback(report, {
        physicalRating: physicalRating!,
        faceRating: faceRating!,
        brainRating: brainRating!,
        notes: notes.trim() || undefined,
        submittedAt: new Date().toISOString(),
      });
      setStep('done');
    } catch {
      setError('저장 실패. 다시 시도해 주세요.');
      setStep('idle');
    }
  };

  const ratingOptions: { value: RatingType; label: string; emoji: string; color: string }[] = [
    { value: 'very_satisfied', label: '매우 만족', emoji: '😍', color: 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' },
    { value: 'satisfied', label: '만족', emoji: '😊', color: 'text-teal-600 bg-teal-50 border-teal-200 hover:bg-teal-100' },
    { value: 'normal', label: '보통', emoji: '😐', color: 'text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100' },
    { value: 'dissatisfied', label: '불만족', emoji: '😕', color: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100' },
    { value: 'very_dissatisfied', label: '매우 불만족', emoji: '😡', color: 'text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100' }
  ];

  const renderRatingGroup = (
    title: string, 
    value: RatingType | null, 
    onChange: (val: RatingType) => void
  ) => (
    <div className="mb-6">
      <h5 className="text-sm font-bold text-slate-700 mb-3">{title}</h5>
      <div className="flex flex-wrap gap-2">
        {ratingOptions.map(opt => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border transition-all ${
                isSelected 
                  ? `ring-2 ring-indigo-500 shadow-md ${opt.color}` 
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span className="text-lg">{opt.emoji}</span>
              <span className={`text-sm font-bold ${isSelected ? '' : 'text-slate-600'}`}>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  if (step === 'done') {
    return (
      <section className="print:hidden mt-6">
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-8 flex items-center gap-5 animate-fade-in">
          <div className="w-14 h-14 bg-emerald-400 rounded-2xl flex items-center justify-center shrink-0 shadow-md shadow-emerald-200">
            <span className="text-2xl">✅</span>
          </div>
          <div>
            <h4 className="text-lg font-black text-emerald-800">피드백 저장 완료!</h4>
            <p className="text-sm font-medium text-emerald-700 mt-1">
              소중한 피드백이 누적되어 다음 분석의 정확도를 높이는 데 활용됩니다.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (step === 'submitting') {
    return (
      <section className="print:hidden mt-6">
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 flex items-center gap-4 animate-pulse">
          <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-600 font-medium">피드백 저장 중...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="print:hidden mt-6 space-y-4">
      <div className="bg-gradient-to-br from-slate-50 to-indigo-50 border border-indigo-100 rounded-3xl p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-xl">🎯</span>
          </div>
          <div>
            <h4 className="text-lg font-black text-slate-800">AI 종합 분석 피드백</h4>
            <p className="text-sm font-medium text-slate-500">각 영역별로 AI 분석의 정확도를 평가해주세요</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
          {renderRatingGroup('신체 나이 분석 정확도', physicalRating, setPhysicalRating)}
          {renderRatingGroup('얼굴 나이 분석 정확도', faceRating, setFaceRating)}
          {renderRatingGroup('뇌 나이 (반응/기억력) 분석 정확도', brainRating, setBrainRating)}

          <div>
            <label className="text-sm font-bold text-slate-700 block mb-2">관리자 종합 의견 (선택)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="예: 스쿼트 자세가 실제보다 과소평가됨, 전반적으로 매우 정확함 등"
              rows={3}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-medium text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50 focus:bg-white transition-colors"
            />
          </div>
        </div>

        {error && <p className="text-sm text-rose-500 font-bold mb-4">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full py-4 text-white font-black rounded-2xl transition-all shadow-md ${
            canSubmit 
              ? 'bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.01] active:scale-95 shadow-indigo-200' 
              : 'bg-slate-300 cursor-not-allowed'
          }`}
        >
          {canSubmit ? '분석 피드백 제출하기' : '모든 영역의 평가를 선택해주세요'}
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50/60 rounded-2xl border border-indigo-100">
        <span className="text-sm">🔒</span>
        <p className="text-xs font-medium text-indigo-600">
          피드백은 익명으로 안전하게 저장되며, AI 알고리즘 고도화의 학습 데이터로만 활용됩니다.
        </p>
      </div>
    </section>
  );
};

export default FeedbackPanel;
