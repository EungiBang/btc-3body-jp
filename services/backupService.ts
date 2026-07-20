import { MemberRecord } from '../types';
import { syncMemberToCloud, fetchMembersFromCloud } from './cloudSyncService';
import { getRecordsLocally } from './localDb';

const BACKUP_INTERVAL_MS = 30 * 60 * 1000; // 30분
const BACKUP_TIMESTAMP_KEY = 'btc_last_backup_time';
const BACKUP_COUNT_KEY = 'btc_last_backup_count';

let backupTimerId: ReturnType<typeof setInterval> | null = null;

/**
 * 전체 로컬 데이터를 클라우드에 백업합니다.
 * 로컬에만 있고 클라우드에 없는 레코드를 찾아 업로드합니다.
 */
export const performFullBackup = async (): Promise<{ synced: number; total: number }> => {
  const deviceStr = localStorage.getItem('currentDevice');
  if (!deviceStr) {
    return { synced: 0, total: 0 };
  }

  const device = JSON.parse(deviceStr);
  if (!device.branchId || !device.id) {
    return { synced: 0, total: 0 };
  }

  try {
    // 1. Electron 로컬 DB에서 모든 레코드 가져오기 (클라우드 병합 제외, 순수 로컬만)
    let localRecords: MemberRecord[] = [];
    if (window.electronAPI) {
      localRecords = await window.electronAPI.getMemberRecords();
    }

    if (localRecords.length === 0) {
      // IndexedDB fallback은 getRecordsLocally가 처리하므로 여기서는 skip
      return { synced: 0, total: 0 };
    }

    // 2. 클라우드에 이미 있는 레코드 ID 목록 가져오기
    const cloudRecords = await fetchMembersFromCloud(device.branchId);
    const cloudIds = new Set(cloudRecords.map(r => r.id));

    // 3. 클라우드에 없는 로컬 레코드 업로드
    let syncedCount = 0;
    for (const record of localRecords) {
      if (!cloudIds.has(record.id)) {
        try {
          await syncMemberToCloud(record, device.branchId, device.id, device.regionId);
          syncedCount++;
        } catch (e) {
          console.warn(`Backup failed for record ${record.id}:`, e);
        }
      }
    }

    // 4. 백업 시각 기록
    const now = new Date().toISOString();
    localStorage.setItem(BACKUP_TIMESTAMP_KEY, now);
    localStorage.setItem(BACKUP_COUNT_KEY, String(localRecords.length));

    console.log(`[Backup] 완료: ${syncedCount}/${localRecords.length}건 동기화`);
    return { synced: syncedCount, total: localRecords.length };
  } catch (e) {
    console.error('[Backup] 전체 백업 실패:', e);
    return { synced: 0, total: 0 };
  }
};

/**
 * 마지막 백업 시각을 반환합니다.
 */
export const getLastBackupTime = (): string | null => {
  return localStorage.getItem(BACKUP_TIMESTAMP_KEY);
};

/**
 * 마지막 백업 시점의 총 레코드 수를 반환합니다.
 */
export const getLastBackupCount = (): number => {
  const count = localStorage.getItem(BACKUP_COUNT_KEY);
  return count ? parseInt(count, 10) : 0;
};

/**
 * 30분 간격 자동 백업을 시작합니다. 앱 시작 시 호출.
 */
export const startAutoBackup = () => {
  if (backupTimerId) return; // 이미 실행 중

  // 앱 시작 후 1분 뒤 첫 백업 (네트워크/인증 안정화 대기)
  setTimeout(() => {
    performFullBackup().catch(console.error);
  }, 60 * 1000);

  // 이후 30분마다 반복
  backupTimerId = setInterval(() => {
    performFullBackup().catch(console.error);
  }, BACKUP_INTERVAL_MS);

  console.log('[Backup] 자동 백업 스케줄러 시작 (30분 간격)');
};

/**
 * 자동 백업을 중지합니다.
 */
export const stopAutoBackup = () => {
  if (backupTimerId) {
    clearInterval(backupTimerId);
    backupTimerId = null;
  }
};
