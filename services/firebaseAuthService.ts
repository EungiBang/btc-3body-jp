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

// 초기 마스터 계정 보장 (DB에 없으면 기본 비밀번호로 생성)
const ensureMasterAccount = async (): Promise<void> => {
  const docRef = doc(db, 'admin_users', 'admin');
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    const hashedPw = await hashPassword('BTCADMIN2026');
    await setDoc(docRef, {
      name: 'Master',
      role: 'master',
      password: hashedPw,
      createdAt: serverTimestamp()
    });
  }
};

// 0. 관리자(Admin) 인증 및 계정 관리
export const adminLogin = async (userId: string, passwordInput: string): Promise<AdminUser | null> => {
  // 초기 마스터 계정 보장
  await ensureMasterAccount();

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

const initialRegions = [
  { id: 'jp-sapporo', name: '札幌', order: 1 },
  { id: 'jp-tokyo1', name: '東京1', order: 2 },
  { id: 'jp-tokyo2', name: '東京2', order: 3 },
  { id: 'jp-tokyo3', name: '東京3', order: 4 },
  { id: 'jp-yokohama', name: '横浜', order: 5 },
  { id: 'jp-nagoya1', name: '名古屋1', order: 6 },
  { id: 'jp-nagoya2', name: '名古屋2', order: 7 },
  { id: 'jp-toyota', name: '豊田', order: 8 },
  { id: 'jp-kyotonara', name: '京都奈良', order: 9 },
  { id: 'jp-osaka1', name: '大阪1', order: 10 },
  { id: 'jp-osaka2', name: '大阪2', order: 11 },
  { id: 'jp-kobe', name: '神戸', order: 12 },
  { id: 'jp-okayama', name: '岡山', order: 13 },
  { id: 'jp-hiroshima', name: '広島', order: 14 },
  { id: 'jp-kyushu', name: '九州', order: 15 },
  { id: 'jp-kakuremino', name: 'カクレミノ家', order: 16 }
];

const initialBranches = [
  { id: 'br-sapporo', regionId: 'jp-sapporo', name: '札幌' },
  { id: 'br-shinjuku', regionId: 'jp-tokyo1', name: '新宿四谷' },
  { id: 'br-ginza', regionId: 'jp-tokyo1', name: '銀座' },
  { id: 'br-kichijoji', regionId: 'jp-tokyo1', name: '吉祥寺' },
  { id: 'br-tokorozawa', regionId: 'jp-tokyo1', name: '所沢' },
  { id: 'br-hachioji', regionId: 'jp-tokyo1', name: '八王子' },
  { id: 'br-nakano', regionId: 'jp-tokyo1', name: '中野' },
  { id: 'br-kinshicho', regionId: 'jp-tokyo2', name: '錦糸町' },
  { id: 'br-funabashi', regionId: 'jp-tokyo2', name: '船橋' },
  { id: 'br-matsudo', regionId: 'jp-tokyo2', name: '松戸' },
  { id: 'br-iwaki', regionId: 'jp-tokyo2', name: '(C)いわき' },
  { id: 'br-omiya', regionId: 'jp-tokyo3', name: '大宮' },
  { id: 'br-ikebukuro', regionId: 'jp-tokyo3', name: '池袋' },
  { id: 'br-narimasu', regionId: 'jp-tokyo3', name: '成増' },
  { id: 'br-yokohama', regionId: 'jp-yokohama', name: '橫浜' },
  { id: 'br-machida', regionId: 'jp-yokohama', name: '町田' },
  { id: 'br-kamiooka', regionId: 'jp-yokohama', name: '上大岡' },
  { id: 'br-yokosuka', regionId: 'jp-yokohama', name: '横須賀' },
  { id: 'br-tsujido', regionId: 'jp-yokohama', name: '辻堂' },
  { id: 'br-kanayama', regionId: 'jp-nagoya1', name: '金山' },
  { id: 'br-gifu', regionId: 'jp-nagoya1', name: '岐阜' },
  { id: 'br-shizuoka', regionId: 'jp-nagoya1', name: '静岡' },
  { id: 'br-issha', regionId: 'jp-nagoya1', name: '一社' },
  { id: 'br-okazaki', regionId: 'jp-nagoya1', name: '(C)岡崎' },
  { id: 'br-nagoyakusunoki', regionId: 'jp-nagoya1', name: '(C)名古屋楠' },
  { id: 'br-nagoya', regionId: 'jp-nagoya2', name: '名古屋' },
  { id: 'br-yagoto', regionId: 'jp-nagoya2', name: '八事' },
  { id: 'br-toyota', regionId: 'jp-toyota', name: '豊田' },
  { id: 'br-aratamabashi', regionId: 'jp-toyota', name: '新瑞橋' },
  { id: 'br-kyotoshi-jo', regionId: 'jp-kyotonara', name: '京都四条烏丸' },
  { id: 'br-fushimi', regionId: 'jp-kyotonara', name: '伏見' },
  { id: 'br-nara', regionId: 'jp-kyotonara', name: '奈良' },
  { id: 'br-kashihara', regionId: 'jp-kyotonara', name: '橿原' },
  { id: 'br-yoshino', regionId: 'jp-kyotonara', name: '吉野' },
  { id: 'br-shugakuin', regionId: 'jp-kyotonara', name: '修学院' },
  { id: 'br-zeze', regionId: 'jp-kyotonara', name: '膳所' },
  { id: 'br-ikoma', regionId: 'jp-kyotonara', name: '生駒' },
  { id: 'br-seiwadai', regionId: 'jp-kyotonara', name: '星和台' },
  { id: 'br-kyobashi', regionId: 'jp-osaka1', name: '京橋' },
  { id: 'br-hirakata', regionId: 'jp-osaka1', name: '枚方' },
  { id: 'br-sakaihigashi', regionId: 'jp-osaka1', name: '堺東' },
  { id: 'br-neyagawa', regionId: 'jp-osaka1', name: '寝屋川' },
  { id: 'br-ishibashi', regionId: 'jp-osaka2', name: '石橋' },
  { id: 'br-umeda', regionId: 'jp-osaka2', name: '梅田' },
  { id: 'br-mikage', regionId: 'jp-kobe', name: '御影' },
  { id: 'br-nishinomiya', regionId: 'jp-kobe', name: '西宮' },
  { id: 'br-rokkodo', regionId: 'jp-kobe', name: '六甲道' },
  { id: 'br-kobeshinnagata', regionId: 'jp-kobe', name: '神戶新長田' },
  { id: 'br-himeji', regionId: 'jp-kobe', name: '姫路' },
  { id: 'br-tarumi', regionId: 'jp-kobe', name: '垂水' },
  { id: 'br-takarazuka', regionId: 'jp-kobe', name: '宝塚' },
  { id: 'br-akashi', regionId: 'jp-kobe', name: '明石' },
  { id: 'br-yumoto', regionId: 'jp-kobe', name: '(C)ゆもと' },
  { id: 'br-koshien-guchi', regionId: 'jp-kobe', name: '(C)甲子園口' },
  { id: 'br-harimaotsu', regionId: 'jp-kobe', name: '(C)はりま大津' },
  { id: 'br-okayama', regionId: 'jp-okayama', name: '岡山' },
  { id: 'br-hiroshima', regionId: 'jp-hiroshima', name: '広島' },
  { id: 'br-yaga', regionId: 'jp-kyushu', name: '矢賀' },
  { id: 'br-tenjin', regionId: 'jp-kyushu', name: '天神' },
  { id: 'br-kokura', regionId: 'jp-kyushu', name: '小倉' },
  { id: 'br-shimosone', regionId: 'jp-kyushu', name: '下曽根' },
  { id: 'br-takasu', regionId: 'jp-kyushu', name: '高須' },
  { id: 'br-gotanda', regionId: 'jp-kakuremino', name: '五反田店' },
  { id: 'br-fujisawa', regionId: 'jp-kakuremino', name: '藤沢店' },
  { id: 'br-oosu', regionId: 'jp-kakuremino', name: '大須店' },
  { id: 'br-naraekimae', regionId: 'jp-kakuremino', name: '奈良駅前店' },
  { id: 'br-shinsaibashi', regionId: 'jp-kakuremino', name: '心斎橋店' },
  { id: 'br-tennoji', regionId: 'jp-kakuremino', name: '天왕지점' },
  { id: 'br-tennoji', regionId: 'jp-kakuremino', name: '天王寺店' },
  { id: 'br-kobemotomachi', regionId: 'jp-kakuremino', name: '神戸元町店' },
  { id: 'br-hiroshimaten', regionId: 'jp-kakuremino', name: '広島店' }
];

const ensureInitialRegionsAndBranches = async (): Promise<void> => {
  const regionsRef = collection(db, 'regions');
  const snap = await getDocs(query(regionsRef));
  if (snap.empty) {
    console.log('[Seed] 일본 전용 초기 지역/지점 데이터 시딩 시작');
    for (const r of initialRegions) {
      await setDoc(doc(db, 'regions', r.id), r);
    }
    for (const b of initialBranches) {
      await setDoc(doc(db, 'branches', b.id), {
        ...b,
        allowedLicenses: 5,
        liteAllowedLicenses: 5
      });
    }
    const settingsRef = doc(db, 'system_settings', 'config');
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) {
      await setDoc(settingsRef, {
        autoApproveCode: 'BTCADMIN2026',
        liteAutoApproveCode: 'BTCLITE2026'
      });
    }
    console.log('[Seed] 일본 전용 초기 데이터 시딩 완료');
  }
};

// 2. 지역(Region) 및 지점(Branch) 관리
export const getRegions = async (): Promise<Region[]> => {
  await ensureInitialRegionsAndBranches();
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


