// Dashboard component: renders 3-Body 7-Code AI assessment report in expert narrative order with tiered view control

import React, { useState } from 'react';
import { BodyReport, CapturedImage } from '../types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import FeedbackPanel from './FeedbackPanel';
import { BRAND_NAME, SUB_NAME } from '@shared/constants/brand';
import { getEnergyMbtiCode, ENERGY_MBTI_DATA } from '@shared/ai/scoring/mbti';
import { EnergyMbtiWebCard } from './EnergyMbtiWebCard';

// Sanitize AI text: replace 'chakra' with 'code' for backward compat with legacy saved results
const sanitize = (text: string | undefined | null): string => {
  if (!text) return '';
  return text
    .replace(/(\d)차크라/g, '$1코드')
    .replace(/차크라/g, '코드');
};

interface ReportDashboardProps {
  report: BodyReport;
  images: CapturedImage[];
  onRestart: () => void;
}

const SEVEN_CODE_NAMES: Record<number, { name: string; region: string; symptom: string; hint: string; label: string; location: string }> = {
  1: { name: '1-Code (Perineum)', region: 'Lower Body/Pelvis/Kidney', symptom: 'Basic energy deficiency, leg weakness, and spinal support instability', hint: 'Charge basic energy through squats and grounding training by pressing soles to the floor and strengthening lower abdomen.', label: 'Basic Energy', location: 'Perineum' },
  2: { name: '2-Code (Lower Danjeon)', region: 'Lower Abdomen/Danjeon/Large Intestine', symptom: 'Weakened vitality, cold lower abdomen, and stagnated energy due to poor bowel function', hint: 'Ignite the lower Danjeon fire with Danjeon tapping and abdominal breathing meditation.', label: 'Emotional Flow', location: 'Lower Danjeon' },
  3: { name: '3-Code (Jungwan)', region: 'Stomach/Solar Plexus/Liver', symptom: 'Reduced willpower, chronic indigestion, and lack of drive', hint: 'Boost your willpower through Jungwan relaxation and core strengthening exercises.', label: 'Drive & Will', location: 'Jungwan' },
  4: { name: '4-Code (Danjung)', region: 'Chest/Heart/Lung', symptom: 'Emotional stagnation, chest tightness, and chronic accumulated anger/stress', hint: 'Clear emotional congestion through chest-opening meditation and relaxing breathing.', label: 'Emotional Balance', location: 'Danjung' },
  5: { name: '5-Code (Honmun)', region: 'Throat/Shoulders/Thyroid', symptom: 'Stagnant expression, chronic neck and shoulder stiffness, and difficulty communicating feelings', hint: 'Relax the throat passage with neck/shoulder release movements and vocal meditation.', label: 'Communication', location: 'Honmun' },
  6: { name: '6-Code (Indang)', region: 'Brow/Brain/Eyes', symptom: 'Diminished intuition, heavy head, and reduced control over frontal lobe inhibition', hint: 'Clear your mind with Indang massage and brain gym exercises.', label: 'Focus & Insight', location: 'Brow' },
  7: { name: '7-Code (Baekhoe)', region: 'Crown/Brainwaves/Pineal Gland', symptom: 'Unstable integrated energy, sleep disturbances, and brainwave imbalance overload', hint: 'Align your center through Baekhoe brain breathing and brainwave relaxation meditation.', label: 'Life Direction', location: 'Baekhoe' }
};

const ReportDashboard: React.FC<ReportDashboardProps> = ({ report, images, onRestart }) => {
  const [copied, setCopied] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1.15);
  const [isSimpleView, setIsSimpleView] = useState(true); // Simple view / detailed view toggle state

  // Defensive null/undefined guard for images and report
  const safeImages = Array.isArray(images) ? images : [];
  const safeReport = report || {} as BodyReport;
  const userInfo = safeReport.userInfo || { name: 'Member', gender: 'female', age: 0 };

  const mbtiCode = (() => {
    try {
      return getEnergyMbtiCode(safeReport) || 'ESTP';
    } catch (e) {
      return 'ESTP';
    }
  })();

  const alignmentAnalysis = Array.isArray(safeReport.bodyAlignmentAnalysis) ? safeReport.bodyAlignmentAnalysis : [];
  const radarData = (safeReport.postureMetrics || []).map(m => ({
    subject: m?.name || 'Item',
    A: m?.score || 0,
    fullMark: 100,
  }));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Good': return 'text-emerald-500 bg-emerald-50';
      case 'Fair': return 'text-amber-500 bg-amber-50';
      case 'Poor': return 'text-rose-500 bg-rose-50';
      default: return 'text-slate-500 bg-slate-50';
    }
  };

  const handleShare = async () => {
    const mbtiInfo = ENERGY_MBTI_DATA[mbtiCode];
    const mbtiName = mbtiInfo ? mbtiInfo.name : 'Unknown Type';
    const mbtiDesc = mbtiInfo ? mbtiInfo.description : 'Analyzed Energy MBTI type based on assessment.';
    
    const activeWeakestCode = getWeakestFromReport();
    const codeInfo = SEVEN_CODE_NAMES[activeWeakestCode] || SEVEN_CODE_NAMES[4];

    const threeBody = safeReport.threeBodyAnalysis || {
      body: { score: 70, description: 'Posture alignment is slightly misaligned.' },
      mind: { score: 70, description: 'Mental tension is slightly high.' },
      brain: { score: 70, description: 'Brain cognitive response is average.' }
    };

    const shareText = [
      `[BTC CoreMap 3Body·7Code AI Scan - Lite Version]`,
      `━━━━━━━━━━━━━━━━━`,
      `👤 Member: ${userInfo.name} (${userInfo.gender === 'male' ? 'Male' : 'Female'}, Age ${userInfo.age})`,
      `📅 Date: ${new Date(safeReport.date || Date.now()).toLocaleDateString()}`,
      ``,
      `🔮 16 Energy Types`,
      `■ ${mbtiCode} (${mbtiName})`,
      `${mbtiDesc}`,
      ``,
      `📊 Core Analytics Metrics`,
      `• Biological Age: ${userInfo.age} yrs`,
      `• Integrated Balance Age: ${safeReport.comprehensiveAge || safeReport.physicalAge || 0} yrs`,
      `• Brain Age: ${safeReport.brainAge || 'N/A'} yrs`,
      `• Face Age: ${safeReport.faceAgeEstimate || 0} yrs`,
      `• Physical Age: ${safeReport.physicalAge || 0} yrs`,
      `• Mind Age: ${safeReport.mindAge || 'N/A'} yrs`,
      `• Core Balance Score: ${safeReport.overallScore || 0} pts`,
      ``,
      `🧬 3Body (Body·Mind·Brain) Summary`,
      `• Body (Physical Age ${safeReport.physicalAge || 0} yrs)`,
      `${sanitize(threeBody.body?.description) || 'Requires posture alignment management.'}`,
      `• Mind (Mind Age ${safeReport.mindAge || 'N/A'} yrs)`,
      `${sanitize(threeBody.mind?.description) || 'Requires relaxation adjustment to calm down the inner self.'}`,
      `• Brain (Brain Age ${safeReport.brainAge || 'N/A'} yrs)`,
      `${sanitize(threeBody.brain?.description) || 'Brain memory function is stable.'}`,
      ``,
      `⚡ 7-Code Energy Analysis (Priority Code)`,
      `■ ${codeInfo.name} (Governs ${codeInfo.region})`,
      `Currently, this code is depleted or stagnant. Main symptoms observed include: ${codeInfo.symptom}. Therefore, it is recommended: ${codeInfo.hint}`,
      ``,
      `💬 Overall Evaluation & Recommendations`,
      `"${sanitize(safeReport.summary) || ''}"`,
      ``,
      `━━━━━━━━━━━━━━━━━`,
      `📢 Visit your nearest branch to experience the precise [Full 3Body·7Code Test] for free. Receive customized 1:1 coaching and professional consultation to experience total balance and transformation.`,
      ``,
      `🏢 Brain Training Center (BTC)`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = shareText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const getWeakestFromReport = () => {
    if (!safeReport.sevenCodeAnalysis) return 4;
    const codes = [
      { id: 1, score: safeReport.sevenCodeAnalysis.code1?.score || 0 },
      { id: 2, score: safeReport.sevenCodeAnalysis.code2?.score || 0 },
      { id: 3, score: safeReport.sevenCodeAnalysis.code3?.score || 0 },
      { id: 4, score: safeReport.sevenCodeAnalysis.code4?.score || 0 },
      { id: 5, score: safeReport.sevenCodeAnalysis.code5?.score || 0 },
      { id: 6, score: safeReport.sevenCodeAnalysis.code6?.score || 0 },
      { id: 7, score: safeReport.sevenCodeAnalysis.code7?.score || 0 },
    ];
    codes.sort((a, b) => a.score - b.score);
    return codes[0].id;
  };

  const activeWeakestCode = getWeakestFromReport();
  const codeInfo = SEVEN_CODE_NAMES[activeWeakestCode] || SEVEN_CODE_NAMES[4];

  const specialized = (() => {
    if (!safeReport.sevenCodeAnalysis) {
      return { bodyFree: true, cleanBreath: true, mindFree: false, reason: "Recommended basic training flow." };
    }
    const analysis = safeReport.sevenCodeAnalysis;
    const rootSacralScore = Math.min(analysis.code1?.score || 0, analysis.code2?.score || 0);
    const solarHeartScore = Math.min(analysis.code3?.score || 0, analysis.code4?.score || 0);

    if (rootSacralScore <= solarHeartScore) {
      return {
        bodyFree: true,
        cleanBreath: true,
        mindFree: false,
        reason: "Lower centers (Codes 1 & 2) energy deficit detected. We recommend Body-Free Meditation and Clean Breathing to ground base vitality and restore physical strength."
      };
    } else {
      return {
        bodyFree: false,
        cleanBreath: true,
        mindFree: true,
        reason: "Middle/Upper centers (Code 3 & above) energy stagnation detected. We recommend Clean Breathing and Mind-Free Meditation to open chest congestion and purify emotional patterns."
      };
    }
  })();

  const renderImageWithOverlay = (img: CapturedImage, i: number) => {
    if (!img || !img.step) return null;
    const isPosture = img.step.includes('POSTURE');
    const isFace = img.step.includes('FACE');
    const isStrength = img.step.includes('STRENGTH');
    const isFront = img.step === 'POSTURE_FRONT';

    const getLabels = () => {
      if (!isPosture || alignmentAnalysis.length === 0) return [];
      const items = alignmentAnalysis;
      const posMap = [
        { kw: ['거북목', '머리', '전방두부', 'head'], top: '12%', view: 'side' },
        { kw: ['경추', '목'], top: '18%', view: 'both' },
        { kw: ['어깨', 'shoulder'], top: '28%', view: 'both' },
        { kw: ['흉추', '등', '척추', '라운드'], top: '38%', view: 'side' },
        { kw: ['골반', 'pelvis', 'hip'], top: '55%', view: 'both' },
        { kw: ['무릎', 'knee'], top: '70%', view: 'both' },
      ];
      return items.filter(it => it?.issue).map(it => {
        const iss = (it.issue || '').toLowerCase();
        const m = posMap.find(p => p.kw.some(k => iss.includes(k)));
        if (m && m.view !== 'both' && ((isFront && m.view === 'side') || (!isFront && m.view === 'front'))) return null;
        return { text: it.issue, severity: it.severity || 'Mild', top: m?.top || '45%' };
      }).filter(Boolean).slice(0, 3);
    };
    const labels = getLabels();
    const sevColor = (s: string) => s === 'Normal' ? 'bg-emerald-500/80 border-emerald-400' : s === 'Mild' ? 'bg-amber-500/80 border-amber-400' : 'bg-red-500/80 border-red-400';

    return (
      <div key={i} className="group relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900 aspect-[4/3]">
        <img src={img.dataUrl} className="w-full h-full object-contain relative z-10" alt={img.step} />
        
        {isPosture && labels.length > 0 && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            {labels.map((lb: any, idx: number) => (
              <div key={idx} className="absolute right-1" style={{ top: lb.top }}>
                <div className={`px-1.5 py-0.5 rounded text-[9px] font-black text-white border ${sevColor(lb.severity)} backdrop-blur-sm shadow-md`}>
                  {lb.severity === 'Normal' ? '✅' : lb.severity === 'Mild' ? '⚠️' : '🔴'} {sanitize(lb.text)}
                </div>
              </div>
            ))}
          </div>
        )}

        {isPosture && (
          <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">AI Body Scan</span>
          </div>
        )}

        {isFace && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
            <div className="w-[60%] h-[70%] border-2 border-dashed border-rose-400/60 rounded-[40%] shadow-[0_0_15px_rgba(251,113,133,0.4)] relative">
              <div className="absolute top-[40%] left-[10%] right-[10%] h-[1px] bg-rose-400/40"></div>
              <div className="absolute top-[10%] bottom-[10%] left-1/2 w-[1px] bg-rose-400/40 -translate-x-1/2"></div>
              <div className="absolute top-[40%] left-[25%] w-1.5 h-1.5 bg-rose-400 rounded-full"></div>
              <div className="absolute top-[40%] right-[25%] w-1.5 h-1.5 bg-rose-400 rounded-full"></div>
              <div className="absolute top-[65%] left-1/2 w-1.5 h-1.5 bg-rose-400 rounded-full -translate-x-1/2"></div>
            </div>
          </div>
        )}

        {isStrength && img.reps !== undefined && (
          <div className="absolute top-2 right-2 bg-indigo-600 text-white text-sm font-black px-3 py-1.5 rounded-lg shadow-md z-20">
            {img.reps} time(s)
          </div>
        )}

        <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm p-3 text-sm text-white font-bold text-center z-20">
          {img.step.includes('FRONT') ? 'Front Posture' :
           img.step.includes('SIDE') ? 'Side Posture' :
           img.step.includes('BALANCE') ? 'Balance Test' :
           img.step.includes('MEMORY') ? 'Memory Test' :
           img.step.includes('FACE') ? 'Face Scan' : img.step}
        </div>
      </div>
    );
  };

  const threeBody = safeReport.threeBodyAnalysis || {
    body: { score: 70, description: 'Posture alignment needs some adjustment.' },
    mind: { score: 70, description: 'Mind tension is somewhat elevated.' },
    brain: { score: 70, description: 'Brain cognitive response is average.' }
  };

  const getSevenCodeList = () => {
    const analysis = safeReport.sevenCodeAnalysis;
    if (!analysis) return [];

    // Auto-extract evidence keywords from body, brain, and face analysis data
    const getAdditionalEvidence = (codeId: number): string[] => {
      const extra: string[] = [];
      const alignment = Array.isArray(safeReport.bodyAlignmentAnalysis) ? safeReport.bodyAlignmentAnalysis : [];
      const hasPelvisIssue = alignment.some(it => it.issue && (it.issue.includes('골반') || it.issue.includes('pelvis')) && it.severity !== 'Normal');
      const hasShoulderIssue = alignment.some(it => it.issue && (it.issue.includes('어깨') || it.issue.includes('shoulder')) && it.severity !== 'Normal');
      const hasNeckIssue = alignment.some(it => it.issue && (it.issue.includes('목') || it.issue.includes('경추') || it.issue.includes('head')) && it.severity !== 'Normal');
      const hasTrunkIssue = alignment.some(it => it.issue && (it.issue.includes('체간') || it.issue.includes('기울기')) && it.severity !== 'Normal');

      const hasBalanceIssue = (safeReport.agingMetrics || []).some(it => it.testName && (it.testName.includes('눈') || it.testName.includes('한발') || it.testName.includes('균형')) && it.score < 80);
      const hasSquatIssue = (safeReport.strengthMetrics || []).some(it => it.exercise && it.exercise.includes('스쿼트') && it.formScore < 80);
      const hasPushupIssue = (safeReport.strengthMetrics || []).some(it => it.exercise && it.exercise.includes('푸시업') && it.formScore < 80);

      const reactionData = safeImages.find(img => img.step === ('BRAIN_REACTION' as any))?.brainTestData;
      const memoryData = safeImages.find(img => img.step === 'BRAIN_MEMORY')?.brainTestData;
      const isBrainSlow = reactionData && reactionData.reactionTimeMs && reactionData.reactionTimeMs > 800;
      const isBrainError = reactionData && reactionData.reactionErrors && reactionData.reactionErrors > 1;
      const isMemoryWeak = memoryData && (memoryData.memoryCorrect ?? memoryData.memorySpan ?? 6) < 4;

      const hasWrinkles = typeof safeReport.faceAnalysis?.wrinkles === 'string' && !safeReport.faceAnalysis.wrinkles.includes('없음') && !safeReport.faceAnalysis.wrinkles.includes('양호') && !safeReport.faceAnalysis.wrinkles.includes('none') && !safeReport.faceAnalysis.wrinkles.includes('good');
      const hasElasticityIssue = typeof safeReport.faceAnalysis?.elasticity === 'string' && (safeReport.faceAnalysis.elasticity.includes('저하') || safeReport.faceAnalysis.elasticity.includes('약화') || safeReport.faceAnalysis.elasticity.includes('decline') || safeReport.faceAnalysis.elasticity.includes('weak'));

      if (codeId === 1) {
        if (hasPelvisIssue) extra.push("Pelvis Misalignment Detected");
        if (hasSquatIssue) extra.push("Lower Body Support Instability");
        if (hasBalanceIssue) extra.push("Weakened Core/Lower Body Balance");
      }
      if (codeId === 2) {
        if (hasPelvisIssue) extra.push("Pelvic Area Tension");
        if (hasSquatIssue) extra.push("Decreased Lower Core Stability");
        if (safeReport.physicalAge > userInfo.age) extra.push("Accelerated Body Aging Detected");
      }
      if (codeId === 3) {
        if (hasTrunkIssue) extra.push("Trunk Alignment Imbalance");
        if (hasSquatIssue || hasPushupIssue) extra.push("Decreased Core Dynamic Stability");
      }
      if (codeId === 4) {
        if (hasShoulderIssue) extra.push("Shoulder Alignment Imbalance");
        if (hasPushupIssue) extra.push("Decreased Upper Body/Chest Support");
      }
      if (codeId === 5) {
        if (hasNeckIssue) extra.push("Forward Head/Neck Alignment Imbalance");
        if (hasShoulderIssue) extra.push("Neck & Shoulder Tension Detected");
      }
      if (codeId === 6) {
        if (isBrainSlow) extra.push("Delayed Cognitive Reaction Time");
        if (isBrainError) extra.push("Reduced Frontal Lobe Inhibitory Control");
        if (hasWrinkles) extra.push("Accumulation of Facial Tension Wrinkles");
      }
      if (codeId === 7) {
        if (isMemoryWeak) extra.push("Delayed Working Memory Retrieval");
        if (safeReport.brainAge > userInfo.age) extra.push("Accelerated Brain Aging Detected");
        if (hasElasticityIssue) extra.push("Increased Facial Fatigue / Reduced Elasticity");
      }
      
      return extra;
    };

    return [
      { id: 1, color: '#EF4444', label: '1-Code - Base Energy (Location: Root)', score: analysis.code1?.score || 0, description: sanitize(analysis.code1?.description), evidence: [...(analysis.code1?.evidence || []), ...getAdditionalEvidence(1)], bgGrad: 'from-red-500 to-red-600' },
      { id: 2, color: '#F97316', label: '2-Code - Emotional Flow (Location: Sacral)', score: analysis.code2?.score || 0, description: sanitize(analysis.code2?.description), evidence: [...(analysis.code2?.evidence || []), ...getAdditionalEvidence(2)], bgGrad: 'from-orange-500 to-orange-600' },
      { id: 3, color: '#FACC15', label: '3-Code - Drive & Power (Location: Solar Plexus)', score: analysis.code3?.score || 0, description: sanitize(analysis.code3?.description), evidence: [...(analysis.code3?.evidence || []), ...getAdditionalEvidence(3)], bgGrad: 'from-yellow-500 to-yellow-600' },
      { id: 4, color: '#10B981', label: '4-Code - Emotional Balance (Location: Heart)', score: analysis.code4?.score || 0, description: sanitize(analysis.code4?.description), evidence: [...(analysis.code4?.evidence || []), ...getAdditionalEvidence(4)], bgGrad: 'from-emerald-500 to-emerald-600' },
      { id: 5, color: '#3B82F6', label: '5-Code - Communication (Location: Throat)', score: analysis.code5?.score || 0, description: sanitize(analysis.code5?.description), evidence: [...(analysis.code5?.evidence || []), ...getAdditionalEvidence(5)], bgGrad: 'from-cyan-500 to-cyan-600' },
      { id: 6, color: '#4338CA', label: '6-Code - Focus & Insight (Location: Indang)', score: analysis.code6?.score || 0, description: sanitize(analysis.code6?.description), evidence: [...(analysis.code6?.evidence || []), ...getAdditionalEvidence(6)], bgGrad: 'from-indigo-500 to-indigo-600' },
      { id: 7, color: '#8B5CF6', label: '7-Code - Life Direction (Location: Baekhoe)', score: analysis.code7?.score || 0, description: sanitize(analysis.code7?.description), evidence: [...(analysis.code7?.evidence || []), ...getAdditionalEvidence(7)], bgGrad: 'from-violet-500 to-violet-600' }
    ];
  };

  const sevenCodeList = getSevenCodeList();

  const getChakraGrade = (score: number) => {
    if (score >= 80) return { text: 'Stable', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (score >= 60) return { text: 'Warning', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { text: 'Focused', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 font-black' };
  };

  const isEn = true;

  return (
    <div className="flex-1 bg-white overflow-auto print:p-0 print:overflow-visible relative text-slate-800 animate-fade-in-up">
      
      {/* Font size adjustment bar */}
      <div className="sticky top-4 right-4 z-50 flex justify-end print:hidden pointer-events-none" style={{ height: 0 }}>
         <div className="bg-white/90 backdrop-blur shadow-lg border border-slate-200 rounded-full px-4 py-2 flex items-center gap-3 pointer-events-auto">
            <span className="text-xs font-bold text-slate-500">Font Size</span>
            <button onClick={() => setZoomLevel(prev => Math.max(0.8, prev - 0.1))} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 font-bold transition-colors">-</button>
            <span className="text-sm font-black text-indigo-600 w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
            <button onClick={() => setZoomLevel(prev => Math.min(1.8, prev + 0.1))} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 font-bold transition-colors">+</button>
         </div>
      </div>
      
      <div className="p-6 md:p-10 space-y-12 pb-24" style={{ zoom: zoomLevel }}>
        
        {/* [0] User info banner */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-5 shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">👤</div>
            <div>
              <h2 className="text-white font-black text-xl">{userInfo.name} <span className="text-white/70 font-bold text-base ml-1">'s Wellness Report</span></h2>
              <p className="text-white/60 text-sm font-medium mt-0.5">{userInfo.gender === 'male' ? 'Male' : 'Female'} · Age {userInfo.age} · {new Date(safeReport.date || Date.now()).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* [1] AI analysis reliability badge */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
              <i className="fas fa-shield-alt text-lg"></i>
            </div>
            <div className="text-left">
              <h4 className="text-white font-bold text-sm flex items-center gap-2">
                🔬 {BRAND_NAME} {'Analysis Reliability'} <span className="text-indigo-400">92%</span>
              </h4>
              <p className="text-slate-400 text-[10px] font-medium mt-0.5">{'Cross-validation complete for posture, balance, response, and face metrics'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 justify-center md:justify-end">
            {(['Front Posture', 'Side Alignment', 'Balance Data', 'Brain Response', 'Face Brightness', '7-Code Pattern']).map((check) => (
              <span key={check} className="text-[9px] bg-slate-950/80 text-emerald-400 border border-emerald-900/30 px-2 py-0.5 rounded-md font-black">
                ✓ {check}
              </span>
            ))}
          </div>
        </div>

        {/* [2] 3-Body age cards */}
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 print:grid-cols-7">
            <div className="bg-slate-50 py-6 px-4 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center">
                <span className="text-slate-500 text-xs font-bold uppercase mb-2">{'Chronological Age'}</span>
                <div className="text-4xl font-black text-slate-800 mb-1">{userInfo.age}<span className="text-xl ml-1">{' yrs'}</span></div>
            </div>
            <div className="bg-slate-50 py-6 px-4 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center">
                <span className="text-slate-500 text-xs font-bold uppercase mb-2">{'Physical Age'}</span>
                <div className="text-4xl font-black text-indigo-600 mb-1">{safeReport.physicalAge || 0}<span className="text-xl ml-1">{' yrs'}</span></div>
            </div>
            <div className="bg-slate-50 py-6 px-4 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center">
                <span className="text-slate-500 text-xs font-bold uppercase mb-2">{'Face Age'}</span>
                <div className="text-4xl font-black text-rose-500 mb-1">{safeReport.faceAgeEstimate || 0}<span className="text-xl ml-1">{' yrs'}</span></div>
            </div>
            <div className="bg-slate-50 py-6 px-4 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center">
                <span className="text-slate-500 text-xs font-bold uppercase mb-2">{'Brain Age'}</span>
                <div className="text-4xl font-black text-amber-500 mb-1">{safeReport.brainAge || '-'}<span className="text-xl ml-1">{' yrs'}</span></div>
            </div>
            <div className="bg-slate-50 py-6 px-4 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center">
                <span className="text-slate-500 text-xs font-bold uppercase mb-2">{'Mind Age'}</span>
                <div className="text-4xl font-black text-fuchsia-500 mb-1">{safeReport.mindAge || '-'}<span className="text-xl ml-1">{' yrs'}</span></div>
            </div>

            <div className="bg-emerald-600 py-6 px-4 rounded-3xl flex flex-col items-center justify-center text-center text-white shadow-md shadow-emerald-200">
                <span className="text-emerald-100 text-xs font-bold uppercase mb-2">{'Integrated Balance Age'}</span>
                <div className="text-4xl font-black mb-1">{safeReport.comprehensiveAge || safeReport.physicalAge || 0}<span className="text-xl text-emerald-200 ml-1">{' yrs'}</span></div>
            </div>
            <div className="bg-indigo-600 py-6 px-4 rounded-3xl flex flex-col items-center justify-center text-center text-white shadow-md shadow-indigo-200">
                <span className="text-indigo-200 text-xs font-bold uppercase mb-2">{'Core Balance Score'}</span>
                <div className="text-4xl font-black mb-1">{safeReport.overallScore || 0}<span className="text-xl text-indigo-200 ml-1">{' pts'}</span></div>
            </div>
          </div>
        </div>

        {/* [3] Assessment data evidence */}
        {safeImages.length > 0 && (
        <section>
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <i className="fas fa-camera text-indigo-500"></i>
            {'Capture Evidence'} {isSimpleView && <span className="text-xs text-slate-400 font-bold">{'(Summary)'}</span>}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {safeImages
              .filter(img => img && img.step && !['FACE_ANALYSIS', 'BRAIN_REACTION', 'BRAIN_MEMORY', 'SEVEN_CODE_CHECK', 'USER_NEEDS'].includes(img.step))
              .slice(0, isSimpleView ? 2 : undefined)
              .map((img, i) => renderImageWithOverlay(img, i))}
          </div>
        </section>
        )}

        {/* ========================================================
            1. Physical Body Analysis (Hardware)
           ======================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start text-left">
          
          {/* Body alignment & balance analysis (50% summary in simple view, radar chart overlay) */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <span>🦴</span> {'Body Alignment & Balance Analysis'} {isSimpleView && <span className="text-xs text-rose-500 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md font-bold">{'50% Summary'}</span>}
            </h3>
            
            {safeReport.bodyTypeAnalysis && (
              <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                <h4 className="text-sm font-bold text-indigo-500 mb-1">{'AI Comprehensive Body Analysis'}</h4>
                <p className="text-lg font-black text-indigo-900">{sanitize(safeReport.bodyTypeAnalysis)}</p>
              </div>
            )}

            {alignmentAnalysis.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-1">
                  🦴 {'Body Misalignment Analysis (AI Measurement)'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {alignmentAnalysis
                    .slice(0, isSimpleView ? Math.ceil(alignmentAnalysis.length / 2) : undefined)
                    .map((item: any, i: number) => {
                      const severityConfig: Record<string, { bg: string, text: string, border: string }> = {
                        'Normal': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
                        'Mild': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
                        'Warning': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
                        'Severe': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
                      };
                      
                      const severityEn: Record<string, string> = { 'Normal': 'Normal', 'Mild': 'Mild', 'Warning': 'Warning', 'Severe': 'Severe' };
                      const cfg = severityConfig[item?.severity] || severityConfig['Mild'];
                      return (
                        <div key={i} className={`p-3 rounded-xl border ${cfg.border} ${cfg.bg}`}>
                          <div className="flex items-center justify-between mb-1">
                            <h5 className="font-bold text-slate-800 text-sm">{sanitize(item?.issue)}</h5>
                            <span className={`px-2 py-0.5 rounded-md text-xs font-black ${cfg.text} ${cfg.bg} border ${cfg.border}`}>
                              {isEn ? (severityEn[item?.severity] || item?.severity) : item?.severity}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mb-1">
                            {item?.measuredValue && String(item.measuredValue).trim() !== '' && !String(item.measuredValue).includes('N/A') && (
                              <>
                                {'Measured'} <strong className="text-slate-700">{sanitize(item?.measuredValue)}</strong>
                                <span className="mx-1">|</span>
                              </>
                            )}
                            {'Normal Range'} {sanitize(item?.normalRange)}
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{sanitize(item?.impact)}</p>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Radar chart rendered in simple view but blurred to spark curiosity */}
            <div className="relative h-64 mb-6">
              <div className={`w-full h-full ${isSimpleView ? 'filter blur-[5px] opacity-35 select-none pointer-events-none' : ''}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Radar name={'Posture'} dataKey="A" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.4} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              {isSimpleView && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/20 backdrop-blur-[1px] rounded-2xl border border-slate-100 shadow-sm p-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-505 mb-2 border border-indigo-100">
                    <i className="fas fa-lock"></i>
                  </div>
                  <span className="text-[11px] text-slate-700 font-bold tracking-tight">{'Posture Balance Chart Locked'}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5 text-center leading-snug">{'Schedule counseling to unlock the detailed 3D balance map.'}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {(safeReport.postureMetrics || [])
                .slice(0, isSimpleView ? Math.ceil((safeReport.postureMetrics || []).length / 2) : undefined)
                .map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex-1">
                      <h5 className="font-bold text-slate-800 text-base">{sanitize(item?.name)}</h5>
                      <p className="text-sm font-medium text-slate-600 leading-snug">{sanitize(item?.description)}</p>
                    </div>
                    <span className={`ml-2 px-3 py-1.5 rounded-lg text-sm font-black ${getStatusColor(item?.status || 'Good')}`}>
                      {item?.score}{' pts'}
                    </span>
                  </div>
                ))}
            </div>
            
            {isSimpleView && (
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white via-white/80 to-transparent flex items-end justify-center pb-3 pointer-events-none">
                <span className="text-xs text-rose-500 font-black bg-rose-50 px-3 py-1 rounded-full border border-rose-100 shadow-sm pointer-events-auto">{'🔒 Remaining 50% analysis is locked'}</span>
              </div>
            )}
          </div>

          {/* Functional performance details (50% exposed, balance advice hidden, wellness enhanced) */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden space-y-6">
            <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
              <i className="fas fa-dumbbell text-indigo-550"></i>
              {'Functional Performance Details'} {isSimpleView && <span className="text-xs text-rose-500 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md font-bold">{'50% Summary'}</span>}
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              {(safeReport.strengthMetrics || [])
                .slice(0, isSimpleView ? Math.ceil((safeReport.strengthMetrics || []).length / 2) : undefined)
                .map((item, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                      <div className="flex justify-between items-center mb-2">
                          <h5 className="font-bold text-indigo-900 text-base">{sanitize(item?.exercise)}</h5>
                          <div className="text-right">
                            <span className="text-sm font-black text-indigo-600 block">{'Form Score: '}{item?.formScore}{' pts'}</span>
                            {item?.reps > 0 && <span className="text-sm font-bold text-indigo-500 block">{'Reps: '}{item?.reps}{' reps'}</span>}
                          </div>
                      </div>
                      <p className="text-sm font-medium text-indigo-800 mb-3">{sanitize(item?.performance)}</p>
                      <p className="text-sm font-bold text-indigo-700 bg-indigo-100/60 p-3 rounded-lg">💡 {sanitize(item?.recommendation)}</p>
                  </div>
                ))}

              {(safeReport.agingMetrics || [])
                .slice(0, isSimpleView ? Math.ceil((safeReport.agingMetrics || []).length / 2) : undefined)
                .map((item, i) => {
                  const isBalanceTest = item?.testName && (String(item.testName).includes('눈') || String(item.testName).includes('한발') || String(item.testName).includes('균형') || String(item.testName).toLowerCase().includes('balance') || String(item.testName).toLowerCase().includes('one-leg'));
                  const isBrainTest = item?.testName && (String(item.testName).includes('뇌') || String(item.testName).includes('두뇌') || String(item.testName).includes('인지') || String(item.testName).includes('반응') || String(item.testName).includes('기억') || String(item.testName).toLowerCase().includes('brain') || String(item.testName).toLowerCase().includes('cognitive') || String(item.testName).toLowerCase().includes('memory'));
                  
                  // Hide balance test advice and brain function test advice in simple view
                  const showDesc = (isBalanceTest || isBrainTest) ? (!isSimpleView && item.description) : item.description;
                  
                  return (
                    <div key={i} className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100">
                        <div className="flex justify-between items-center mb-2">
                            <h5 className="font-bold text-rose-900 text-base">{sanitize(item.testName)}</h5>
                            <span className="text-base font-black text-rose-600">{item.score}{' pts'}</span>
                        </div>
                        <p className="text-sm font-medium text-rose-800">{sanitize(item.result)}</p>
                        
                        {/* Balance test importance and detailed guide always visible */}
                        {isBalanceTest && (
                          <div className="mt-3 p-4 bg-white/80 border border-rose-200/60 rounded-xl space-y-2">
                            <h6 className="text-xs font-black text-rose-600 flex items-center gap-1">
                              <span>🎯</span> {'Importance and Causes of Single-Leg Stance with Eyes Closed'}
                            </h6>
                            <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                              {isEn 
                                ? 'Single-leg stance with eyes closed is a crucial aging screening metric that checks your body\'s proprioception (somatosensory), inner ear balance (vestibular), and cerebellum/brain function that coordinates them by blocking vision.'
                                : 'The single-leg stance with eyes closed is a critical aging screening indicator. By eliminating visual input, it comprehensively evaluates your <strong>proprioceptive (somatic) sense</strong>, the inner ear\'s <strong>vestibular balance</strong>, and the cerebellum/brain function that coordinates them.'}
                            </p>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              {isEn
                                ? 'If this metric is average or low, it means not only a lack of simple muscular strength, but also that support for the lower thigh and core muscles that keep the body balanced is weakened, and the transmission rhythm of proprioceptive nerves has slowed down or misalignment of the body has accumulated. Also, balance maintenance significantly decreases when brain fatigue is high due to insomnia, fatigue, etc.'
                                : 'An average or low score does not simply mean muscle weakness. It indicates decreased support from lower-body thigh muscles and core strength, slowed proprioceptive nerve signal transmission, and accumulated postural misalignment. Additionally, sleep deprivation and chronic fatigue When brain fatigue from sleep deprivation or chronic stress is high, balance maintenance capacity significantly decreases.'}
                            </p>
                          </div>
                        )}

                        {showDesc ? (
                            <p className="text-sm font-bold text-rose-700 bg-rose-100/60 p-3 rounded-lg mt-3 leading-relaxed">
                                💡 {sanitize(item.description)}
                            </p>
                        ) : (
                          (isBalanceTest || isBrainTest) && isSimpleView && (
                            <p className="text-xs text-rose-550/80 font-bold bg-rose-100/40 p-2 rounded-lg mt-2 text-center">
                              🔒 {'🔒 Detailed solution advice will be unlocked upon scheduling counseling.'}
                            </p>
                          )
                        )}
                    </div>
                  );
                })}
            </div>

            {isSimpleView && (
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white via-white/80 to-transparent flex items-end justify-center pb-3 pointer-events-none">
                <span className="text-xs text-rose-500 font-black bg-rose-50 px-3 py-1 rounded-full border border-rose-100 shadow-sm pointer-events-auto">{'🔒 Remaining 50% analysis is locked'}</span>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================
            2. Brain Area Analysis (Brain Body - Software)
            Visible in simple view, detailed advice has lock overlay
           ======================================================== */}
        {safeReport.brainTestEvaluation && (
          <section className="bg-white p-8 rounded-3xl border border-slate-200 relative overflow-hidden text-left shadow-sm">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-amber-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2 relative z-10">
              <i className="fas fa-brain text-amber-500"></i>
              {'Brain Health & Memory Detail Analysis'}
            </h3>
            <div className="relative p-4 bg-amber-50/50 border border-amber-100 rounded-2xl relative z-10 overflow-hidden min-h-[100px]">
              <div className={`${isSimpleView ? 'filter blur-[4px] opacity-40 select-none pointer-events-none' : ''}`}>
                <p className="text-sm font-medium text-amber-900 leading-relaxed">{sanitize(safeReport.brainTestEvaluation)}</p>
              </div>
              {isSimpleView && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-amber-50/10 backdrop-blur-[1px] p-4 text-center">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-1 border border-amber-200">
                    <i className="fas fa-lock"></i>
                  </div>
                  <span className="text-[11px] text-amber-900 font-bold">{'Detailed Brain Cognitive Health Guide Locked'}</span>
                  <span className="text-[10px] text-amber-500 mt-0.5 leading-snug">{'Unlock prefrontal activation solutions through professional consultation.'}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 relative z-10">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/60">
                <h4 className="text-sm font-bold text-slate-500 uppercase mb-3 flex items-center gap-1.5">
                  🧠 {'Cognitive Reaction Time'}
                </h4>
                <p className="text-base font-black text-slate-800 mb-1">
                  {'Average Reaction Speed: '}{safeImages.find(img => img.step === ('BRAIN_REACTION' as any))?.brainTestData?.reactionTimeMs || 'N/A'}{' ms'}
                </p>
                <p className="text-xs font-semibold text-rose-500">
                  {'Impulse Control Errors: '}{safeImages.find(img => img.step === ('BRAIN_REACTION' as any))?.brainTestData?.reactionErrors || 0}{' times'}
                </p>
                <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                  {'Cognitive speed measures the speed of brain processing and neural signal transmission. Frequent errors indicate decreased frontal lobe inhibitory control, meaning responses are made before processing is complete.'}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/60 relative overflow-hidden">
                <h4 className="text-sm font-bold text-slate-500 uppercase mb-3 flex items-center gap-1.5">
                  🛒 {'Grocery Shopping Memory Capacity'}
                </h4>
                <p className="text-base font-black text-slate-800 mb-1">
                  {'Working Memory Span: '}{safeImages.find(img => img.step === 'BRAIN_MEMORY')?.brainTestData?.memorySpan || 'N/A'}{' items'}
                </p>
                <p className="text-xs font-semibold text-emerald-600">
                  {'Arithmetic distraction accuracy: '}{safeImages.find(img => img.step === 'BRAIN_MEMORY')?.brainTestData?.distractionCorrect ?? 0}{'/2 Correct'}
                </p>
                <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                  {'The Grocery Memory Test measures the working memory capacity of the hippocampus and prefrontal cortex. It comprehensively evaluates your ability to accurately recall 8 items while performing arithmetic distractions and mental calculations.'}
                </p>
                {isSimpleView && (
                  <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-50 to-transparent flex items-end justify-center pb-2 pointer-events-none">
                    <span className="text-[10px] text-slate-400 font-bold bg-white px-2 py-0.5 rounded-full border border-slate-200 shadow-sm pointer-events-auto">🔒 {'Detailed guide is locked'}</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ========================================================
            3. Face Area Analysis (Skin Face - Software)
            Visible in simple view, detailed advice has lock overlay
           ======================================================== */}
        {safeReport.faceAnalysis && (
          <section className="bg-white p-8 rounded-3xl border border-slate-200 relative overflow-hidden text-left shadow-sm">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-rose-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2 relative z-10">
              <span>👤</span> {'3D Face Aging Analysis / 50% Preview'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                {safeReport.faceAnalysis.skinTone && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0 mt-1">
                    <i className="fas fa-sun text-rose-500 text-sm"></i>
                  </div>
                  <div>
                    <h5 className="text-base font-bold text-slate-855">{'Skin Tone & Brightness'}</h5>
                    <p className="text-sm font-medium text-slate-700 leading-relaxed">{sanitize(safeReport.faceAnalysis.skinTone)}</p>
                  </div>
                </div>
                )}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0 mt-1">
                    <i className="fas fa-water text-rose-500 text-sm"></i>
                  </div>
                  <div>
                    <h5 className="text-base font-bold text-slate-855">{'Skin Elasticity'}</h5>
                    <p className="text-sm font-medium text-slate-700 leading-relaxed">{sanitize(safeReport.faceAnalysis.elasticity)}</p>
                  </div>
                </div>
                {/* 50% preview: blur remaining items when isSimpleView is active */}
                <div className={`${isSimpleView ? 'relative' : ''}`}>
                  <div className={`space-y-4 ${isSimpleView ? 'filter blur-[6px] opacity-40 select-none pointer-events-none' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0 mt-1">
                        <i className="fas fa-wave-square text-rose-500 text-sm"></i>
                      </div>
                      <div>
                        <h5 className="text-base font-bold text-slate-855">{'Wrinkles & Contours'}</h5>
                        <p className="text-sm font-medium text-slate-700 leading-relaxed">{sanitize(safeReport.faceAnalysis.wrinkles)}</p>
                      </div>
                    </div>
                    <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <h5 className="text-sm font-bold text-slate-500 uppercase mb-2">{'Face Comprehensive Evaluation'}</h5>
                      <p className="text-base text-slate-800 font-bold">{sanitize(safeReport.faceAnalysis.summary)}</p>
                    </div>
                    {safeReport.faceAnalysis.recommendation && (
                      <div className="mt-4 p-4 bg-rose-50 rounded-xl border border-rose-100">
                        <h5 className="text-sm font-bold text-rose-500 uppercase mb-2">{'Personalized Improvement Solution'}</h5>
                        <p className="text-base text-rose-800 font-bold">{sanitize(safeReport.faceAnalysis.recommendation)}</p>
                      </div>
                    )}
                  </div>
                  {isSimpleView && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <div className="bg-rose-500/80 backdrop-blur-sm px-5 py-2.5 rounded-xl border border-rose-400/30 flex items-center gap-2 shadow-lg">
                        <i className="fas fa-lock text-rose-100 text-xs"></i>
                        <span className="text-xs text-white font-bold">{'Detailed results will be unlocked after scheduling counseling'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
          </section>
        )}

        {/* ========================================================
            3. Energy & 7-Code Analysis (Energy Body - Core Energy)
            Dark/navy gradient style restored, 100% visible
           ======================================================== */}
        <section className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-[40px] p-8 md:p-12 text-white text-left">
          
          {/* 3-Body balance analysis */}
          <div className="text-center mb-10">
            <span className="text-cyan-400 text-sm font-bold uppercase tracking-[0.3em]">3BODY ANALYSIS</span>
            <h3 className="text-4xl font-black mt-3">{'3-Body Balance Analysis'}</h3>
            <p className="text-slate-300 text-base mt-3 font-medium">{'Integrated balance of Physical, Energy, and Brain'}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {[
              { key: 'body', icon: '🏃', title: 'PHYSICAL BODY (Physical Vitality & Core)', color: 'from-emerald-500 to-teal-600', data: threeBody.body },
              { key: 'mind', icon: '💚', title: 'ENERGY BODY (Emotional & Energy Balance)', color: 'from-violet-500 to-purple-600', data: threeBody.mind },
              { key: 'brain', icon: '🧠', title: 'INFORMATION BODY (Brain Cognition & Focus)', color: 'from-amber-500 to-orange-600', data: threeBody.brain }
            ].map(item => (
              <div key={item.key} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6 text-center">
                <div className="text-5xl mb-4">{item.icon}</div>
                <h4 className="font-bold text-xl mb-3">{item.title}</h4>
                <div className={`text-5xl font-black bg-gradient-to-r ${item.color} bg-clip-text text-transparent mb-4`}>
                  {item.data?.score || 0}{' pts'}
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-4">
                  <div className={`h-full bg-gradient-to-r ${item.color} rounded-full transition-all duration-1000`} style={{ width: `${item.data?.score || 0}%` }} />
                </div>
                <p className="text-base text-slate-200 leading-relaxed font-medium">{sanitize(item.data?.description)}</p>
              </div>
            ))}
          </div>

          {/* 7-Code energy analysis */}
          <div className="mt-10 pt-10 border-t border-white/10">
            <div className="text-center mb-8">
              <span className="text-amber-400 text-sm font-bold uppercase tracking-[0.3em]">7CODE ENERGY</span>
              <h3 className="text-3xl font-black mt-3">{'7-Code Energy Analysis'}</h3>
              <p className="text-slate-300 text-base mt-2 font-medium">{'Analyzing your energy flow through 7 key codes'}</p>
            </div>
            
            <div className="space-y-4">
              {sevenCodeList.map(item => {
                const activeWeakestCode = getWeakestFromReport();
                const isWeakest = item.id === activeWeakestCode;
                const grade = getChakraGrade(item.score);
                
                const activeCodeNames = SEVEN_CODE_NAMES;
                const labelText = activeCodeNames[item.id]?.name || item.label;

                return (
                  <div key={item.id} className={`bg-white/5 rounded-2xl p-5 border transition-all ${isWeakest ? 'border-amber-400/80 bg-white/10 ring-1 ring-amber-400/30 shadow-md' : 'border-white/10'}`}>
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.bgGrad} flex items-center justify-center font-black text-white text-lg shrink-0 shadow-md`}>
                        {item.id}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-base text-white flex items-center gap-2">
                            {labelText}
                            {isWeakest && (
                              <span className="text-[9px] font-black text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                🚨 Weakest
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-black/45 border text-[10px] font-black text-amber-400 border-amber-900/30 rounded-md">
                              {grade.text}
                            </span>
                            <span className="text-base font-black text-white ml-1">{item.score} pts</span>
                          </div>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                          <div className={`h-full bg-gradient-to-r ${item.bgGrad} rounded-full transition-all duration-1000`} style={{ width: `${item.score}%` }} />
                        </div>
                        <p className="text-sm font-medium text-slate-300 mb-2">{item.description}</p>
                        {item.evidence && item.evidence.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {item.evidence.map((ev, idx) => (
                              <span key={idx} className="px-2 py-0.5 bg-white/10 rounded-md text-[11px] text-emerald-200 border border-emerald-500/30">
                                ✓ {sanitize(ev)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 3-Body 7-Code core analysis */}
        {(() => {
          const activeWeakestCode = getWeakestFromReport();
          const activeCodeNames = SEVEN_CODE_NAMES;
          const codeInfo = activeCodeNames[activeWeakestCode] || activeCodeNames[4];
          return (
            <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-left shadow-lg relative overflow-hidden">
              <div className="absolute right-0 top-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
              <h3 className="text-lg font-black text-amber-400 mb-3 flex items-center gap-2">
                <span>💡</span> Today's Core Analysis (Weakest Code Charge Guide)
              </h3>
              <p className="text-sm font-semibold text-slate-300 leading-relaxed mb-4">
                Out of your 7 energy codes, the one requiring activation is <strong className="text-white bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">{codeInfo.name}</strong>.
              </p>
            </section>
          );
        })()}

        {/* Energy MBTI temperament status */}
        <section className="text-left">
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <i className="fas fa-magic text-indigo-550"></i>
            🔮 16 Energy Types
          </h3>
          <EnergyMbtiWebCard 
            mbtiCode={mbtiCode} 
            testDate={new Date(safeReport.date || Date.now()).toLocaleDateString()} 
            isSimpleView={isSimpleView} 
          />
        </section>

        {/* ========================================================
            5. Call to Action & Unlock (Action & Closing)
           ======================================================== */}
        {isSimpleView && (
          <div className="bg-slate-900 border-2 border-indigo-500/50 p-8 rounded-[2.5rem] shadow-2xl max-w-2xl mx-auto text-center my-8">
            <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-question-circle text-2xl animate-pulse text-indigo-400"></i>
            </div>
            <h4 className="text-white text-xl font-black mb-3">{'Apply for Personalized Coaching & Counseling'}</h4>
            <p className="text-slate-300 text-sm leading-relaxed mb-6 font-medium">
              {isEn ? (
                <>
                  Would you like 1:1 coaching or consulting for your weakest energy area, <strong>{codeInfo.name}</strong> ({codeInfo.region})?<br />
                  Apply to fully unlock the detailed report, 3-body solution guides, and comprehensive review.
                </>
              ) : (
                <>
                  Would you like 1:1 personalized coaching for your depleted <strong>{codeInfo.name}</strong> ({codeInfo.region}), or schedule an in-depth professional consultation?<br />
                  Scheduling coaching or counseling will fully unlock your detailed analysis report, 3-Body integrated solution guide, and comprehensive evaluation report.
                </>
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => {
                  setIsSimpleView(false);
                  setTimeout(() => {
                    const element = document.getElementById('detailed-section-top');
                    if (element) element.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black py-4 px-6 rounded-2xl transition-all shadow-lg active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <span>{'🌱 Apply for 1:1 Coaching'}</span>
                <i className="fas fa-chevron-right text-xs"></i>
              </button>
              <button
                onClick={() => {
                  setIsSimpleView(false);
                  setTimeout(() => {
                    const element = document.getElementById('detailed-section-top');
                    if (element) element.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black py-4 px-6 rounded-2xl transition-all shadow-lg active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <span>{'💬 Apply for In-depth Counseling'}</span>
                <i className="fas fa-chevron-right text-xs"></i>
              </button>
            </div>
          </div>
        )}
        {!isSimpleView && (
          <>
            <div id="detailed-section-top" className="scroll-mt-10" />
 
            {/* 3-Body integrated solution guide */}
            {safeReport.recommendations && (
              <section className="relative overflow-hidden bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-50 rounded-[40px] p-8 md:p-12 border border-teal-200/50 text-left">
                <div className="relative z-10">
                  <div className="text-center mb-10">
                    <span className="text-teal-600 text-sm font-bold uppercase tracking-[0.3em]">3BODY SOLUTION GUIDE</span>
                    <h3 className="text-4xl font-black text-slate-900 mt-3">3-Body Integrated Solution Guide</h3>
                    <p className="text-teal-800/80 text-base font-medium mt-3">Guide custom meditation and exercises for Body, Mind, and Brain based on analysis results.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                    <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-lg border border-emerald-100">
                      <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center text-2xl shadow-md mb-4">🏃</div>
                      <h4 className="text-xl font-black text-slate-800 mb-1">Body</h4>
                      <p className="text-xs font-bold text-emerald-600 mb-3">Corrective Exercise · Posture Improvement</p>
                      <p className="text-sm font-medium text-slate-700 leading-relaxed">{sanitize(safeReport.recommendations.gymnastics)}</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-lg border border-violet-100">
                      <div className="w-14 h-14 bg-gradient-to-br from-violet-400 to-purple-500 rounded-2xl flex items-center justify-center text-2xl shadow-md mb-4">💚</div>
                      <h4 className="text-xl font-black text-slate-800 mb-1">Mind</h4>
                      <p className="text-xs font-bold text-violet-600 mb-3">Meditation · Energy Balance</p>
                      <p className="text-sm font-medium text-slate-700 leading-relaxed">{sanitize(safeReport.recommendations.meditation)}</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-lg border border-amber-100">
                      <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center text-2xl shadow-md mb-4">🧠</div>
                      <h4 className="text-xl font-black text-slate-800 mb-1">Brain</h4>
                      <p className="text-xs font-bold text-amber-600 mb-3">Brain Training · Cognitive Enhancement</p>
                      <p className="text-sm font-medium text-slate-700 leading-relaxed">{sanitize(safeReport.recommendations.brainTraining)}</p>
                    </div>
                  </div>
                </div>
              </section>
            )}
 
            {/* Overall evaluation report (reordered: after solution guide) */}
            <div className="bg-slate-50 p-10 rounded-[40px] border border-slate-200 text-center max-w-4xl mx-auto mt-8">
              <h4 className="text-3xl font-black text-slate-800 mb-6">Overall Evaluation Report</h4>
              <p className="text-lg font-medium text-slate-700 leading-relaxed mb-8 italic">"{sanitize(safeReport.summary)}"</p>
              <div className="flex flex-wrap justify-center gap-4 print:hidden">
                <button onClick={handleShare} className={`px-8 py-3 font-bold rounded-2xl flex items-center gap-2 shadow-sm transition-all cursor-pointer ${copied ? 'bg-emerald-500 text-white border border-emerald-500' : 'bg-white text-slate-900 border border-slate-300'}`}>
                  <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`}></i> {copied ? 'Copied! Ready to share.' : 'Copy for Sharing'}
                </button>
                <button onClick={onRestart} className="px-8 py-3 bg-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-200 transition-all cursor-pointer">
                  Go to Main
                </button>
              </div>
            </div>

            {/* Recommended programs (reordered: last) */}
            {safeReport.programRecommendation && (
              <section className="bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 rounded-[40px] p-8 md:p-12 text-white relative overflow-hidden text-left mt-8">
                <div className="relative z-10">
                  <div className="text-center mb-8">
                    <span className="text-indigo-200 text-sm font-bold uppercase tracking-[0.3em]">RECOMMENDED PROGRAM</span>
                    <h3 className="text-4xl font-black mt-3">Recommended Programs</h3>
                  </div>
                  <div className="max-w-2xl mx-auto">
                    <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 md:p-10 border border-white/20 text-center mb-8">
                      <div className={safeReport.programRecommendation.recommended?.length > 15 ? 'text-3xl md:text-4xl font-black text-white mb-4 leading-tight' : 'text-5xl md:text-6xl font-black text-white mb-4 leading-tight'}>{sanitize(safeReport.programRecommendation.recommended)}</div>
                      <p className="text-indigo-50 text-lg leading-relaxed font-medium mb-6">{sanitize(safeReport.programRecommendation.reason)}</p>
                      <div className="bg-white/10 rounded-2xl p-5 text-base font-bold text-white">{sanitize(safeReport.programRecommendation.duration)}</div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-center mb-10">
                      {[
                        { label: '21 Days', desc: 'Start Change', active: safeReport.programRecommendation.recommended?.includes('21') },
                        { label: '66 Days', desc: 'Establish Habit', active: safeReport.programRecommendation.recommended?.includes('66') },
                        { label: '100 Days', desc: 'Transform Life', active: safeReport.programRecommendation.recommended?.includes('100') }
                      ].map(p => (
                        <div key={p.label} className={`rounded-2xl p-5 border ${p.active ? 'bg-white text-indigo-700 border-white shadow-xl' : 'bg-white/5 border-white/10 text-indigo-200'}`}>
                          <div className="text-2xl font-black">{p.label}</div>
                          <div className="text-sm mt-2 font-bold">{p.desc}</div>
                        </div>
                      ))}
                    </div>
 
                    {/* 7-CODE tailored training programs */}
                    <div className="mt-10 pt-10 border-t border-white/10 relative">
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-800 px-6 py-2 rounded-full text-sm font-black text-indigo-200 border border-white/10 shadow-lg tracking-widest whitespace-nowrap">
                        7-CODE Tailored Training
                      </div>
                      <div className="text-center mt-8 mb-6">
                        <p className="text-indigo-100 text-lg font-medium bg-white/5 inline-block px-6 py-3 rounded-2xl border border-white/10">
                          {specialized.reason}
                        </p>
                      </div>
 
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-4xl mx-auto text-center">
                        {specialized.bodyFree && (
                          <div className="block rounded-3xl p-6 border transition-all bg-gradient-to-br from-amber-400 to-orange-500 border-white/50 shadow-lg">
                            <h4 className="text-2xl font-black text-white mb-2">Body-Free Meditation</h4>
                            <p className="text-xs text-white/80 leading-relaxed">Body energy circulation & vital flow course</p>
                          </div>
                        )}
                        {specialized.cleanBreath && (
                          <div className="block rounded-3xl p-6 border transition-all bg-gradient-to-br from-emerald-400 to-teal-500 border-white/50 shadow-lg">
                            <h4 className="text-2xl font-black text-white mb-2">Clean Breathing 1, 2</h4>
                            <p className="text-xs text-white/80 leading-relaxed">Danjeon breathing & chest relaxation course</p>
                          </div>
                        )}
                        {specialized.mindFree && (
                          <div className="block rounded-3xl p-6 border transition-all bg-gradient-to-br from-pink-400 to-rose-500 border-white/50 shadow-lg">
                            <h4 className="text-2xl font-black text-white mb-2">Mind-Free Meditation</h4>
                            <p className="text-xs text-white/80 leading-relaxed">Stress management & inner peace course</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* [8] Re-assessment CTA & CodeMap app download QR */}
            <section className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 rounded-[40px] text-white flex flex-col md:flex-row items-center justify-between gap-6 max-w-4xl mx-auto mt-8 text-left">
              <div className="text-left">
                <h4 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-white to-indigo-200 mb-2">
                  📈 {'Track changes on your next assessment'}
                </h4>
                <p className="text-indigo-200 text-xs font-semibold leading-relaxed mb-4">
                  {isEn ? (
                    <>
                      Your integrated balance age is <strong className="text-amber-400">{safeReport.comprehensiveAge || safeReport.physicalAge || 0} years</strong>.<br/>
                      Link with our mobile app (coming soon) to track historical progress and comparison charts.
                    </>
                  ) : (
                    <>
                      Your integrated balance age is <strong className="text-amber-400">{safeReport.comprehensiveAge || safeReport.physicalAge || 0} years</strong>.<br/>
                      Link with our mobile app (coming soon) to track historical progress and comparison charts.
                    </>
                  )}
                </p>
                <div className="text-[10px] text-slate-500 font-bold flex items-center gap-1.5">
                  <span>{'📱 Mobile App coming soon'}</span>
                  <span>•</span>
                  <span>{'Smart progress tracking service planned'}</span>
                </div>
              </div>
              
              <div className="bg-white p-3 rounded-2xl flex items-center gap-4 border border-indigo-500/20 shrink-0">
                <div className="w-24 h-24 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200 relative overflow-hidden">
                  <img src="./assets/images/icon.png" alt="App QR" className="w-16 h-16 object-contain filter blur-[1px] opacity-70" />
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-[10px] font-black text-amber-400 text-center uppercase tracking-wider leading-tight">COMING<br/>SOON</span>
                  </div>
                </div>
                <div className="text-left text-slate-800">
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block mb-0.5">CodeMap App</span>
                  <span className="text-sm font-black text-slate-900 block leading-tight">{'CodeMap App (Coming Soon)'}</span>
                  <span className="text-[10.5px] text-slate-500 font-medium block mt-1.5 leading-snug">
                    {isEn ? (
                      <>
                        Historical tracking app is coming soon.<br/>
                        You will be able to find it in the App Store upon release.
                      </>
                    ) : (
                      <>
                        The dedicated history tracking app will be available soon.<br/>
                        Available on App Store / Play Store after launch.
                      </>
                    )}
                  </span>
                </div>
              </div>
            </section>

            {/* Admin feedback panel */}
            <FeedbackPanel report={safeReport} />
          </>
        )}

        {/* ⚠️ Legal disclaimer (healthcare law compliance) */}
        <div className="mt-8 mb-2 px-6 py-4 bg-amber-50 border border-amber-200 rounded-2xl text-center print:block">
          <p className="text-amber-800 text-xs font-bold mb-1">
            ⚠️ {BRAND_NAME} {'Wellness Information & Disclaimer'}
          </p>
          <p className="text-amber-700 text-[10.5px] leading-relaxed">
            {isEn ? (
              'This screening is a wellness guide to evaluate posture and energy flow for self-care. It is NOT medical diagnosis, advice, or therapy under medical laws. It does not replace medical consultation. For diagnostic concerns or persistent pain, consult a healthcare provider.'
            ) : (
              <>
                This report is a <strong>wellness screening indicator</strong> designed to help identify body balance and qi/blood flow status for self-care.{' '}
                It does <strong>not</strong> constitute a medical device analysis or medical treatment.<br />
                This report is not a substitute for disease prevention, medical diagnosis, or treatment.{' '}
                If you experience musculoskeletal pain or cognitive issues requiring medical attention, we strongly recommend consulting a licensed medical professional.
              </>
            )}
          </p>
        </div>

        {/* Estimated explanation time display */}
        <div className="text-center text-slate-400 text-xs font-bold mt-2">
          {'⏱️ Est. explanation time: ~3 mins'}
        </div>

      </div>
    </div>
  );
};

export default ReportDashboard;
