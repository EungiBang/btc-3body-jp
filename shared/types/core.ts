// 세 개의 프로젝트에서 공통으로 사용되는 핵심 데이터 타입 정의

export interface UserInfo {
  name: string;
  gender: 'male' | 'female' | 'other';
  age: number;
  phone?: string;
  birthDate?: string;
  resultDelivery?: 'none' | 'sms' | 'kakao';
  memberType: 'new' | 'existing';
  previousRecordId?: string;
}

export interface PostureMetric {
  name: string;
  status: 'Good' | 'Fair' | 'Poor';
  description: string;
  score: number;
}

export interface StrengthMetric {
  exercise: string;
  reps: number;
  performance: string;
  formScore: number;
  recommendation: string;
}

export interface AgingMetric {
  testName: string;
  result: string;
  score: number;
  description?: string;
}

export interface BrainTrainingRecommendations {
  meditation: string;
  gymnastics: string;
  brainTraining: string;
}

export interface BrainTestData {
  reactionTimeMs?: number;
  reactionScore?: number;
  reactionErrors?: number;
  crossAccuracy?: number;
  crossAvgTimeMs?: number;
  memoryScore?: number;
  memorySpan?: number;
  memoryCorrect?: number;
  mathCorrect?: boolean;
  distractionCorrect?: number;
}

export interface BodyReport {
  id: string;
  date: string;
  userInfo: UserInfo;
  physicalAge: number;
  faceAgeEstimate: number;
  brainAge: number;
  mindAge?: number;
  comprehensiveAge: number;
  overallScore: number;
  bodyTypeAnalysis: string;
  postureMetrics: PostureMetric[];
  strengthMetrics: StrengthMetric[];
  agingMetrics: AgingMetric[];
  faceAnalysis: {
    skinTone: string;
    wrinkles: string;
    elasticity: string;
    summary: string;
    recommendation: string;
  };
  summary: string;
  brainHealthImplication: string;
  brainTestEvaluation?: string;
  recommendations: BrainTrainingRecommendations;
  threeBodyAnalysis: {
    body: { score: number; description: string };
    mind: { score: number; description: string };
    brain: { score: number; description: string };
  };
  sevenCodeAnalysis: {
    code1: { score: number; label: string; description: string; evidence: string[] };
    code2: { score: number; label: string; description: string; evidence: string[] };
    code3: { score: number; label: string; description: string; evidence: string[] };
    code4: { score: number; label: string; description: string; evidence: string[] };
    code5: { score: number; label: string; description: string; evidence: string[] };
    code6: { score: number; label: string; description: string; evidence: string[] };
    code7: { score: number; label: string; description: string; evidence: string[] };
  };
  kwangmyungChakra?: {
    needLevel: string;
    reason: string;
    expectedBenefit: string;
  };
  programRecommendation: {
    recommended: string;
    reason: string;
    duration: string;
  };
  comparisonAnalysis?: {
    previousDate: string;
    overallChange: string;
    summary: string;
    scoreChanges: {
      category: string;
      previousScore: number;
      currentScore: number;
      change: number;
      comment: string;
    }[];
    programEffect: string;
  };
  bodyAlignmentAnalysis?: {
    issue: string;
    severity: string;
    measuredValue: string;
    normalRange: string;
    impact: string;
    recommendation?: string;
  }[];
  bodyAlignmentAnalysisText?: string;
}

export interface CapturedImage {
  step: string;
  dataUrl: string;
  originalDataUrl?: string;
  reps?: number;
  duration?: number;
  brainTestData?: BrainTestData;
  balanceData?: { footDrops: number; swayScore: number; eyesClosed: boolean; };
  formScore?: number;
  kneeAssisted?: boolean;
  sevenCodeKeywords?: string[];
  weakestCode?: number;
  postureData?: any;
  type?: string;
}

export interface MemberRecord {
  id: string;
  name: string;
  lastTestDate: string;
  report: BodyReport;
  images: CapturedImage[];
  ownerUid?: string;
  branchId?: string;
  hardwareId?: string;
  regionId?: string;
  timestamp?: number;
  sourceType?: 'PC' | 'LITE';
  eventCode?: string;
}

export interface WaitingMember {
  id: string;
  name: string;
  phone: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  memberType: 'new' | 'existing';
  birthDate?: string;
  sevenCodeKeywords?: string[];
  weakestCode?: number; // 추가: 7코드 취약 번호
  branchId: string;
  eventCode?: string;
  status: 'waiting' | 'measuring' | 'completed';
  createdAt: number;
  isStarred?: boolean; // 추가: 집중 상담 별표 여부
}
