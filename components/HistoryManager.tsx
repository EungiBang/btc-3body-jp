// 회원 측정 이력을 확인하고 관리하는 히스토리 매니저 컴포넌트
import React, { useState, useEffect } from 'react';
import { MemberRecord } from '../types';
import Modal from './Modal';
import Toast from './Toast';
import { getRecordsLocally, deleteRecordLocally, saveRecordLocally } from '../services/localDb';

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
      // 안전한 정렬 로직 (lastTestDate가 없거나 깨진 데이터 대응)
      fetchedRecords.sort((a, b) => {
        const timeA = a.lastTestDate ? new Date(a.lastTestDate).getTime() : 0;
        const timeB = b.lastTestDate ? new Date(b.lastTestDate).getTime() : 0;
        return timeB - timeA;
      });
      setRecords(fetchedRecords);
    } catch (err) {
      console.error("Failed to load local records:", err);
      setToast({ isVisible: true, message: "記録の読み込みに失敗しました。", type: 'error' });
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
    (r.name || '').toLowerCase().includes(searchTerm.toLowerCase())
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

  const exportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(records));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `bt_records_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    setToast({ isVisible: true, message: "データが正常にエクスポートされました。", type: 'success' });
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
          setToast({ isVisible: true, message: `${count}個のデータを正常にインポートしました。`, type: 'success' });
        }
      } catch (err) {
        console.error("Import failed:", err);
        setToast({ isVisible: true, message: "データのインポートに失敗しました。", type: 'error' });
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
      setSelectedIds(prev => prev.filter(id => id !== deleteId));
      setToast({ isVisible: true, message: "記録が削除されました。", type: 'info' });
    } catch (error) {
      console.error("Local Delete Error:", error);
      setToast({ isVisible: true, message: "削除中にエラーが発生しました。", type: 'error' });
    }
  };

  const handleClearAll = async () => {
    try {
      for (const r of records) {
        await deleteRecordLocally(r.id);
      }
      await fetchRecords();
      setClearConfirm(false);
      setSelectedIds([]);
      setToast({ isVisible: true, message: "すべてのデータが削除されました。", type: 'info' });
    } catch (error) {
      console.error("Clear All Error:", error);
      setToast({ isVisible: true, message: "すべてのデータの削除中にエラーが発生しました。", type: 'error' });
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
      setToast({ isVisible: true, message: `${selectedIds.length}個の記録が削除されました。`, type: 'info' });
    } catch (error) {
      console.error("Batch Delete Error:", error);
      setToast({ isVisible: true, message: "削除中にエラーが発生しました。", type: 'error' });
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
          setToast({ isVisible: true, message: `V3データ ${count}個を正常に取り込みました。`, type: 'success' });
        } else {
          setToast({ isVisible: true, message: "取り込む既存のV3データがありません。", type: 'info' });
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
        title="記録の削除"
        message="この会員の測定記録を永久に削除しますか？"
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteId(null)}
        confirmText="削除"
        cancelText="キャンセル"
      />
      <Modal 
        isOpen={clearConfirm}
        title="全データの削除"
        message="すべての会員データと測定記録が永久に削除されます。続行しますか？"
        onConfirm={handleClearAll}
        onClose={() => setClearConfirm(false)}
        confirmText="すべて削除"
        cancelText="キャンセル"
      />
      <Modal 
        isOpen={batchDeleteConfirm}
        title="選択した記録の削除"
        message={`${selectedIds.length}名の測定記録を削除しますか？`}
        onConfirm={handleBatchDeleteConfirm}
        onClose={() => setBatchDeleteConfirm(false)}
        confirmText="選択削除"
        cancelText="キャンセル"
      />
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800">会員データ管理センター</h2>
          <p className="text-slate-500 text-sm mt-1">蓄積された測定履歴を確認および管理できます。</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={() => setBatchDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 h-10 bg-rose-50 text-rose-600 rounded-full font-bold text-sm hover:bg-rose-100 transition-all border border-rose-200 mr-2"
            >
              <i className="fas fa-trash-alt"></i> 選択削除 ({selectedIds.length})
            </button>
          )}
          {activeTab === 'records' && (
            <>
              <button
                onClick={importV3Data}
                className="flex items-center gap-2 px-4 h-10 bg-indigo-600 text-white rounded-full font-bold text-sm hover:bg-indigo-700 transition-all shadow-sm"
                title="既存のV3データ取り込み"
              >
                <i className="fas fa-file-import"></i> V3データ取り込み
              </button>
              <button
                onClick={exportData}
                className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-100 transition-all"
                title="データエクスポート"
              >
                <i className="fas fa-download"></i>
              </button>
              <label className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center hover:bg-emerald-100 transition-all cursor-pointer" title="데이터인포트">
                <i className="fas fa-upload"></i>
                <input type="file" className="hidden" accept=".json" onChange={importData} />
              </label>
              <button
                onClick={() => setClearConfirm(true)}
                className="w-10 h-10 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center hover:bg-rose-100 transition-all"
                title="すべて削除"
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
          会員記録
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
          一時保管箱
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
          <i className="fas fa-globe mr-2"></i> すべて ({completedRecordsAll.length})
        </button>
        <button
          onClick={() => setSourceFilter('my_pc')}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center ${
            sourceFilter === 'my_pc' ? 'bg-blue-500 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <i className="fas fa-desktop mr-2"></i> マイPC ({myPcCount})
        </button>
        <button
          onClick={() => setSourceFilter('other_pc')}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center ${
            sourceFilter === 'other_pc' ? 'bg-slate-500 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <i className="fas fa-cloud mr-2"></i> 他PC ({otherPcCount})
        </button>
        <button
          onClick={() => setSourceFilter('lite')}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center ${
            sourceFilter === 'lite' ? 'bg-emerald-500 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <i className="fas fa-mobile-alt mr-2"></i> オンラインLITE ({liteCount})
        </button>
        {jointCount > 0 && (
          <button
            onClick={() => setSourceFilter('joint')}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center ${
              sourceFilter === 'joint' ? 'bg-purple-500 text-white shadow-md' : 'bg-white border border-purple-200 text-purple-600 hover:bg-purple-50'
            }`}
          >
            <i className="fas fa-link mr-2"></i> 合同イベント ({jointCount})
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
              placeholder="会員名検索..."
              className="w-full pl-12 pr-6 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

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
                          {(record.name || '?')[0]}
                        </div>
                        <div>
                            <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                              {record.name || '不明'}
                              {record.sourceType === 'LITE' ? (
                                record.eventCode && record.branchId !== currentBranchId ? (
                                  <span className="bg-purple-100 text-purple-600 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap"><i className="fas fa-link mr-1"></i>合同イベント</span>
                                ) : (
                                  <span className="bg-emerald-100 text-emerald-600 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap"><i className="fas fa-mobile-alt mr-1"></i>オンラインLITE</span>
                                )
                              ) : record.eventCode && record.branchId !== currentBranchId ? (
                                <span className="bg-purple-100 text-purple-600 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap"><i className="fas fa-link mr-1"></i>合同イベント</span>
                              ) : record.hardwareId !== currentDeviceId ? (
                                <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap"><i className="fas fa-cloud mr-1"></i>他PC</span>
                              ) : (
                                <span className="bg-blue-100 text-blue-600 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap"><i className="fas fa-desktop mr-1"></i>マイPC</span>
                              )}
                            </h4>
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{record.lastTestDate ? new Date(record.lastTestDate).toLocaleDateString() : '-'}</span>
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
                        <span className="text-xs font-semibold text-indigo-950 mb-0.5">合同イベント測定データ</span>
                        <span className="text-[10px] text-slate-400 font-mono truncate max-w-full">拠点 ID: {record.branchId?.substring(0, 8) || '不明'}</span>
                      </div>
                    ) : (
                      <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300">
                        <i className="fas fa-image text-3xl"></i>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 mb-6 text-xs px-1">
                    <div className="flex items-center justify-between">
                      <div className="text-slate-500">実年齢 <span className="font-bold text-slate-800">{record.report?.userInfo?.age || '-'}歳</span></div>
                      <div className="text-slate-500">総合スコア <span className="font-bold text-slate-800">{record.report?.overallScore || '-'}点</span></div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-slate-500">身体年齢 <span className="font-bold text-indigo-600">{record.report?.physicalAge || '-'}歳</span></div>
                      <div className="text-slate-500">顔年齢 <span className="font-bold text-rose-500">{record.report?.faceAgeEstimate || '-'}歳</span></div>
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
                    {!record.report?.overallScore ? '分析未完了 (待機中)' : '詳細レポート表示'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
               <i className="fas fa-folder-open text-5xl text-slate-200 mb-4"></i>
               <p className="text-slate-400 font-medium">検索結果がないか、保存されたデータがありません。</p>
               <p className="text-xs text-slate-300 mt-2">新しい測定を開始して記録を作成してください。</p>
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
              placeholder="一時保管された会員検索..."
              className="w-full pl-12 pr-6 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all shadow-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <i className="fas fa-info-circle text-amber-500 mt-0.5"></i>
            <p className="text-sm text-amber-700">
              測定は完了しましたが、AI分析が正常に終了しなかった記録です。<br/>
              「AI再分析開始」ボタンを押して分析を再開すると、正式な会員記録として保存されます。
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
                          {((record.name || '').replace('(분석 대기) ', '') || '?')[0]}
                        </div>
                        <div>
                            <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                              {record.name || '不明'}
                              {record.sourceType === 'LITE' ? (
                                <span className="bg-emerald-100 text-emerald-600 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap"><i className="fas fa-mobile-alt mr-1"></i>オンラインLITE</span>
                              ) : record.hardwareId !== currentDeviceId ? (
                                <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap"><i className="fas fa-cloud mr-1"></i>他PC</span>
                              ) : (
                                <span className="bg-blue-100 text-blue-600 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap"><i className="fas fa-desktop mr-1"></i>マイPC</span>
                              )}
                            </h4>
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">{record.lastTestDate ? new Date(record.lastTestDate).toLocaleDateString() : '-'}</span>
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
                    <i className="fas fa-microchip"></i> AI再分析開始
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
               <i className="fas fa-box-open text-5xl text-slate-200 mb-4"></i>
               <p className="text-slate-400 font-medium">分析待機中の一時データがありません。</p>
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
