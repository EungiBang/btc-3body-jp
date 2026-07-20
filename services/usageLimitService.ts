import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';

export interface UsageStatus {
  kfaceLimit: number;
  kfaceUsed: number;
  ktarotLimit: number;
  ktarotUsed: number;
}

const getTodayString = () => {
  // 브라우저 로컬 시간 기준 YYYY-MM-DD
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getUsageStatus = async (branchId: string): Promise<UsageStatus> => {
  if (!branchId) {
    return { kfaceLimit: 30, kfaceUsed: 0, ktarotLimit: 30, ktarotUsed: 0 };
  }

  try {
    // 1. Get branch limits
    const branchRef = doc(db, 'branches', branchId);
    const branchSnap = await getDoc(branchRef);
    let kfaceLimit = 30;
    let ktarotLimit = 30;
    
    if (branchSnap.exists()) {
      const data = branchSnap.data();
      if (typeof data.kfaceDailyLimit === 'number') kfaceLimit = data.kfaceDailyLimit;
      if (typeof data.ktarotDailyLimit === 'number') ktarotLimit = data.ktarotDailyLimit;
    }

    // 2. Get today's usage
    const todayStr = getTodayString();
    const usageRef = doc(db, 'daily_usages', `${branchId}_${todayStr}`);
    const usageSnap = await getDoc(usageRef);
    
    let kfaceUsed = 0;
    let ktarotUsed = 0;
    
    if (usageSnap.exists()) {
      const data = usageSnap.data();
      kfaceUsed = data.kfaceCount || 0;
      ktarotUsed = data.ktarotCount || 0;
    }

    return { kfaceLimit, kfaceUsed, ktarotLimit, ktarotUsed };
  } catch (error) {
    console.warn('사용량 정보를 가져오는데 실패했습니다 (오프라인 등). 기본값을 사용합니다.', error);
    return { kfaceLimit: 30, kfaceUsed: 0, ktarotLimit: 30, ktarotUsed: 0 };
  }
};

export const incrementUsage = async (branchId: string, type: 'kface' | 'ktarot'): Promise<void> => {
  if (!branchId) return;

  try {
    const todayStr = getTodayString();
    const usageRef = doc(db, 'daily_usages', `${branchId}_${todayStr}`);
    
    const usageSnap = await getDoc(usageRef);
    if (!usageSnap.exists()) {
      await setDoc(usageRef, {
        kfaceCount: type === 'kface' ? 1 : 0,
        ktarotCount: type === 'ktarot' ? 1 : 0,
        date: todayStr,
        branchId
      });
    } else {
      const field = type === 'kface' ? 'kfaceCount' : 'ktarotCount';
      await updateDoc(usageRef, {
        [field]: increment(1)
      });
    }
  } catch (error) {
    console.warn('사용량 증가에 실패했습니다:', error);
  }
};

export const updateDailyLimit = async (branchId: string, kfaceLimit: number, ktarotLimit: number): Promise<void> => {
  if (!branchId) return;
  const branchRef = doc(db, 'branches', branchId);
  await setDoc(branchRef, {
    kfaceDailyLimit: kfaceLimit,
    ktarotDailyLimit: ktarotLimit
  }, { merge: true });
};
