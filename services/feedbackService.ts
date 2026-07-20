/**
 * feedbackService.ts
 * 분석 피드백 데이터 저장/로드/검색 + Few-Shot 프롬프트 생성
 *
 * 저장 우선순위:
 *   Electron 환경 → IPC → feedback-db.json (userData 디렉토리)
 *   브라우저(개발) 환경 → localStorage ('btc-feedback-db')
 */

import { FeedbackRecord, DiagnosticFeedback, BodyReport, UserInfo } from '../types';
import { syncFeedbackToCloud, fetchFeedbacksFromCloud } from './cloudSyncService';

// ─── 내부 유틸 ────────────────────────────────────────────────────────────────

const generateId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return 'fb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
};

// ─── 저장/로드 (환경별 분기) ──────────────────────────────────────────────────

const LOCALSTORAGE_KEY = 'btc-feedback-db';

const loadAllFeedbacks = async (): Promise<FeedbackRecord[]> => {
  try {
    // Electron IPC
    if (window.electronAPI?.getFeedbackRecords) {
      const records = await window.electronAPI.getFeedbackRecords();
      return Array.isArray(records) ? records : [];
    }
  } catch {}
  // 웹/개발 환경 폴백: localStorage
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveAllFeedbacks = async (records: FeedbackRecord[]): Promise<void> => {
  try {
    if (window.electronAPI?.saveFeedbackRecords) {
      await window.electronAPI.saveFeedbackRecords(records);
      return;
    }
  } catch {}
  // 웹/개발 환경 폴백
  try {
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('[feedbackService] localStorage 저장 실패:', e);
  }
};

// ─── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * 새 피드백 저장
 */
export const saveFeedback = async (
  report: BodyReport,
  feedback: DiagnosticFeedback
): Promise<void> => {
  const record: FeedbackRecord = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    userInfo: {
      age: report.userInfo.age,
      gender: report.userInfo.gender,
    },
    reportSnapshot: {
      overallScore: report.overallScore,
      physicalAge: report.physicalAge,
      summary: report.summary,
      bodyTypeAnalysis: report.bodyTypeAnalysis || '',
      postureMetrics: report.postureMetrics || [],
    },
    feedback,
    feedbackType: 'body',
  };

  const existing = await loadAllFeedbacks();
  // 최대 200건 유지 (오래된 것부터 삭제)
  const trimmed = [record, ...existing].slice(0, 200);
  await saveAllFeedbacks(trimmed);
  
  // 클라우드로 동기화 (Background)
  syncFeedbackToCloud(record).catch(e => console.error('Feedback sync error:', e));
};

/**
 * 전체 피드백 목록 반환 (관리자 대시보드용 - 클라우드 통합 데이터)
 */
export const getFeedbacks = async (): Promise<FeedbackRecord[]> => {
  return await fetchFeedbacksFromCloud('body', 500);
};

/**
 * 유사 사례 검색 (나이 ±10세 AND 동일 성별 AND 만족도 높음)
 * positive 피드백(정확한 분석)만 Few-Shot 대상으로 사용
 */
export const findSimilarCases = async (
  userInfo: Pick<UserInfo, 'age' | 'gender'>,
  topN = 3
): Promise<{ positive: FeedbackRecord[], negative: FeedbackRecord[] }> => {
  const all = await fetchFeedbacksFromCloud('body', 100);
  const matched = all.filter(r => r.feedbackType === 'body' && r.userInfo.gender === userInfo.gender && Math.abs(r.userInfo.age - userInfo.age) <= 10);
  
  const positive = matched.filter(r => r.feedback.physicalRating === 'very_satisfied' || r.feedback.physicalRating === 'satisfied')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, topN);
  const negative = matched.filter(r => r.feedback.physicalRating === 'dissatisfied' || r.feedback.physicalRating === 'very_dissatisfied')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, topN);
    
  return { positive, negative };
};

export const findSimilarFaceCases = async (
  userInfo: Pick<UserInfo, 'age' | 'gender'>,
  topN = 3
): Promise<{ positive: FeedbackRecord[], negative: FeedbackRecord[] }> => {
  const all = await fetchFeedbacksFromCloud('face', 100);
  const matched = all.filter(r => r.feedbackType === 'face' && r.userInfo.gender === userInfo.gender);
  
  const positive = matched.filter(r => r.feedback.faceRating === 'very_satisfied' || r.feedback.faceRating === 'satisfied')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, topN);
  const negative = matched.filter(r => r.feedback.faceRating === 'dissatisfied' || r.feedback.faceRating === 'very_dissatisfied')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, topN);
    
  return { positive, negative };
};

export const findSimilarTarotCases = async (
  topN = 3
): Promise<{ positive: FeedbackRecord[], negative: FeedbackRecord[] }> => {
  const all = await fetchFeedbacksFromCloud('tarot', 100);
  const matched = all.filter(r => r.feedbackType === 'tarot');
  
  const positive = matched.filter(r => r.feedback.tarotRating === 'very_satisfied' || r.feedback.tarotRating === 'satisfied')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, topN);
  const negative = matched.filter(r => r.feedback.tarotRating === 'dissatisfied' || r.feedback.tarotRating === 'very_dissatisfied')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, topN);
    
  return { positive, negative };
};

export const saveFaceFeedback = async (
  userInfo: Pick<UserInfo, 'age' | 'gender'>,
  faceSnapshot: NonNullable<FeedbackRecord['faceSnapshot']>,
  feedback: DiagnosticFeedback
): Promise<void> => {
  const record: FeedbackRecord = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    userInfo,
    faceSnapshot,
    feedback,
    feedbackType: 'face',
  };
  const existing = await loadAllFeedbacks();
  const trimmed = [record, ...existing].slice(0, 200);
  await saveAllFeedbacks(trimmed);

  // 클라우드로 동기화 (Background)
  syncFeedbackToCloud(record).catch(e => console.error('Face feedback sync error:', e));
};

export const saveTarotFeedback = async (
  userInfo: Pick<UserInfo, 'age' | 'gender'>,
  tarotSnapshot: NonNullable<FeedbackRecord['tarotSnapshot']>,
  feedback: DiagnosticFeedback
): Promise<void> => {
  const record: FeedbackRecord = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    userInfo,
    tarotSnapshot,
    feedback,
    feedbackType: 'tarot',
  };
  const existing = await loadAllFeedbacks();
  const trimmed = [record, ...existing].slice(0, 200);
  await saveAllFeedbacks(trimmed);

  // 클라우드로 동기화 (Background)
  syncFeedbackToCloud(record).catch(e => console.error('Tarot feedback sync error:', e));
};

export const buildFewShotPrompt = (cases: { positive: FeedbackRecord[], negative: FeedbackRecord[] }): string => {
  if (cases.positive.length === 0 && cases.negative.length === 0) return '';
  const lines: string[] = [];

  if (cases.positive.length > 0) {
    lines.push('■ 과거 유사 사례 참고 (긍정적 모범 사례 - Few-Shot Learning)');
    lines.push('아래는 실제 분석에서 관리자가 "만족" 이상으로 평가한 사례들입니다. 이 기준을 참고하여 일관된 점수를 산출하세요.\n');
    cases.positive.forEach((c, i) => {
      lines.push(`[모범 사례 ${i + 1}]`);
      lines.push(`  - 성별: ${c.userInfo.gender === 'male' ? '남성' : '여성'}, 나이: ${c.userInfo.age}세`);
      if (c.reportSnapshot) {
        lines.push(`  - 체형 분석: ${c.reportSnapshot.bodyTypeAnalysis || '기록 없음'}`);
        lines.push(`  - 자세 항목 점수: ${c.reportSnapshot.postureMetrics.map(m => `${m.name}=${m.score}`).join(', ')}`);
        lines.push(`  - 확정 신체 나이: ${c.reportSnapshot.physicalAge}세 / 확정 종합 점수: ${c.reportSnapshot.overallScore}점`);
      }
      if (c.feedback.notes) lines.push(`  - 관리자 긍정 평가 메모: ${c.feedback.notes}`);
      lines.push('');
    });
  }

  if (cases.negative.length > 0) {
    lines.push('■ 오류 교정 사례 참고 (부정적 오류 사례 - Negative Few-Shot)');
    lines.push('아래는 과거 AI 분석에서 "불만족" 평가를 받아 관리자가 수정을 지시한 오류 사례입니다. 관리자의 메모(수정 요청사항)를 반드시 읽고, 동일한 실수를 반복하지 마세요.\n');
    cases.negative.forEach((c, i) => {
      lines.push(`[오류 및 교정 사례 ${i + 1}]`);
      lines.push(`  - 성별: ${c.userInfo.gender === 'male' ? '남성' : '여성'}, 나이: ${c.userInfo.age}세`);
      if (c.reportSnapshot) {
        lines.push(`  - 당시 AI가 측정한 잘못된 신체 나이: ${c.reportSnapshot.physicalAge}세 / 종합 점수: ${c.reportSnapshot.overallScore}점`);
      }
      if (c.feedback.notes) lines.push(`  - ★ 관리자의 강력한 교정 지시 메모: ${c.feedback.notes}`);
      lines.push('');
    });
  }

  return lines.join('\n');
}

export const buildFaceFewShotPrompt = (cases: { positive: FeedbackRecord[], negative: FeedbackRecord[] }): string => {
  if (cases.positive.length === 0 && cases.negative.length === 0) return '';
  const lines: string[] = [];

  if (cases.positive.length > 0) {
    lines.push('■ 과거 K-관상 분석에서 매우 높은 정확도를 보인 사례 (긍정적 모범 사례)');
    lines.push('이 사례들을 참고하여 일관되고 통찰력 있는 관상 분석을 진행하십시오.\n');
    cases.positive.forEach((c, i) => {
      if (!c.faceSnapshot) return;
      lines.push(`[모범 사례 ${i + 1}]`);
      lines.push(`  - 성별: ${c.userInfo.gender === 'male' ? '남성' : '여성'}, 나이: ${c.userInfo.age}세`);
      lines.push(`  - 도출된 동물상: ${c.faceSnapshot.animalFace}`);
      lines.push(`  - 핵심 요약: ${c.faceSnapshot.summary}`);
      if (c.feedback.notes) lines.push(`  - 관리자 메모: ${c.feedback.notes}`);
      lines.push('');
    });
  }

  if (cases.negative.length > 0) {
    lines.push('■ K-관상 분석 오류 교정 사례 (부정적 오류 사례)');
    lines.push('아래는 부정확한 분석으로 관리자의 수정 지시를 받은 사례입니다. 동일한 실수를 반복하지 마십시오.\n');
    cases.negative.forEach((c, i) => {
      if (!c.faceSnapshot) return;
      lines.push(`[오류 및 교정 사례 ${i + 1}]`);
      lines.push(`  - 성별: ${c.userInfo.gender === 'male' ? '남성' : '여성'}, 나이: ${c.userInfo.age}세`);
      lines.push(`  - 당시 도출된 잘못된 동물상: ${c.faceSnapshot.animalFace}`);
      if (c.feedback.notes) lines.push(`  - ★ 관리자의 강력한 교정 지시 메모: ${c.feedback.notes}`);
      lines.push('');
    });
  }

  return lines.join('\n');
};

export const buildTarotFewShotPrompt = (cases: { positive: FeedbackRecord[], negative: FeedbackRecord[] }): string => {
  if (cases.positive.length === 0 && cases.negative.length === 0) return '';
  const lines: string[] = [];

  if (cases.positive.length > 0) {
    lines.push('■ 과거 천부경 타로 해석에서 높은 만족도를 보인 사례 (긍정적 모범 사례)');
    lines.push('아래 사례들의 해석 패턴, 어조, 통찰력을 참고하여 이번 분석을 진행하십시오.\n');
    cases.positive.forEach((c, i) => {
      if (!c.tarotSnapshot) return;
      lines.push(`[모범 사례 ${i + 1}]`);
      lines.push(`  - 내담자 고민: "${c.tarotSnapshot.concern}"`);
      lines.push(`  - 뽑힌 카드 (과거/현재/미래): ${c.tarotSnapshot.cards.past} / ${c.tarotSnapshot.cards.present} / ${c.tarotSnapshot.cards.future}`);
      if (c.feedback.notes) lines.push(`  - 관리자 메모: ${c.feedback.notes}`);
      lines.push('');
    });
  }

  if (cases.negative.length > 0) {
    lines.push('■ 천부경 타로 해석 오류 교정 사례 (부정적 오류 사례)');
    lines.push('아래는 공감 부족이나 잘못된 방향성으로 지적받은 사례입니다. 관리자의 메모를 숙지하고 교정하십시오.\n');
    cases.negative.forEach((c, i) => {
      if (!c.tarotSnapshot) return;
      lines.push(`[오류 및 교정 사례 ${i + 1}]`);
      lines.push(`  - 내담자 고민: "${c.tarotSnapshot.concern}"`);
      lines.push(`  - 뽑힌 카드: ${c.tarotSnapshot.cards.past} / ${c.tarotSnapshot.cards.present} / ${c.tarotSnapshot.cards.future}`);
      if (c.feedback.notes) lines.push(`  - ★ 관리자의 강력한 교정 지시 메모: ${c.feedback.notes}`);
      lines.push('');
    });
  }

  return lines.join('\n');
};

/**
 * 피드백 통계 (HistoryManager 등에서 활용 가능)
 */
export const getFeedbackStats = async (): Promise<{
  total: number;
  satisfied: number;
  dissatisfied: number;
}> => {
  const all = await fetchFeedbacksFromCloud('body', 500);
  return {
    total: all.length,
    satisfied: all.filter((r) => r.feedback.physicalRating === 'very_satisfied' || r.feedback.physicalRating === 'satisfied').length,
    dissatisfied: all.filter((r) => r.feedback.physicalRating === 'very_dissatisfied' || r.feedback.physicalRating === 'dissatisfied').length,
  };
};
