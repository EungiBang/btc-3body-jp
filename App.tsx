
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import AssessmentFlow from './components/AssessmentFlow';
import BranchAuthScreen from './components/BranchAuthScreen';
import AdminDashboard from './components/AdminDashboard';
import { checkDeviceStatus } from './services/firebaseAuthService';
import { ErrorLogger } from './services/ErrorLogger';

type DeviceState = 'loading' | 'active' | 'pending' | 'revoked' | 'unregistered';

const App: React.FC = () => {
  const [deviceState, setDeviceState] = useState<DeviceState>('loading');
  
  // URL에 ?portal=btc_admin_secure 가 있으면 웹 관리자 모드로 인식
  const isAdminRoute = window.location.search.includes('portal=btc_admin_secure');

  useEffect(() => {
    // 전역 에러 감지기 설정
    const handleGlobalError = (event: ErrorEvent) => {
      ErrorLogger.logCrash('window.onerror', event.message || 'Unknown Global Error', event.error);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      ErrorLogger.logCrash('unhandledrejection', 'Unhandled Promise Rejection', event.reason);
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    // 관리자 모드인 경우 하드웨어 인증 로직 생략
    if (isAdminRoute) {
      setDeviceState('active'); // 실제 기능은 안쓰지만 로딩 스크린 해제용
      return;
    }

    const checkAuth = async () => {
      try {
        let hardwareId = localStorage.getItem('webDeviceId');
        if (!hardwareId) {
          hardwareId = 'web-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
          localStorage.setItem('webDeviceId', hardwareId);
        }
        let appVersion = '1.0.0'; // Default version for web

        // 업그레이드 시 로컬 스토리지에 버전만 갱신 (재인증 요구 안함)
        const lastAppVersion = localStorage.getItem('lastAppVersion');
        if (appVersion !== 'unknown' && lastAppVersion !== appVersion) {
          console.log(`[Auth] App version upgraded from ${lastAppVersion} to ${appVersion}. Automatically syncing version.`);
          localStorage.setItem('lastAppVersion', appVersion);
        }

        if (hardwareId === 'unknown') {
          console.warn('Hardware ID could not be determined. Using fallback.');
        }

        const device = await checkDeviceStatus(hardwareId, appVersion);
        
        if (!device) {
          setDeviceState('unregistered');
          localStorage.removeItem('currentDevice');
        } else {
          setDeviceState(device.status);
          localStorage.setItem('currentDevice', JSON.stringify(device));
        }
      } catch (e) {
        console.error("Auth check failed:", e);
        // 네트워크 오류 시, 이전에 인증 성공한 기록이 있으면 오프라인 허용
        const cached = localStorage.getItem('currentDevice');
        if (cached) {
          try {
            const cachedDevice = JSON.parse(cached);
            if (cachedDevice.status === 'active') {
              console.log('[Auth] 오프라인 fallback: 이전 인증 기록으로 진입');
              setDeviceState('active');
              return;
            }
          } catch {}
        }
        setDeviceState('unregistered');
      }
    };
    
    checkAuth();
  }, [isAdminRoute]);

  if (deviceState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  // 관리자 웹 모드 렌더링
  if (isAdminRoute) {
    return <AdminDashboard onClose={() => window.location.href = '/'} />;
  }

  return (
    <>
      {deviceState === 'active' && (
        <Layout>
          <AssessmentFlow />
        </Layout>
      )}

      {deviceState === 'pending' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900">
          <div className="bg-white max-w-md rounded-3xl p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
              <i className="fas fa-hourglass-half text-2xl"></i>
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Pending Approval</h2>
            <p className="text-slate-500 mb-6">Waiting for administrator approval.<br/>Please restart the app once approved.</p>
            <button onClick={() => window.location.reload()} className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">
              Refresh
            </button>
          </div>
        </div>
      )}

      {deviceState === 'revoked' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-rose-900">
          <div className="bg-white max-w-md rounded-3xl p-8 text-center shadow-2xl border-4 border-rose-500">
            <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
              <i className="fas fa-ban text-4xl"></i>
            </div>
            <h2 className="text-3xl font-black text-slate-800 mb-2">Access Revoked</h2>
            <p className="text-slate-600 font-medium leading-relaxed">
              The license for this device has been revoked by the administrator.<br/>
              This program can no longer be used.
            </p>
          </div>
        </div>
      )}

      {deviceState === 'unregistered' && (
        <BranchAuthScreen onVerified={() => setDeviceState('active')} />
      )}
    </>
  );
};

export default App;
