import React, { useState, useEffect } from 'react';
import { MemberRecord } from '../types';
import Modal from './Modal';
import Toast from './Toast';
import { getRecordsLocally, deleteRecordLocally, saveRecordLocally } from '../services/localDb';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface HistoryManagerProps {
  onViewReport: (record: MemberRecord) => void;
  onResumeAnalysis?: (record: MemberRecord) => void;
  onClose: () => void;
}

const HistoryManager: React.FC<HistoryManagerProps> = ({ onViewReport, onResumeAnalysis, onClose }) => {
  const [activeTab, setActiveTab] = useState<'records' | 'pending'>('records');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'my_pc' | 'other_pc' | 'lite' | 'joint'>('all');
  const [records, setRecords] = useState<MemberRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');
  const [currentBranchId, setCurrentBranchId] = useState<string>('');

  const fetchRecords = async () => {
    try {
      const fetchedRecords = await getRecordsLocally();
      fetchedRecords.sort((a, b) => new Date(b.lastTestDate).getTime() - new Date(a.lastTestDate).getTime());
      setRecords(fetchedRecords);
    } catch (err) {
      console.error("Failed to load local records:", err);
      setToast({ isVisible: true, message: "기록을 불러오는데 실패했습니다.", type: 'error' });
    }
  };

  useEffect(() => {
    fetchRecords();
    try {
      const deviceStr = localStorage.getItem('currentDevice');
      if (deviceStr) {
        const device = JSON.parse(deviceStr);
        setCurrentDeviceId(device.id || '');
        setCurrentBranchId(device.branchId || '');
      }
    } catch (e) {}
  }, []);

  const filteredRecords = records.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const completedRecordsAll = filteredRecords.filter(r => r.report?.overallScore !== undefined);
  const pendingRecordsAll = filteredRecords.filter(r => r.report?.overallScore === undefined);

  const myPcCount = completedRecordsAll.filter(r => r.hardwareId === currentDeviceId && r.sourceType !== 'LITE').length;
  const otherPcCount = completedRecordsAll.filter(r => r.hardwareId !== currentDeviceId && r.sourceType !== 'LITE' && !(r.eventCode && r.branchId !== currentBranchId)).length;
  const liteCount = completedRecordsAll.filter(r => r.sourceType === 'LITE' && !(r.eventCode && r.branchId !== currentBranchId)).length;
  const jointCount = completedRecordsAll.filter(r => !!r.eventCode).length;

  const filterBySource = (r: MemberRecord) => {
    if (sourceFilter === 'all') return true;
    if (sourceFilter === 'joint') return !!r.eventCode;
    if (sourceFilter === 'lite') return r.sourceType === 'LITE' && !(r.eventCode && r.branchId !== currentBranchId);
    if (sourceFilter === 'my_pc') return r.hardwareId === currentDeviceId && r.sourceType !== 'LITE';
    if (sourceFilter === 'other_pc') return r.hardwareId !== currentDeviceId && r.sourceType !== 'LITE' && !(r.eventCode && r.branchId !== currentBranchId);
    return true;
  };

  const completedRecords = completedRecordsAll.filter(filterBySource);
  const pendingRecords = pendingRecordsAll.filter(filterBySource);

  const uniqueNames = Array.from(new Set(completedRecords.map(r => r.name)));
  const showChart = uniqueNames.length === 1 && completedRecords.length > 1;
  const chartData = showChart ? [...completedRecords].reverse().map(r => ({
    date: r.lastTestDate,
    biologicalAge: r.report?.userInfo?.age || 0,
    physicalAge: r.report?.physicalAge || 0,
    faceAge: r.report?.faceAgeEstimate || 0
  })) : [];

  const exportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(records));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `bt_records_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    setToast({ isVisible: true, message: "데이터가 성공적으로 내보내졌습니다.", type: 'success' });
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          let count = 0;
          for (const record of imported) {
            const success = await saveRecordLocally({ ...record, ownerUid: 'local-branch' });
            if (success) count++;
          }
          await fetchRecords();
          setToast({ isVisible: true, message: `${count}개의 데이터를 성공적으로 불러왔습니다.`, type: 'success' });
        }
      } catch (err) {
        console.error("Import failed:", err);
        setToast({ isVisible: true, message: "데이터 불러오기에 실패했습니다.", type: 'error' });
      }
    };
    reader.readAsText(file);
  };

  const [clearConfirm, setClearConfirm] = useState(false);
  const [toast, setToast] = useState<{ isVisible: boolean, message: string, type: 'success' | 'error' | 'info' }>({ isVisible: false, message: '', type: 'success' });

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      await deleteRecordLocally(deleteId);
      await fetchRecords();
      setDeleteId(null);
      setToast({ isVisible: true, message: "기록이 삭제되었습니다.", type: 'info' });
    } catch (error) {
      console.error("Local Delete Error:", error);
      setToast({ isVisible: true, message: "삭제 중 오류가 발생했습니다.", type: 'error' });
    }
  };

  const handleClearAll = async () => {
    try {
      // 로컬의 모든 레코드 삭제
      for (const r of records) {
        await deleteRecordLocally(r.id);
      }
      await fetchRecords();
      setClearConfirm(false);
      setToast({ isVisible: true, message: "모든 데이터가 삭제되었습니다.", type: 'info' });
    } catch (error) {
      console.error("Clear All Error:", error);
      setToast({ isVisible: true, message: "모든 데이터 삭제 중 오류가 발생했습니다.", type: 'error' });
    }
  };

  const handleBatchDeleteConfirm = async () => {
    try {
      for (const id of selectedIds) {
        await deleteRecordLocally(id);
      }
      await fetchRecords();
      setSelectedIds([]);
      setBatchDeleteConfirm(false);
      setToast({ isVisible: true, message: `${selectedIds.length}개의 기록이 삭제되었습니다.`, type: 'info' });
    } catch (error) {
      console.error("Batch Delete Error:", error);
      setToast({ isVisible: true, message: "삭제 중 오류가 발생했습니다.", type: 'error' });
    }
  };

  const importV3Data = async () => {
    if (window.electronAPI && window.electronAPI.importV3Database) {
      try {
        const v3Records = await window.electronAPI.importV3Database();
        if (v3Records && v3Records.length > 0) {
          let count = 0;
          for (const record of v3Records) {
            if (!records.find(r => r.id === record.id)) {
              const success = await saveRecordLocally(record);
              if (success) count++;
            }
          }
          await fetchRecords();
          setToast({ isVisible: true, message: `V3 데이터 ${count}개를 성공적으로 가져왔습니다.`, type: 'success' });
        } else {
          setToast({ isVisible: true, message: "가져올 기존 V3 데이터가 없습니다.", type: 'info' });
        }
      } catch (err) {
        console.error("V3 Import failed:", err);
        setToast({ isVisible: true, message: "데이터 불러오기에 실패했습니다.", type: 'error' });
      }
    } else {
      setToast({ isVisible: true, message: "웹 환경에서는 지원하지 않는 기능입니다.", type: 'error' });
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto w-full">
      <Modal 
        isOpen={deleteId !== null}
        title="기록 삭제"
        message="이 회원의 진단 기록을 영구적으로 삭제하시겠습니까?"
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteId(null)}
        confirmText="삭제"
        cancelText="취소"
      />
      <Modal 
        isOpen={clearConfirm}
        title="전체 데이터 삭제"
        message="모든 회원 데이터와 진단 기록이 영구적으로 삭제됩니다. 계속하시겠습니까?"
        onConfirm={handleClearAll}
        onClose={() => setClearConfirm(false)}
        confirmText="전체 삭제"
        cancelText="취소"
      />
      <Modal 
        isOpen={batchDeleteConfirm}
        title="선택 기록 삭제"
        message={`${selectedIds.length}명의 진단 기록을 삭제하시겠습니까?`}
        onConfirm={handleBatchDeleteConfirm}
        onClose={() => setBatchDeleteConfirm(false)}
        confirmText="선택 삭제"
        cancelText="취소"
      />
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800">회원 관리 센터</h2>
          <p className="text-slate-500 text-sm mt-1">누적된 측정 내역을 확인하고 관리할 수 있습니다.</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={() => setBatchDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 h-10 bg-rose-50 text-rose-600 rounded-full font-bold text-sm hover:bg-rose-100 transition-all border border-rose-200 mr-2"
            >
              <i className="fas fa-trash-alt"></i> 선택 삭제 ({selectedIds.length})
            </button>
          )}
          {activeTab === 'records' && (
            <>
              <button
                onClick={importV3Data}
                className="flex items-center gap-2 px-4 h-10 bg-indigo-600 text-white rounded-full font-bold text-sm hover:bg-indigo-700 transition-all shadow-sm"
                title="기존 V3 데이터 가져오기"
              >
                <i className="fas fa-file-import"></i> V3 데이터 가져오기
              </button>
              <button
                onClick={exportData}
                className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-100 transition-all"
                title="데이터 내보내기"
              >
                <i className="fas fa-download"></i>
              </button>
              <label className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center hover:bg-emerald-100 transition-all cursor-pointer" title="데이터 불러오기">
                <i className="fas fa-upload"></i>
                <input type="file" className="hidden" accept=".json" onChange={importData} />
              </label>
              <button
                onClick={() => setClearConfirm(true)}
                className="w-10 h-10 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center hover:bg-rose-100 transition-all"
                title="전체 삭제"
              >
                <i className="fas fa-trash-sweep"></i>
              </button>
            </>
          )}
          <button onClick={onClose} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-all">
            <i className="fas fa-times"></i>
          </button>
        </div>
      </div>

      {/* 탭 전환 */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('records')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'records'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <i className="fas fa-users text-xs"></i>
          회원 기록
          <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === 'records' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'
          }`}>{completedRecordsAll.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'pending'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <i className="fas fa-archive text-xs"></i>
          임시 보관함
          <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'
          }`}>{pendingRecordsAll.length}</span>
        </button>
      </div>

      {/* 서브 필터 (소스 구분) */}
      <div className="flex gap-2 mb-8">
        <button
          onClick={() => setSourceFilter('all')}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center ${
            sourceFilter === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <i className="fas fa-globe mr-2"></i> 전체 ({completedRecordsAll.length})
        </button>
        <button
          onClick={() => setSourceFilter('my_pc')}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center ${
            sourceFilter === 'my_pc' ? 'bg-blue-500 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <i className="fas fa-desktop mr-2"></i> 나의 PC ({myPcCount})
        </button>
        <button
          onClick={() => setSourceFilter('other_pc')}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center ${
            sourceFilter === 'other_pc' ? 'bg-slate-500 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <i className="fas fa-cloud mr-2"></i> 다른 PC ({otherPcCount})
        </button>
        <button
          onClick={() => setSourceFilter('lite')}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center ${
            sourceFilter === 'lite' ? 'bg-emerald-500 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <i className="fas fa-mobile-alt mr-2"></i> 온라인 LITE ({liteCount})
        </button>
        {jointCount > 0 && (
          <button
            onClick={() => setSourceFilter('joint')}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center ${
              sourceFilter === 'joint' ? 'bg-purple-500 text-white shadow-md' : 'bg-white border border-purple-200 text-purple-600 hover:bg-purple-50'
            }`}
          >
            <i className="fas fa-link mr-2"></i> 합동 행사 ({jointCount})
          </button>
        )}
      </div>

      {/* 탭 콘텐츠 — 회원 기록 */}
      {activeTab === 'records' && (
        <>
      <div className="mb-8 relative">
        <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"></i>
        <input
          type="text"
          placeholder="회원 이름 검색..."
          className="w-full pl-12 pr-6 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {showChart && (
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm mb-8">
          <h3 className="text-xl font-bold text-slate-800 mb-4">{uniqueNames[0]}님의 신체 나이 변화 추이</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  domain={['dataMin - 5', 'dataMax + 5']} 
                  tickLine={false}
                  axisLine={false}
                  dx={-10}
                />
                <Tooltip 
                  labelFormatter={(val) => new Date(val).toLocaleDateString()}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number, name: string) => [
                    `${value}세`, 
                    name === 'biologicalAge' ? '생물학적 나이' : name === 'physicalAge' ? '신체 나이' : '얼굴 나이'
                  ]}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Line 
                  type="monotone" 
                  dataKey="biologicalAge" 
                  name="생물학적 나이" 
                  stroke="#94a3b8" 
                  strokeWidth={3} 
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 0 }} 
                  animationDuration={1500}
                />
                <Line 
                  type="monotone" 
                  dataKey="physicalAge" 
                  name="신체 나이" 
                  stroke="#4f46e5" 
                  strokeWidth={4} 
                  dot={{ r: 5, fill: '#4f46e5', strokeWidth: 3, stroke: '#fff' }} 
                  activeDot={{ r: 8, strokeWidth: 0 }} 
                  animationDuration={1500}
                />
                <Line 
                  type="monotone" 
                  dataKey="faceAge" 
                  name="얼굴 나이" 
                  stroke="#f43f5e" 
                  strokeWidth={4} 
                  dot={{ r: 5, fill: '#f43f5e', strokeWidth: 3, stroke: '#fff' }} 
                  activeDot={{ r: 8, strokeWidth: 0 }} 
                  animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {completedRecords.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {completedRecords.map(record => (
            <div key={record.id} className={`bg-white p-6 rounded-[32px] border ${selectedIds.includes(record.id) ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200'} shadow-sm hover:shadow-lg transition-all group overflow-hidden relative`}>
              <div className="absolute top-6 left-6 z-10">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                  checked={selectedIds.includes(record.id)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds([...selectedIds, record.id]);
                    else setSelectedIds(selectedIds.filter(id => id !== record.id));
                  }}
                />
              </div>
              <div className="flex justify-between items-start mb-4 pl-8">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-bold text-xl shrink-0">
                      {record.name[0]}
                    </div>
                    <div>
                        <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                          {record.name}
                          {record.sourceType === 'LITE' ? (
                            record.eventCode && record.branchId !== currentBranchId ? (
                              <span className="bg-purple-100 text-purple-600 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap"><i className="fas fa-link mr-1"></i>합동 행사</span>
                            ) : (
                              <span className="bg-emerald-100 text-emerald-600 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap"><i className="fas fa-mobile-alt mr-1"></i>온라인 LITE</span>
                            )
                          ) : record.eventCode && record.branchId !== currentBranchId ? (
                            <span className="bg-purple-100 text-purple-600 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap"><i className="fas fa-link mr-1"></i>합동 행사</span>
                          ) : record.hardwareId !== currentDeviceId ? (
                            <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap"><i className="fas fa-cloud mr-1"></i>다른 PC</span>
                          ) : (
                            <span className="bg-blue-100 text-blue-600 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap"><i className="fas fa-desktop mr-1"></i>나의 PC</span>
                          )}
                        </h4>
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(record.lastTestDate).toLocaleDateString()}</span>
                          {record.report?.userInfo?.phone && (
                            <span className="text-[10px] text-indigo-600 font-bold flex items-center gap-1">
                              <i className="fas fa-phone-alt text-[8px]"></i>{record.report.userInfo.phone}
                            </span>
                          )}
                        </div>
                    </div>
                </div>
                <button 
                  onClick={() => setDeleteId(record.id)}
                  className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors"
                >
                  <i className="fas fa-trash-alt text-sm"></i>
                </button>
              </div>

              {/* Preview Image */}
              <div className="mb-4 h-32 rounded-2xl overflow-hidden border border-slate-100 flex flex-col items-center justify-center relative">
                {record.images && record.images[0] ? (
                  <img src={record.images[0].dataUrl} className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all" alt="Preview" />
                ) : record.eventCode && record.branchId !== currentBranchId ? (
                  <div className="w-full h-full bg-gradient-to-br from-slate-50 to-indigo-50/50 flex flex-col items-center justify-center p-3 text-center">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 mb-1.5 shadow-sm">
                      <i className="fas fa-handshake text-lg"></i>
                    </div>
                    <span className="text-xs font-semibold text-indigo-950 mb-0.5">합동 행사 측정 데이터</span>
                    <span className="text-[10px] text-slate-400 font-mono truncate max-w-full">지점 ID: {record.branchId?.substring(0, 8) || '알 수 없음'}</span>
                  </div>
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300">
                    <i className="fas fa-image text-3xl"></i>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 mb-6 text-xs px-1">
                <div className="flex items-center justify-between">
                  <div className="text-slate-500">생물학적 나이 <span className="font-bold text-slate-800">{record.report?.userInfo?.age || '-'}세</span></div>
                  <div className="text-slate-500">종합 점수 <span className="font-bold text-slate-800">{record.report?.overallScore || '-'}점</span></div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-slate-500">신체 나이 <span className="font-bold text-indigo-600">{record.report?.physicalAge || '-'}세</span></div>
                  <div className="text-slate-500">얼굴 나이 <span className="font-bold text-rose-500">{record.report?.faceAgeEstimate || '-'}세</span></div>
                </div>
              </div>
              
              <button 
                onClick={() => onViewReport(record)}
                disabled={!record.report?.overallScore}
                className={`w-full text-white text-sm font-bold py-4 rounded-xl transition-all shadow-md ${
                  !record.report?.overallScore
                    ? 'bg-slate-300 cursor-not-allowed shadow-none'
                    : 'bg-slate-900 hover:bg-black shadow-slate-200'
                }`}
              >
                {!record.report?.overallScore ? '분석 미완료 (대기중)' : '상세 리포트 보기'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
           <i className="fas fa-folder-open text-5xl text-slate-200 mb-4"></i>
           <p className="text-slate-400 font-medium">검색 결과가 없거나 저장된 데이터가 없습니다.</p>
           <p className="text-xs text-slate-300 mt-2">새로운 측정을 시작하여 기록을 생성하세요.</p>
        </div>
      )}
        </>
      )}

      {/* 탭 콘텐츠 — 임시 보관함 */}
      {activeTab === 'pending' && (
        <>
          <div className="mb-8 relative">
            <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              placeholder="임시 보관된 회원 검색..."
              className="w-full pl-12 pr-6 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all shadow-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <i className="fas fa-info-circle text-amber-500 mt-0.5"></i>
            <p className="text-sm text-amber-700">
              측정은 완료되었으나 AI 분석이 정상적으로 끝나지 않은 기록입니다.<br/>
              [AI 재분석 시작] 버튼을 눌러 분석을 재개하면 정식 회원 기록으로 저장됩니다.
            </p>
          </div>

          {pendingRecords.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingRecords.map(record => (
                <div key={record.id} className={`bg-white p-6 rounded-[32px] border ${selectedIds.includes(record.id) ? 'border-amber-500 ring-2 ring-amber-100' : 'border-amber-200'} shadow-sm hover:shadow-lg transition-all group overflow-hidden relative`}>
                  <div className="absolute top-6 left-6 z-10">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                      checked={selectedIds.includes(record.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds([...selectedIds, record.id]);
                        else setSelectedIds(selectedIds.filter(id => id !== record.id));
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-start mb-4 pl-8">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 font-bold text-xl shrink-0">
                          {record.name.replace('(분석 대기) ', '')[0]}
                        </div>
                        <div>
                            <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                              {record.name}
                              {record.sourceType === 'LITE' ? (
                                <span className="bg-emerald-100 text-emerald-600 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap"><i className="fas fa-mobile-alt mr-1"></i>온라인 LITE</span>
                              ) : record.hardwareId !== currentDeviceId ? (
                                <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap"><i className="fas fa-cloud mr-1"></i>다른 PC</span>
                              ) : (
                                <span className="bg-blue-100 text-blue-600 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap"><i className="fas fa-desktop mr-1"></i>나의 PC</span>
                              )}
                            </h4>
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">{new Date(record.lastTestDate).toLocaleDateString()}</span>
                              {record.report?.userInfo?.phone && (
                                <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                                  <i className="fas fa-phone-alt text-[8px]"></i>{record.report.userInfo.phone}
                                </span>
                              )}
                            </div>
                        </div>
                    </div>
                    <button 
                      onClick={() => setDeleteId(record.id)}
                      className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <i className="fas fa-trash-alt text-sm"></i>
                    </button>
                  </div>

                  {/* Preview Image */}
                  <div className="mb-4 h-32 rounded-2xl bg-slate-100 overflow-hidden border border-slate-100">
                    {record.images && record.images[0] ? (
                      <img src={record.images[0].dataUrl} className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all" alt="Preview" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <i className="fas fa-image text-3xl"></i>
                      </div>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => onResumeAnalysis && onResumeAnalysis(record)}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold py-4 rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-md shadow-amber-200 flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-microchip"></i> AI 재분석 시작
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
               <i className="fas fa-box-open text-5xl text-slate-200 mb-4"></i>
               <p className="text-slate-400 font-medium">분석 대기 중인 임시 데이터가 없습니다.</p>
            </div>
          )}
        </>
      )}
      <Toast 
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </div>
  );
};

export default HistoryManager;
