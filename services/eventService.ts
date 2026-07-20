// 연합 행사 모드 및 실시간 대기열(waiting_list) Firestore 동기화를 담당하는 서비스
import { doc, setDoc, getDoc, collection, query, where, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { WaitingMember } from '../types';

/**
 * 4자리 랜덤 대문자 문자열 생성
 */
const generateRandomSuffix = (): string => {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
};

/**
 * 새 연합 행사 코드를 생성하고 Firestore에 활성화된 행사로 등록합니다.
 */
export const createEvent = async (branchId: string, branchName: string): Promise<string> => {
  const cleanBranchName = branchName.replace(/\s+/g, '').substring(0, 8);
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, ''); // YYMMDD
  const eventCode = `EVT_${cleanBranchName}_${dateStr}_${generateRandomSuffix()}`;

  try {
    const eventRef = doc(db, 'active_events', eventCode);
    await setDoc(eventRef, {
      eventCode,
      branchId,
      branchName,
      createdAt: Date.now(),
      status: 'active'
    });
    console.log(`[EventService] 새 연합 행사가 등록되었습니다. 코드: ${eventCode}`);
    return eventCode;
  } catch (error) {
    console.error('[EventService] 행사 코드 생성 중 오류가 발생했습니다.', error);
    throw error;
  }
};

/**
 * 입력된 행사 코드가 유효하고 활성화 상태인지 확인합니다.
 */
export const checkEventExists = async (eventCode: string): Promise<boolean> => {
  if (!eventCode || !eventCode.trim()) return false;
  try {
    const eventRef = doc(db, 'active_events', eventCode.trim());
    const snap = await getDoc(eventRef);
    if (snap.exists()) {
      return snap.data().status === 'active';
    }
    return false;
  } catch (error) {
    console.error('[EventService] 행사 코드 확인 실패:', error);
    return false;
  }
};

/**
 * 사전 접수된 대기 고객 정보를 Firestore waiting_list 컬렉션에 추가합니다.
 */
export const addToWaitingList = async (
  member: Omit<WaitingMember, 'id' | 'status' | 'createdAt'>
): Promise<string> => {
  const waitingId = `wait-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  
  // JSON 변환을 통한 딥 카피로 1차 안전 클린업
  const cleanedMember = JSON.parse(JSON.stringify(member));

  const newWaiting: WaitingMember = {
    ...cleanedMember,
    id: waitingId,
    status: 'waiting',
    createdAt: Date.now()
  };

  // 객체 내에 남아있을 수 있는 모든 undefined 필드를 확실히 소거
  Object.keys(newWaiting).forEach(key => {
    if ((newWaiting as any)[key] === undefined) {
      delete (newWaiting as any)[key];
    }
  });

  try {
    const docRef = doc(db, 'waiting_list', waitingId);
    await setDoc(docRef, newWaiting);
    console.log(`[EventService] 대기자 접수 성공: ${member.name} (ID: ${waitingId})`);
    return waitingId;
  } catch (error) {
    console.error('[EventService] 대기자 접수 중 오류 발생:', error);
    throw error;
  }
};

/**
 * 대기 리스트의 상태(대기중, 측정중, 완료)를 업데이트합니다.
 */
export const updateWaitingStatus = async (
  waitingId: string,
  status: 'waiting' | 'measuring' | 'completed'
): Promise<boolean> => {
  try {
    const docRef = doc(db, 'waiting_list', waitingId);
    await updateDoc(docRef, { status });
    console.log(`[EventService] 대기자 상태 업데이트 성공: ${waitingId} -> ${status}`);
    return true;
  } catch (error) {
    console.error('[EventService] 대기자 상태 업데이트 실패:', error);
    return false;
  }
};

/**
 * 대기 고객의 집중 상담 별표 상태(isStarred)를 업데이트합니다.
 */
export const updateWaitingStarred = async (
  waitingId: string,
  isStarred: boolean
): Promise<boolean> => {
  try {
    const docRef = doc(db, 'waiting_list', waitingId);
    await updateDoc(docRef, { isStarred });
    console.log(`[EventService] 대기자 별표 업데이트 성공: ${waitingId} -> ${isStarred}`);
    return true;
  } catch (error) {
    console.error('[EventService] 대기자 별표 업데이트 실패:', error);
    return false;
  }
};

/**
 * 실시간으로 활성화된 대기 리스트를 구독합니다.
 * 연합 행사 코드가 활성화되어 있다면 행사 코드를 기준으로 필터링하며,
 * 일반 모드인 경우에는 본인 지점(branchId)을 기준으로 필터링합니다.
 */
export const subscribeWaitingList = (
  branchId: string,
  eventCode: string | null,
  callback: (list: WaitingMember[]) => void
) => {
  const colRef = collection(db, 'waiting_list');
  let q;

  if (eventCode && eventCode.trim()) {
    // 연합 행사 모드: 행사 코드 일치 && 대기중(waiting) 상태
    q = query(
      colRef,
      where('eventCode', '==', eventCode.trim()),
      where('status', '==', 'waiting')
    );
    console.log(`[EventService] 실시간 대기 구독 활성화 (연합 코드 기준: ${eventCode})`);
  } else {
    // 일반 모드: 본인 지점 일치 && 대기중(waiting) 상태
    q = query(
      colRef,
      where('branchId', '==', branchId),
      where('status', '==', 'waiting')
    );
    console.log(`[EventService] 실시간 대기 구독 활성화 (지점 ID 기준: ${branchId})`);
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const list: WaitingMember[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as WaitingMember);
      });
      // 등록 순서(오름차순)대로 정렬
      list.sort((a, b) => a.createdAt - b.createdAt);
      callback(list);
    },
    (error) => {
      console.error('[EventService] 대기 구독 중 오류 발생:', error);
    }
  );
};

/**
 * 대기 고객 정보를 Firestore waiting_list 컬렉션에서 완전히 삭제합니다.
 */
export const deleteWaitingMember = async (waitingId: string): Promise<boolean> => {
  try {
    const docRef = doc(db, 'waiting_list', waitingId);
    await deleteDoc(docRef);
    console.log(`[EventService] 대기자 삭제 성공: ${waitingId}`);
    return true;
  } catch (error) {
    console.error('[EventService] 대기자 삭제 실패:', error);
    return false;
  }
};

