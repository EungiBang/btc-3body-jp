import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface Region {
  id: string;
  name: string;
  order: number;
}

export interface Branch {
  id: string;
  regionId: string;
  name: string;
  allowedLicenses: number;
  liteAllowedLicenses?: number;
  kfaceDailyLimit?: number;
  ktarotDailyLimit?: number;
}

export interface DeviceLicense {
  id: string; // Hardware UUID
  branchId: string;
  adminName: string;
  contact: string;
  status: 'pending' | 'active' | 'revoked';
  appVersion?: string; // 앱 버전 추가
  createdAt: any;
  lastActive: any;
  deviceType?: 'pc' | 'lite'; // 기기 타입 식별자 추가
}

// 4. 관리자 전용 제어 함수
export const getAllDevices = async (): Promise<DeviceLicense[]> => {
  const [pcSnap, liteSnap] = await Promise.all([
    getDocs(query(collection(db, 'devices'))),
    getDocs(query(collection(db, 'lite_devices')))
  ]);
  
  const devices: DeviceLicense[] = [];
  pcSnap.forEach((doc) => devices.push({ id: doc.id, deviceType: 'pc', ...doc.data() } as DeviceLicense));
  liteSnap.forEach((doc) => devices.push({ id: doc.id, deviceType: 'lite', ...doc.data() } as DeviceLicense));
  
  // 생성일 기준 내림차순 정렬
  return devices.sort((a, b) => {
    const timeA = a.createdAt?.toMillis?.() || 0;
    const timeB = b.createdAt?.toMillis?.() || 0;
    return timeB - timeA;
  });
};

export const updateDeviceStatus = async (hardwareId: string, status: 'active' | 'pending' | 'revoked', deviceType: 'pc' | 'lite' = 'lite') => {
  const collectionName = deviceType === 'pc' ? 'devices' : 'lite_devices';
  const docRef = doc(db, collectionName, hardwareId);
  await updateDoc(docRef, { status });
};

export const deleteDevice = async (hardwareId: string, deviceType: 'pc' | 'lite' = 'lite') => {
  const collectionName = deviceType === 'pc' ? 'devices' : 'lite_devices';
  const docRef = doc(db, collectionName, hardwareId);
  await deleteDoc(docRef);
};

export interface AdminUser {
  id: string; // userId
  name: string;
  role: 'master' | 'manager';
  createdAt: any;
  password?: string; // SHA-256 해시된 비밀번호
}

// SHA-256 해시 유틸리티 (Web Crypto API 사용)
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// 0. 관리자(Admin) 인증 및 계정 관리
export const adminLogin = async (userId: string, passwordInput: string): Promise<AdminUser | null> => {
  const docRef = doc(db, 'admin_users', userId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data();
    const hashedInput = await hashPassword(passwordInput);
    // 해시된 비밀번호 비교 (기존 평문 비밀번호도 호환)
    if (data.password === hashedInput || data.password === passwordInput) {
      // 평문 비밀번호가 남아있다면 해시로 자동 마이그레이션
      if (data.password === passwordInput && data.password !== hashedInput) {
        await updateDoc(docRef, { password: hashedInput });
      }
      return { id: snap.id, name: data.name, role: data.role, createdAt: data.createdAt };
    }
  }
  return null;
};

export const getAdminUsers = async (): Promise<AdminUser[]> => {
  const q = query(collection(db, 'admin_users'));
  const snapshot = await getDocs(q);
  const admins: AdminUser[] = [];
  snapshot.forEach((doc) => admins.push({ id: doc.id, ...doc.data() } as AdminUser));
  return admins;
};

export const saveAdminUser = async (user: Omit<AdminUser, 'createdAt'> & { password: string }) => {
  const docRef = doc(db, 'admin_users', user.id);
  const hashedPw = await hashPassword(user.password);
  await setDoc(docRef, {
    name: user.name,
    role: user.role,
    password: hashedPw,
    createdAt: serverTimestamp()
  });
};

// 비밀번호 변경 함수
export const changeAdminPassword = async (userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
  const docRef = doc(db, 'admin_users', userId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return { success: false, error: '존재하지 않는 계정입니다.' };

  const data = snap.data();
  const hashedCurrent = await hashPassword(currentPassword);

  // 현재 비밀번호 검증 (해시 또는 평문 호환)
  if (data.password !== hashedCurrent && data.password !== currentPassword) {
    return { success: false, error: '현재 비밀번호가 일치하지 않습니다.' };
  }

  if (newPassword.length < 6) {
    return { success: false, error: '새 비밀번호는 6자 이상이어야 합니다.' };
  }

  const hashedNew = await hashPassword(newPassword);
  await updateDoc(docRef, { password: hashedNew });
  return { success: true };
};

export const deleteAdminUser = async (userId: string) => {
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'admin_users', userId));
};

// 1. 시스템 기본 설정 (배포용 자동 승인 코드 등)
export const getSystemSettings = async () => {
  const docRef = doc(db, 'system_settings', 'config');
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return snap.data() as { autoApproveCode?: string; liteAutoApproveCode?: string };
  }
  return { autoApproveCode: '', liteAutoApproveCode: '' };
};

export const updateSystemSettings = async (autoApproveCode: string, liteAutoApproveCode?: string) => {
  const docRef = doc(db, 'system_settings', 'config');
  const updateData: any = { autoApproveCode: autoApproveCode || '' };
  if (liteAutoApproveCode !== undefined) {
    updateData.liteAutoApproveCode = liteAutoApproveCode || '';
  }
  await setDoc(docRef, updateData, { merge: true });
};

// 2. 지역(Region) 및 지점(Branch) 관리
export const getRegions = async (): Promise<Region[]> => {
  const q = query(collection(db, 'regions'));
  const snapshot = await getDocs(q);
  const regions: Region[] = [];
  snapshot.forEach((doc) => regions.push({ id: doc.id, ...doc.data() } as Region));
  return regions.sort((a, b) => (a.order || 0) - (b.order || 0));
};

export const getBranches = async (regionId?: string): Promise<Branch[]> => {
  const branchesRef = collection(db, 'branches');
  const q = regionId ? query(branchesRef, where('regionId', '==', regionId)) : query(branchesRef);
  const snapshot = await getDocs(q);
  const branches: Branch[] = [];
  snapshot.forEach((doc) => branches.push({ id: doc.id, ...doc.data() } as Branch));
  return branches.sort((a, b) => a.name.localeCompare(b.name));
};

export const saveRegion = async (region: Omit<Region, 'id'> & { id?: string }) => {
  const regionsRef = collection(db, 'regions');
  if (region.id) {
    await setDoc(doc(db, 'regions', region.id), region);
  } else {
    const docRef = doc(regionsRef);
    await setDoc(docRef, { ...region, id: docRef.id });
  }
};

export const deleteRegion = async (regionId: string) => {
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'regions', regionId));
};

export const saveBranch = async (branch: Omit<Branch, 'id'> & { id?: string }) => {
  const branchesRef = collection(db, 'branches');
  if (branch.id) {
    await setDoc(doc(db, 'branches', branch.id), branch);
  } else {
    const docRef = doc(branchesRef);
    await setDoc(docRef, { ...branch, id: docRef.id });
  }
};

export const deleteBranch = async (branchId: string) => {
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'branches', branchId));
};

// 3. 기기(Device) 라이센스 등록 및 검증 로직
export const checkDeviceStatus = async (hardwareId: string, appVersion?: string): Promise<DeviceLicense | null> => {
  const docRef = doc(db, 'lite_devices', hardwareId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const deviceData = { id: snap.id, ...snap.data() } as DeviceLicense;

    // ★ 핵심: 연결된 지점이 실제로 존재하는지 검증
    if (deviceData.branchId) {
      const branchRef = doc(db, 'branches', deviceData.branchId);
      const branchSnap = await getDoc(branchRef);
      if (!branchSnap.exists()) {
        // 지점이 삭제됨 → 기기 등록 무효화 (재인증 유도)
        console.warn(`[Auth] 기기 ${hardwareId}의 지점(${deviceData.branchId})이 삭제됨. 재인증 필요.`);
        await deleteDoc(docRef);
        return null;
      }
    }

    // 접속 시간 및 앱 버전 갱신
    const updateData: any = { lastActive: serverTimestamp() };
    if (appVersion) updateData.appVersion = appVersion;
    
    updateDoc(docRef, updateData).catch(() => {});
    return deviceData;
  }
  return null;
};

// 지점의 활성 기기 개수 확인 (라이트 버전은 할당량 제한에서 제외될 수 있으나 통계용으로 유지)
export const getActiveDeviceCount = async (branchId: string): Promise<number> => {
  const q = query(collection(db, 'lite_devices'), where('branchId', '==', branchId), where('status', '==', 'active'));
  const snapshot = await getDocs(q);
  return snapshot.size;
};

// 기기 등록 요청 (라이트 버전은 PC 버전의 할당량(Quota) 제한을 받지 않도록 우회)
export const requestDeviceRegistration = async (
  hardwareId: string, 
  branchId: string, 
  adminName: string, 
  contact: string,
  inputCode: string,
  appVersion?: string
): Promise<{ success: boolean; status: 'active' | 'pending'; error?: string }> => {
  
  // 1. 배포 코드 확인
  const settings = await getSystemSettings();
  // LITE 버전은 liteAutoApproveCode를 사용하여 검증
  const isCodeValid = settings.liteAutoApproveCode && settings.liteAutoApproveCode === inputCode;
  
  if (!isCodeValid) {
    return { success: false, status: 'pending', error: 'Invalid LITE authorization code.' };
  }

  // 2. 지점 정보 확인 및 라이트 버전 할당량 체크
  const branchDoc = await getDoc(doc(db, 'branches', branchId));
  if (!branchDoc.exists()) {
    return { success: false, status: 'pending', error: 'Center not found.' };
  }
  
  const branchData = branchDoc.data() as Branch;
  // 라이트 버전 고유의 라이센스 허용량 (지정되지 않았을 경우 기본 1대)
  const liteAllowedLicenses = branchData.liteAllowedLicenses !== undefined ? branchData.liteAllowedLicenses : 1;
  
  // 3. 현재 활성 라이트 기기 개수 확인
  const activeCount = await getActiveDeviceCount(branchId);
  
  if (activeCount >= liteAllowedLicenses) {
    return { 
      success: false, 
      status: 'pending', 
      error: `Online Lite license limit exceeded (${liteAllowedLicenses} devices allowed). Please contact headquarters for additional authorization.` 
    };
  }

  // 4. 할당량 이내 & 코드 정상 -> 라이트 전용 DB(lite_devices)에 자동 승인 완료 처리
  const newDevice: Omit<DeviceLicense, 'id'> = {
    branchId,
    adminName,
    contact,
    status: 'active',
    appVersion: appVersion || 'unknown',
    createdAt: serverTimestamp(),
    lastActive: serverTimestamp()
  };

  await setDoc(doc(db, 'lite_devices', hardwareId), newDevice);
  
  return { success: true, status: 'active' };
};


