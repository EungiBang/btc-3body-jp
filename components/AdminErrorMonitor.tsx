import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLog } from '../services/ErrorLogger';

interface AdminErrorMonitorProps {
  branches: { id: string; name: string }[];
  regions: { id: string; name: string }[];
}

export const AdminErrorMonitor: React.FC<AdminErrorMonitorProps> = ({ branches, regions }) => {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'new' | 'resolved'>('all');
  const [filterType, setFilterType] = useState<'all' | 'api' | 'crash' | 'unknown'>('all');
  
  // To track newly arrived errors for alerting
  const prevLogsCountRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio for alert
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // short alert ping
    
    const q = query(
      collection(db, 'error_logs'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLogs: ErrorLog[] = [];
      snapshot.forEach(document => {
        fetchedLogs.push({ id: document.id, ...document.data() } as ErrorLog);
      });

      // Play sound if there are new unresolved errors
      const newErrorsCount = fetchedLogs.filter(l => l.status === 'new').length;
      if (newErrorsCount > prevLogsCountRef.current && audioRef.current) {
        audioRef.current.play().catch(e => console.error('Audio play prevented:', e));
      }
      prevLogsCountRef.current = newErrorsCount;

      setLogs(fetchedLogs);
    });

    return () => unsubscribe();
  }, []);

  const handleStatusChange = async (id: string, newStatus: 'new' | 'viewed' | 'resolved') => {
    try {
      await updateDoc(doc(db, 'error_logs', id), { status: newStatus });
    } catch (e) {
      alert('상태 변경 실패');
    }
  };

  const filteredLogs = logs.filter(log => {
    if (filterStatus !== 'all' && log.status !== filterStatus) return false;
    if (filterType !== 'all' && log.type !== filterType) return false;
    return true;
  });

  const newCount = logs.filter(l => l.status === 'new').length;

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">🚨 실시간 에러 모니터링</h2>
          <p className="text-xs text-slate-400">지점에서 발생하는 심각한 에러와 API 통신 실패를 실시간으로 감지합니다.</p>
        </div>
        <div className="flex gap-2">
          {newCount > 0 && (
            <div className="animate-pulse bg-rose-100 text-rose-700 px-4 py-2 rounded-xl font-bold text-sm flex items-center">
              <i className="fas fa-exclamation-triangle mr-2"></i>새로운 에러 {newCount}건
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap bg-slate-50 p-4 rounded-xl border border-slate-200">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="px-3 py-2 border rounded-xl text-sm outline-none focus:border-indigo-500">
          <option value="all">모든 상태</option>
          <option value="new">신규 (미확인)</option>
          <option value="resolved">해결됨</option>
        </select>
        
        <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="px-3 py-2 border rounded-xl text-sm outline-none focus:border-indigo-500">
          <option value="all">모든 타입</option>
          <option value="api">API 에러</option>
          <option value="crash">앱 크래시</option>
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto border rounded-2xl bg-white shadow-sm">
        {filteredLogs.length === 0 ? (
           <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-2 py-12">
             <span className="text-4xl">✅</span>
             <span className="font-bold">발견된 에러가 없습니다</span>
           </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 sticky top-0 z-10 text-slate-500 uppercase text-xs">
              <tr>
                <th className="p-4 font-bold">상태</th>
                <th className="p-4 font-bold">발생 시간</th>
                <th className="p-4 font-bold">지점 / 버전</th>
                <th className="p-4 font-bold">타입 / 출처</th>
                <th className="p-4 font-bold">에러 메시지</th>
                <th className="p-4 font-bold text-center">관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => {
                const isNew = log.status === 'new';
                const timeStr = log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : '-';
                
                let branchName = '알 수 없음';
                let regionName = '';
                if (log.deviceInfo?.branchId) {
                  const b = branches.find(b => b.id === log.deviceInfo.branchId);
                  if (b) {
                    branchName = b.name;
                    const r = regions.find(r => r.id === (b as any).regionId);
                    if (r) regionName = r.name;
                  }
                }

                return (
                  <tr key={log.id} className={`border-t border-slate-100 ${isNew ? 'bg-rose-50/50' : 'hover:bg-slate-50'}`}>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        isNew ? 'bg-rose-100 text-rose-700' : 
                        log.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {log.status === 'new' ? '신규' : log.status === 'resolved' ? '해결됨' : '확인중'}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-500 whitespace-nowrap">{timeStr}</td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{regionName ? `${regionName} > ${branchName}` : branchName}</div>
                      <div className="text-xs text-slate-400 font-mono">v{log.appVersion || '1.0.0'}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.type === 'api' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                        {log.type.toUpperCase()}
                      </span>
                      <div className="text-xs text-slate-500 mt-1">{log.source}</div>
                    </td>
                    <td className="p-4 max-w-md">
                      <div className="font-bold text-slate-700 mb-1">{log.message}</div>
                      {log.stackTrace && (
                        <details className="text-xs text-slate-400 bg-slate-50 p-2 rounded cursor-pointer">
                          <summary className="font-bold select-none">상세 스택 (클릭하여 열기)</summary>
                          <pre className="mt-2 whitespace-pre-wrap overflow-x-auto p-2 bg-slate-800 text-emerald-400 rounded">
                            {log.stackTrace}
                          </pre>
                        </details>
                      )}
                    </td>
                    <td className="p-4 text-center space-y-2 flex flex-col">
                      {isNew && (
                        <button onClick={() => handleStatusChange(log.id!, 'resolved')} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded text-xs font-bold whitespace-nowrap transition-colors">
                          해결 처리
                        </button>
                      )}
                      {!isNew && log.status !== 'resolved' && (
                        <button onClick={() => handleStatusChange(log.id!, 'resolved')} className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded text-xs font-bold whitespace-nowrap transition-colors">
                          해결 처리
                        </button>
                      )}
                      {log.status === 'resolved' && (
                        <button onClick={() => handleStatusChange(log.id!, 'new')} className="px-3 py-1.5 border border-slate-200 text-slate-400 hover:bg-slate-50 rounded text-xs font-bold whitespace-nowrap transition-colors">
                          다시 열기
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
