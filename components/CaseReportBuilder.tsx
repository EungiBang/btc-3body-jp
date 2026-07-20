import React, { useState, useEffect } from 'react';
import { MemberRecord, CaseReport } from '../types';
import { generateCaseReportDraft } from '../services/geminiService';
import { saveRecordLocally } from '../services/localDb';
import Toast from './Toast';

interface CaseReportBuilderProps {
  record: MemberRecord;
  allRecords: MemberRecord[];
  onClose: () => void;
  onSave: (record: MemberRecord) => void;
}

const CaseReportBuilder: React.FC<CaseReportBuilderProps> = ({ record, allRecords, onClose, onSave }) => {
  const defaultAge = record.report?.userInfo?.age || '-';
  const defaultGender = record.report?.userInfo?.gender === 'male' ? '남성' : record.report?.userInfo?.gender === 'female' ? '여성' : '-';
  const defaultProfile = `${record.name} / ${defaultAge}세 / ${defaultGender}\n- 직업: \n- 라이프스타일 특징: `;

  const [report, setReport] = useState<CaseReport>({
    clientProfile: record.caseReport?.clientProfile || defaultProfile,
    complaint: record.caseReport?.complaint || '',
    diagnosisSummary: record.caseReport?.diagnosisSummary || '',
    causeAnalysis: record.caseReport?.causeAnalysis || '',
    interventionStrategy: record.caseReport?.interventionStrategy || '',
    changeResults: record.caseReport?.changeResults || '',
    createdAt: record.caseReport?.createdAt || new Date().toISOString(),
    updatedAt: record.caseReport?.updatedAt || new Date().toISOString()
  });

  const [afterRecordId, setAfterRecordId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' as 'success'|'error' });

  // 동일 회원의 이후 측정 기록(After) 필터링
  const possibleAfterRecords = allRecords.filter(r => 
    r.name === record.name && 
    new Date(r.lastTestDate).getTime() > new Date(record.lastTestDate).getTime()
  ).sort((a, b) => new Date(b.lastTestDate).getTime() - new Date(a.lastTestDate).getTime());

  // 기존 저장된 보고서 불러오기
  useEffect(() => {
    if (record.caseReport) {
      setReport(record.caseReport);
      if (record.caseReport.afterRecordId) {
        setAfterRecordId(record.caseReport.afterRecordId);
      }
    } else {
      setReport(prev => ({ ...prev, clientProfile: defaultProfile }));
    }
  }, [record, defaultProfile]);

  const handleChange = (field: keyof CaseReport, value: string) => {
    setReport(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerateAI = async () => {
    if (!report.complaint.trim()) {
      setToast({ isVisible: true, message: '2번. 호소문 및 니즈를 먼저 입력해 주세요.', type: 'error' });
      return;
    }
    setIsGenerating(true);
    try {
      const draft = await generateCaseReportDraft(record, report.complaint);
      setReport(prev => ({
        ...prev,
        diagnosisSummary: draft.diagnosisSummary,
        causeAnalysis: draft.causeAnalysis,
        interventionStrategy: draft.interventionStrategy
      }));
      setToast({ isVisible: true, message: 'AI 초안이 성공적으로 생성되었습니다.', type: 'success' });
    } catch (err: any) {
      setToast({ isVisible: true, message: err.message || 'AI 생성 중 오류가 발생했습니다.', type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedRecord: MemberRecord = {
        ...record,
        caseReport: {
          ...report,
          afterRecordId,
          updatedAt: new Date().toISOString()
        }
      };
      await onSave(updatedRecord);
    } catch (e) {
      setToast({ isVisible: true, message: '저장 중 오류가 발생했습니다.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const afterRecord = allRecords.find(r => r.id === afterRecordId);

  return (
    <div className="bg-slate-100 min-h-screen py-8 print:bg-white print:py-0">
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white !important; }
          .no-print { display: none !important; }
          .print-border { border: 1px solid #000 !important; }
          .print-text { color: #000 !important; }
          @page { size: A4; margin: 15mm; }
        }
        .a4-container {
          width: 210mm;
          min-height: 297mm;
          background: white;
          margin: 0 auto;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        }
        @media print {
          .a4-container { width: 100%; box-shadow: none; margin: 0; min-height: auto; }
        }
        .report-textarea {
          width: 100%;
          border: none;
          resize: none;
          outline: none;
          background: transparent;
          min-height: 100px;
        }
      `}</style>

      {/* 헤더 액션 바 (인쇄 시 숨김) */}
      <div className="no-print max-w-[210mm] mx-auto mb-6 flex justify-between items-center px-4">
        <button onClick={onClose} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold">
          <i className="fas fa-arrow-left"></i> 뒤로가기
        </button>
        <div className="flex gap-3">
          <button onClick={handleGenerateAI} disabled={isGenerating} className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-bold hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2">
            {isGenerating ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>} 3,4,5번 AI 자동생성
          </button>
          <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-black transition-all flex items-center gap-2">
            <i className="fas fa-save"></i> 저장
          </button>
          <button onClick={handlePrint} className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg font-bold hover:bg-slate-50 transition-all flex items-center gap-2">
            <i className="fas fa-print"></i> PDF 출력 / 인쇄
          </button>
        </div>
      </div>

      {/* After 매핑 컨트롤 (인쇄 시 숨김) */}
      {possibleAfterRecords.length > 0 && (
        <div className="no-print max-w-[210mm] mx-auto mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-800 mb-2">변화 결과(After) 비교 기록 선택</h3>
          <select 
            value={afterRecordId} 
            onChange={(e) => setAfterRecordId(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="">-- After 데이터로 사용할 수련 후 측정 기록을 선택하세요 --</option>
            {possibleAfterRecords.map(r => (
              <option key={r.id} value={r.id}>
                {new Date(r.lastTestDate).toLocaleString()} (신체나이: {r.report?.physicalAge || '-'}세, 종합점수: {r.report?.overallScore || '-'}점)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* A4 용지 컨테이너 */}
      <div className="a4-container px-[15mm] py-[20mm]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-black tracking-tight mb-2">IBEL 명상지도 사례보고서</h1>
          <p className="text-sm text-gray-600 font-bold">브레인트레이닝센터(BTC) 맞춤형 시니어 스크리닝 기반</p>
        </div>

        <div className="flex justify-end mb-4 text-sm font-bold print-text">
          <span>작성일: {new Date().toLocaleDateString()}</span>
          <span className="ml-4">내담자: {record.name}</span>
        </div>

        {/* 표(Table) 형식의 보고서 양식 */}
        <table className="w-full border-collapse border border-black print-border text-sm print-text">
          <tbody>
            <tr>
              <th className="border border-black bg-gray-100 p-3 w-[25%] text-left font-bold align-top">
                1. 내담자 핵심 프로파일<br/>
                <span className="text-xs font-normal text-gray-600">(나이, 직업, 라이프스타일 특징)</span>
              </th>
              <td className="border border-black p-3 align-top">
                <textarea 
                  className="report-textarea" 
                  value={report.clientProfile}
                  onChange={(e) => handleChange('clientProfile', e.target.value)}
                  placeholder="내담자의 핵심 프로파일을 입력하세요."
                />
              </td>
            </tr>
            
            <tr>
              <th className="border border-black bg-gray-100 p-3 text-left font-bold align-top">
                2. 호소문 & 니즈<br/>
                <span className="text-xs font-normal text-gray-600">(방문 목적, 주요 불편 증상)</span>
              </th>
              <td className="border border-black p-3 align-top">
                <textarea 
                  className="report-textarea" 
                  value={report.complaint}
                  onChange={(e) => handleChange('complaint', e.target.value)}
                  placeholder="내담자가 주로 호소하는 증상과 니즈를 입력하세요. (AI 분석 시 주요 프롬프트로 사용됩니다)"
                />
              </td>
            </tr>

            <tr>
              <td colSpan={2} className="border border-black bg-gray-50 p-2 text-center text-xs text-gray-500 italic">
                -- 아래 세 항목은 3-Body 측정 결과(팩트)를 기반으로 작성됩니다. --
              </td>
            </tr>

            <tr>
              <th className="border border-black bg-gray-100 p-3 text-left font-bold align-top">
                3. 진단 요약<br/>
                <span className="text-xs font-normal text-gray-600">(측정 팩트 기반 현재 상태)</span>
                <div className="mt-2 text-xs font-normal bg-white p-2 border border-gray-300 rounded">
                  [Before 측정 수치]<br/>
                  신체나이: {record.report?.physicalAge || '-'}세<br/>
                  종합점수: {record.report?.overallScore || '-'}점
                </div>
              </th>
              <td className="border border-black p-3 align-top">
                <textarea 
                  className="report-textarea min-h-[150px]" 
                  value={report.diagnosisSummary}
                  onChange={(e) => handleChange('diagnosisSummary', e.target.value)}
                  placeholder="[자동 완성] 측정 결과와 호소문을 연관 지어 현재 상태를 요약합니다."
                />
              </td>
            </tr>

            <tr>
              <th className="border border-black bg-gray-100 p-3 text-left font-bold align-top">
                4. 핵심 원인 분석<br/>
                <span className="text-xs font-normal text-gray-600">(자세, 불균형, 7코드 방전 등)</span>
              </th>
              <td className="border border-black p-3 align-top">
                <textarea 
                  className="report-textarea min-h-[150px]" 
                  value={report.causeAnalysis}
                  onChange={(e) => handleChange('causeAnalysis', e.target.value)}
                  placeholder="[자동 완성] 호소 증상을 유발한 근본 원인을 3Body 관점에서 분석합니다."
                />
              </td>
            </tr>

            <tr>
              <th className="border border-black bg-gray-100 p-3 text-left font-bold align-top">
                5. 개입 전략<br/>
                <span className="text-xs font-normal text-gray-600">(3Body 7Code 원리 적용)</span>
              </th>
              <td className="border border-black p-3 align-top">
                <textarea 
                  className="report-textarea min-h-[150px]" 
                  value={report.interventionStrategy}
                  onChange={(e) => handleChange('interventionStrategy', e.target.value)}
                  placeholder="[자동 완성] 감각깨우기 -> 유연화 -> 정화 -> 통합 -> 주인되기 5단계 전략을 제시합니다."
                />
              </td>
            </tr>

            <tr>
              <th className="border border-black bg-gray-100 p-3 text-left font-bold align-top">
                6. 변화 결과<br/>
                <span className="text-xs font-normal text-gray-600">(수련 전후 Before & After)</span>
                {afterRecord && (
                  <div className="mt-2 text-xs font-normal bg-indigo-50 p-2 border border-indigo-200 rounded">
                    [After 측정 수치]<br/>
                    신체나이: {afterRecord.report?.physicalAge || '-'}세<br/>
                    종합점수: {afterRecord.report?.overallScore || '-'}점
                  </div>
                )}
              </th>
              <td className="border border-black p-3 align-top">
                <textarea 
                  className="report-textarea min-h-[150px]" 
                  value={report.changeResults}
                  onChange={(e) => handleChange('changeResults', e.target.value)}
                  placeholder="수련 후 재측정한 데이터를 바탕으로 실질적인 변화 및 결과를 작성하세요."
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Toast 
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
    </div>
  );
};

export default CaseReportBuilder;
