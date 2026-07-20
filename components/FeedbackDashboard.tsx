/**
 * FeedbackDashboard.tsx
 * 관리자 페이지의 "AI 피드백 현황" 탭 — 누적 피드백 데이터 시각화
 */

import React, { useState, useEffect } from 'react';
import { FeedbackRecord } from '../types';
import { getFeedbacks } from '../services/feedbackService';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const RATING_COLORS = {
  accurate:   '#10b981',
  partial:    '#f59e0b',
  inaccurate: '#f43f5e',
};

const RATING_LABELS: Record<string, string> = {
  accurate:   '정확한 측정 👍',
  partial:    '일부 수정 필요 🤔',
  inaccurate: '부정확 👎',
};

/* ── 유틸 ──────────────────────────────────────────────────────────── */
const avg = (nums: number[]) =>
  nums.length === 0 ? 0 : Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);

const exportJson = (data: FeedbackRecord[]) => {
  const str = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
  const a = document.createElement('a');
  a.href = str;
  a.download = `feedback_export_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

const getRatingSummary = (r: FeedbackRecord): 'accurate' | 'partial' | 'inaccurate' | null => {
  let rawRating;
  if (r.feedbackType === 'face') rawRating = r.feedback.faceRating;
  else if (r.feedbackType === 'tarot') rawRating = r.feedback.tarotRating;
  else rawRating = r.feedback.physicalRating;

  if (!rawRating) return null;
  if (rawRating === 'very_satisfied' || rawRating === 'satisfied') return 'accurate';
  if (rawRating === 'normal') return 'partial';
  return 'inaccurate';
};

/* ── 메인 컴포넌트 ────────────────────────────────────────────────── */
const FeedbackDashboard: React.FC = () => {
  const [records, setRecords] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFeedbacks().then(data => {
      setRecords(data);
      setLoading(false);
    });
  }, []);

  /* 통계 계산 */
  const validRecords = records.map(r => ({ ...r, summaryRating: getRatingSummary(r) })).filter(r => r.summaryRating !== null);
  const total      = validRecords.length;
  const accurate   = validRecords.filter(r => r.summaryRating === 'accurate').length;
  const partial    = validRecords.filter(r => r.summaryRating === 'partial').length;
  const inaccurate = validRecords.filter(r => r.summaryRating === 'inaccurate').length;

  const pieData = [
    { name: '정확', value: accurate,   key: 'accurate' },
    { name: '일부 수정', value: partial,   key: 'partial' },
    { name: '부정확', value: inaccurate, key: 'inaccurate' },
  ].filter(d => d.value > 0);

  /* 수정된 피드백의 점수 오차 분석 */
  const correctedRecords = records.filter(
    r => r.feedback.correctedOverallScore !== undefined || r.feedback.correctedPhysicalAge !== undefined
  );
  const scoreDiffs = correctedRecords
    .filter(r => r.feedback.correctedOverallScore !== undefined)
    .map(r => r.feedback.correctedOverallScore! - r.reportSnapshot.overallScore);
  const ageDiffs = correctedRecords
    .filter(r => r.feedback.correctedPhysicalAge !== undefined)
    .map(r => r.feedback.correctedPhysicalAge! - r.reportSnapshot.physicalAge);

  const avgScoreDiff = avg(scoreDiffs);
  const avgAgeDiff   = avg(ageDiffs);

  /* 연령대별 정확도 분포 */
  const ageGroups: Record<string, { accurate: number; total: number }> = {};
  validRecords.forEach(r => {
    const band = `${Math.floor(r.userInfo.age / 10) * 10}대`;
    if (!ageGroups[band]) ageGroups[band] = { accurate: 0, total: 0 };
    ageGroups[band].total++;
    if (r.summaryRating === 'accurate') ageGroups[band].accurate++;
  });
  const ageBarData = Object.entries(ageGroups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([age, d]) => ({
      age,
      정확도: Math.round((d.accurate / d.total) * 100),
    }));

  /* 최근 20건 */
  const recent = [...records]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);

  /* ── 로딩 ─────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  /* ── 빈 상태 ──────────────────────────────────────────────────────── */
  if (total === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
        <div className="text-5xl mb-4">📋</div>
        <p className="text-slate-500 font-bold text-lg">아직 저장된 피드백이 없습니다</p>
        <p className="text-slate-400 text-sm mt-2">
          측정 결과 리포트 하단의 관리자 피드백 패널에서 평가를 입력해 주세요.
        </p>
      </div>
    );
  }

  /* ── 메인 렌더 ────────────────────────────────────────────────────── */
  return (
    <div className="space-y-8">

      {/* ① 요약 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: '종합 만족도', value: total ? Math.round((accurate/total)*100) : 0, unit: '%', color: 'bg-indigo-50 text-indigo-700 border-2 border-indigo-100', icon: '⭐', isSatisfaction: true },
          { label: '전체 피드백', value: total, unit: '건', color: 'bg-slate-100 text-slate-700', icon: '📊' },
          { label: '정확한 측정', value: accurate, unit: '건', color: 'bg-emerald-50 text-emerald-700', icon: '👍', pct: total ? Math.round(accurate/total*100) : 0 },
          { label: '일부 수정', value: partial, unit: '건', color: 'bg-amber-50 text-amber-700', icon: '🤔', pct: total ? Math.round(partial/total*100) : 0 },
          { label: '부정확', value: inaccurate, unit: '건', color: 'bg-rose-50 text-rose-700', icon: '👎', pct: total ? Math.round(inaccurate/total*100) : 0 },
        ].map((card, i) => (
          <div key={i} className={`${card.color} rounded-3xl p-5 flex flex-col gap-1`}>
            <span className="text-2xl">{card.icon}</span>
            <p className="text-xs font-bold uppercase tracking-wider opacity-70 mt-1">{card.label}</p>
            <p className="text-3xl font-black">{card.value}<span className="text-sm font-bold ml-1">{card.unit}</span></p>
            {'pct' in card && (
              <div className="mt-1 h-1.5 bg-black/10 rounded-full overflow-hidden">
                <div className="h-full bg-current rounded-full" style={{ width: `${card.pct}%`, opacity: 0.6 }} />
              </div>
            )}
            {'pct' in card && <p className="text-xs font-bold opacity-60">{card.pct}%</p>}
            {'isSatisfaction' in card && (
              <p className="text-[10px] font-bold opacity-60 mt-1 leading-tight">전체 평가 중<br/>긍정(만족) 비율</p>
            )}
          </div>
        ))}
      </div>

      {/* ② 도넛 차트 + 연령대 정확도 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 도넛 */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6">
          <h3 className="text-base font-black text-slate-800 mb-4">
            <i className="fas fa-chart-pie text-indigo-400 mr-2" />
            AI 평가 정확도 분포
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={RATING_COLORS[entry.key as keyof typeof RATING_COLORS]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: number) => [`${val}건`, '']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                />
                <Legend
                  iconType="circle"
                  formatter={(value, entry: any) =>
                    RATING_LABELS[entry.payload.key] || value
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 연령대별 정확도 막대 */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6">
          <h3 className="text-base font-black text-slate-800 mb-4">
            <i className="fas fa-chart-bar text-indigo-400 mr-2" />
            연령대별 AI 정확도 (%)
          </h3>
          {ageBarData.length === 0 ? (
            <div className="flex items-center justify-center h-56 text-slate-300 text-sm">데이터 부족</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageBarData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="age" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip
                    formatter={(val: number) => [`${val}%`, 'AI 정확도']}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="정확도" fill="#6366f1" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ③ 수정 패턴 분석 */}
      {correctedRecords.length > 0 && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl border border-amber-100 p-6">
          <h3 className="text-base font-black text-slate-800 mb-5">
            <i className="fas fa-edit text-amber-500 mr-2" />
            AI 오차 분석 <span className="text-xs font-medium text-slate-500 ml-2">(수정 피드백 {correctedRecords.length}건 기준)</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-amber-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">종합 점수 평균 오차</p>
              <div className="flex items-end gap-2">
                <span className={`text-4xl font-black ${avgScoreDiff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {avgScoreDiff >= 0 ? '+' : ''}{avgScoreDiff}점
                </span>
                <span className="text-sm text-slate-400 mb-1">AI 대비 관리자 수정값</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {avgScoreDiff > 0 ? '→ AI가 실제보다 낮게 평가하는 경향' : avgScoreDiff < 0 ? '→ AI가 실제보다 높게 평가하는 경향' : '→ AI 점수가 전반적으로 정확함'}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-amber-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">신체 나이 평균 오차</p>
              <div className="flex items-end gap-2">
                <span className={`text-4xl font-black ${avgAgeDiff <= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {avgAgeDiff >= 0 ? '+' : ''}{avgAgeDiff}세
                </span>
                <span className="text-sm text-slate-400 mb-1">AI 대비 관리자 수정값</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {avgAgeDiff > 0 ? '→ AI가 신체 나이를 더 낮게 추정하는 경향' : avgAgeDiff < 0 ? '→ AI가 신체 나이를 더 높게 추정하는 경향' : '→ 신체 나이 추정이 전반적으로 정확함'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ④ 최근 피드백 목록 */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-base font-black text-slate-800">
            <i className="fas fa-list text-indigo-400 mr-2" />
            최근 피드백 목록 <span className="text-xs font-medium text-slate-400">({Math.min(20, total)}건)</span>
          </h3>
          <button
            onClick={() => exportJson(records)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 font-bold text-xs rounded-xl hover:bg-indigo-100 transition-all"
          >
            <i className="fas fa-download" /> 전체 내보내기
          </button>
        </div>

        <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
          {recent.map((r) => {
            const sumRating = getRatingSummary(r);
            if (!sumRating) return null;

            const ratingColor = {
              accurate:   'bg-emerald-100 text-emerald-700 border-emerald-200',
              partial:    'bg-amber-100 text-amber-700 border-amber-200',
              inaccurate: 'bg-rose-100 text-rose-700 border-rose-200',
            }[sumRating];

            const ratingIcon = { accurate: '👍', partial: '🤔', inaccurate: '👎' }[sumRating];
            const hasCorrection =
              r.feedback.correctedOverallScore !== undefined ||
              r.feedback.correctedPhysicalAge !== undefined;

            return (
              <div
                key={r.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-100 transition-all"
              >
                {/* 날짜 */}
                <div className="text-xs text-slate-400 font-bold min-w-[80px]">
                  {new Date(r.createdAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                </div>

                {/* 대상자 */}
                <div className="flex items-center gap-2 min-w-[90px]">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                    {r.userInfo.gender === 'male' ? '♂' : '♀'}
                  </div>
                  <span className="text-sm font-bold text-slate-700">{r.userInfo.age}세</span>
                </div>

                {/* 평가 배지 */}
                <span className={`px-3 py-1 rounded-xl text-xs font-black border ${ratingColor}`}>
                  {ratingIcon} {RATING_LABELS[sumRating]}
                </span>

                {/* 점수 비교 */}
                {hasCorrection && (
                  <div className="flex gap-3 text-xs text-slate-500 font-medium">
                    {r.feedback.correctedOverallScore !== undefined && (
                      <span>
                        점수: <span className="text-slate-400 line-through">{r.reportSnapshot.overallScore}</span>
                        {' → '}
                        <span className="font-black text-indigo-600">{r.feedback.correctedOverallScore}</span>
                      </span>
                    )}
                    {r.feedback.correctedPhysicalAge !== undefined && (
                      <span>
                        나이: <span className="text-slate-400 line-through">{r.reportSnapshot.physicalAge}세</span>
                        {' → '}
                        <span className="font-black text-amber-600">{r.feedback.correctedPhysicalAge}세</span>
                      </span>
                    )}
                  </div>
                )}

                {/* 메모 */}
                {r.feedback.notes && (
                  <p className="text-xs text-slate-500 italic border-l-2 border-slate-200 pl-2 flex-1">
                    "{r.feedback.notes}"
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FeedbackDashboard;
