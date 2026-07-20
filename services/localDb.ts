import { MemberRecord } from '../types';
import { syncMemberToCloud, fetchMembersFromCloud, fetchMembersByEventCode, deleteMemberFromCloud } from './cloudSyncService';

// V4 전용 DB — V3 데이터(btc_local_db / members-db.json)와 완전 분리
const DB_NAME = 'btc_local_db_v4';
const STORE_NAME = 'member_records_v4';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const saveRecordLocally = async (record: MemberRecord): Promise<boolean> => {
  let pureRecord: MemberRecord;
  try {
    pureRecord = JSON.parse(JSON.stringify(record));
  } catch (e) {
    console.error("Stringify error before DB save:", e);
    pureRecord = record; // 최후의 수단
  }

  // 야외용 라이트 버전 명시적 마킹
  pureRecord.sourceType = 'LITE';

  if (window.electronAPI) {
    try {
      const electronSaveSuccess = await window.electronAPI.saveMemberRecord(pureRecord);
      if (electronSaveSuccess) {
        // 클라우드 동기화
        try {
          const deviceStr = localStorage.getItem('currentDevice');
          if (deviceStr) {
            const device = JSON.parse(deviceStr);
            if (device.branchId && device.id) {
              const activeEventCode = localStorage.getItem('activeEventCode') || undefined;
              syncMemberToCloud(pureRecord, device.branchId, device.id, device.regionId, activeEventCode).catch(console.error);
            }
          }
        } catch (e) {
          console.error('Cloud sync failed in electron', e);
        }
      }
      return electronSaveSuccess;
    } catch (err) {
      console.error("Electron DB save error:", err);
      // 의도적인 런타임 오류 시 fallback 으로 진행
    }
  }
  
  // IndexedDB Fallback (Browser environment or Electron fallback)
  try {
    const db = await initDB();
    const localSaveSuccess = await new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(pureRecord);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });

    if (localSaveSuccess) {
      // 클라우드 동기화 시도 (Non-blocking)
      try {
        const deviceStr = localStorage.getItem('currentDevice');
        if (deviceStr) {
          const device = JSON.parse(deviceStr);
          if (device.branchId && device.id) {
            const activeEventCode = localStorage.getItem('activeEventCode') || undefined;
            syncMemberToCloud(pureRecord, device.branchId, device.id, device.regionId, activeEventCode).catch(console.error);
          }
        }
      } catch (e) {
        console.error('Cloud sync failed locally', e);
      }
    }

    return localSaveSuccess;

  } catch (error) {
    console.error("IndexedDB Save Error:", error);
    return false;
  }
};

export const getRecordsLocally = async (): Promise<MemberRecord[]> => {
  let localRecords: MemberRecord[] = [];

  if (window.electronAPI) {
    try {
      localRecords = await window.electronAPI.getMemberRecords();
    } catch (err) {
      console.error("Electron DB load error:", err);
    }
  }
  
  if (localRecords.length === 0) {
    try {
      const db = await initDB();
      localRecords = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (error) {
      console.error("IndexedDB Load Error:", error);
    }
  }

  // V4 전용 클라우드 동기화 (같은 지점의 다른 PC에서 저장된 V4 데이터만 병합)
  try {
    const deviceStr = localStorage.getItem('currentDevice');
    if (deviceStr) {
      const device = JSON.parse(deviceStr);
      if (device.branchId) {
        const cloudRecords = await fetchMembersFromCloud(device.branchId);
        
        // 로컬 레코드와 V4 클라우드 레코드를 ID 기준으로 병합 (로컬 우선 — 이미지 보존)
        const recordMap = new Map<string, MemberRecord>();
        // 클라우드 먼저 넣고
        cloudRecords.forEach(r => recordMap.set(r.id, r));
        // 로컬로 덮어쓰기 (로컬에 이미지가 있으므로 우선)
        localRecords.forEach(r => recordMap.set(r.id, r));
        
        // 합동 행사 모드: eventCode로 다른 지점 데이터도 병합
        const activeEventCode = localStorage.getItem('activeEventCode');
        if (activeEventCode) {
          const eventRecords = await fetchMembersByEventCode(activeEventCode, device.branchId);
          eventRecords.forEach(r => {
            if (!recordMap.has(r.id)) {
              recordMap.set(r.id, r);
            }
          });
        }

        localRecords = Array.from(recordMap.values());

        // 로컬에만 있고 클라우드에 없는 V4 레코드 → 자동 업로드 (자가 치유)
        localRecords.forEach(local => {
          if (!cloudRecords.some(cr => cr.id === local.id)) {
            syncMemberToCloud(local, device.branchId, device.id, device.regionId).catch(console.error);
          }
        });
      }
    }
  } catch (e) {
    console.error('Failed to merge cloud records', e);
  }

  return localRecords;
};

export const deleteRecordLocally = async (id: string): Promise<boolean> => {
  // 1. 클라우드에서도 삭제 (재병합 방지)
  try {
    await deleteMemberFromCloud(id);
  } catch (e) {
    console.error('Cloud delete failed (non-critical):', e);
  }

  // 2. Electron 로컬 DB 삭제
  if (window.electronAPI) {
    try {
      return await window.electronAPI.deleteMemberRecord(id);
    } catch (err) {
      console.error("Electron DB delete error:", err);
    }
  }
  
  // 3. IndexedDB Fallback
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.error("IndexedDB Delete Error:", error);
    return false;
  }
};
