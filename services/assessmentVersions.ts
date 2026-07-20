// 측정 알고리즘의 최신 버전을 관리하고 추적하는 설정 파일
// 측정 알고리즘 버전 레지스트리 — PC/Lite 간 점수 산출 일관성을 추적하기 위한 버전 관리 시스템

/**
 * 각 테스트 알고리즘의 현재 버전.
 * 점수 산출 로직이 변경될 때마다 버전을 올리고, 이 파일 하단의 CHANGELOG에 변경 내역을 기록합니다.
 *
 * 버전 규칙.
 *   메이저(X.0): 점수 구간/배점 구조 변경
 *   마이너(X.Y): 기준값 미세 조정
 *   패치(X.Y.Z): 버그 수정 (로직 의도 변경 없음)
 */
export const TEST_ALGORITHM_VERSIONS = {
  // ── 신체 측정 ──
  postureFront: '2.0',      // 정면 자세 분석 (MoveNet 기하학적 수치 기반)
  postureSide: '2.0',       // 측면 자세 분석
  balance: '3.0',           // 한발 서기 균형 테스트
  // ── 뇌 기능 측정 ──
  brainMemory: '5.1',       // 마트 장보기 기억력 (Lite v5.1: 8개 기억, 4개 가격표시, 사칙연산 4지선다, 가격보였던 4개 합산 주관식)
  // ── AI 분석 ──
  faceAnalysis: '2.0',      // 안면 나이 추정
  sevenCodeCheck: '3.0',    // 7코드 에너지 체크 (긍정 키워드 8종 반영)
  // ── 종합 산출 ──
  physicalAge: '3.0',       // 종합 신체 나이 가중평균
  brainAge: '4.0',          // 종합 뇌 나이 (Lite v4.0: 기억나이만 사용, 실제 나이 기반 오프셋)
  mindAge: '3.0',           // 마음 나이 (7코드 긍정가중치 세분화, 부정 가중치 한도 +15세, 얼굴 및 신체 조절력 다차원 융합 보정)
  comprehensiveAge: '3.0',  // 3바디 종합 건강 나이
  overallScore: '3.0',      // 3바디 코어 밸런스 점수
} as const;

export type TestAlgorithmKey = keyof typeof TEST_ALGORITHM_VERSIONS;

/**
 * 현재 플랫폼의 측정 프로파일 정의.
 */
export interface AssessmentProfile {
  profileId: string;
  profileVersion: string;
  displayName: string;
  platform: 'PC' | 'LITE';
  supportedLocales: string[];
  testVersions: Partial<Record<TestAlgorithmKey, string>>;
  steps: string[];
  effectiveFrom: string;
  changelog: string;
}

/**
 * 현재 Lite 프로파일.
 */
export const CURRENT_PROFILE: AssessmentProfile = {
  profileId: 'BTC-2026Q3-LITE',
  profileVersion: '5.1.0L',
  displayName: 'BTC 코드맵 AI v5.1 (Lite)',
  platform: 'LITE',
  supportedLocales: ['ko-KR'],
  testVersions: {
    postureFront: TEST_ALGORITHM_VERSIONS.postureFront,
    postureSide: TEST_ALGORITHM_VERSIONS.postureSide,
    balance: TEST_ALGORITHM_VERSIONS.balance,
    brainMemory: TEST_ALGORITHM_VERSIONS.brainMemory,
    faceAnalysis: TEST_ALGORITHM_VERSIONS.faceAnalysis,
    sevenCodeCheck: TEST_ALGORITHM_VERSIONS.sevenCodeCheck,
    physicalAge: TEST_ALGORITHM_VERSIONS.physicalAge,
    brainAge: TEST_ALGORITHM_VERSIONS.brainAge,
    mindAge: TEST_ALGORITHM_VERSIONS.mindAge,
    comprehensiveAge: TEST_ALGORITHM_VERSIONS.comprehensiveAge,
    overallScore: TEST_ALGORITHM_VERSIONS.overallScore,
  },
  steps: [
    'SEVEN_CODE_CHECK', 'POSTURE_FRONT', 'POSTURE_SIDE',
    'BALANCE_TEST', 'BRAIN_MEMORY', 'FACE_ANALYSIS'
  ],
  effectiveFrom: '2026-07-04',
  changelog: '마트장보기 v5.1 업그레이드 및 마음나이 v3.0 다차원 융합 보정 알고리즘 탑재',
};

/**
 * 현재 MemberRecord에 첨부할 MeasurementVersion 객체를 생성합니다.
 */
export const buildMeasurementVersion = (locale: string = 'ko-KR') => ({
  assessmentProfileId: CURRENT_PROFILE.profileId,
  assessmentProfileVersion: CURRENT_PROFILE.profileVersion,
  appliedTestVersions: { ...CURRENT_PROFILE.testVersions } as Record<string, string>,
  platform: CURRENT_PROFILE.platform as 'PC' | 'LITE',
  appVersion: CURRENT_PROFILE.profileVersion,
  locale,
});

// ─── CHANGELOG ─────────────────────────────────────────────────────────────
// [2026-07-04] Lite v5.1.0L 업데이트
//   - brainMemory v5.1: 24개 물건 중 8개 기억 (이미지 전용, 천원 단위), 방해과제 2자리 사칙연산 객관식 4지선다, 가격이 보였던 4개 물건 총액 합산 주관식
//   - mindAge v3.0: 긍정 키워드 8종 추가 및 차감 가중치(-1세 ~ -3세) 세분화, 부정 가중치 한도 +15세 상향, 얼굴나이 편차(±2~4세) 및 신체균형나이 편차(±1.5~3세) 연동 보정
// [2026-07-04] 초기 등록 — Lite v5.0.8L
//   - 뇌나이 v4.0: toAge(score) = age + 15 - (score/100)*25, 실제 나이 기반 오프셋
//   - 반응속도 4단계: 400/550/700/900ms (1회 오류 패널티 대폭 강화)
//   - 마트장보기: 기억60 + 계산20 + 혼란10 + 속도10 = 100점
//   - 뇌나이 최종: 기억나이만 사용 (반응속도 테스트 미실시)
//   - weakestCode 기본값: 4 (1코드 편향 방지)
