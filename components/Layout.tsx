import React, { useState, useEffect } from 'react';
import SettingsModal from './SettingsModal';
import { startAutoBackup, stopAutoBackup } from '../services/backupService';
import pkg from '../package.json';
import { BRAND_NAME, SUB_NAME } from '@shared/constants/brand';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [isTestActive, setIsTestActive] = useState(false);

  // 테스트 진행 중 헤더/푸터 숨기기 위한 이벤트 리스너
  useEffect(() => {
    const handleTestMode = (e: Event) => {
      setIsTestActive((e as CustomEvent).detail?.active ?? false);
    };
    window.addEventListener('test:mode', handleTestMode);
    return () => window.removeEventListener('test:mode', handleTestMode);
  }, []);

  // 자동 백업 스케줄러 (30분 간격)
  useEffect(() => {
    startAutoBackup();
    return () => stopAutoBackup();
  }, []);

  return (
    <div className="min-h-screen flex flex-col font-sans"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #171e33 40%, #0c1222 70%, #0a0f1d 100%)',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* ── 배경 ambient glow ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full opacity-20 animate-blob"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] rounded-full opacity-10 animate-blob animation-delay-4000"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)' }} />
        <div className="absolute top-[30%] right-[5%] w-[30%] h-[30%] rounded-full opacity-10 animate-blob animation-delay-2000"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.10) 0%, transparent 70%)' }} />
      </div>

      {/* ── 헤더 (테스트 진행 중에는 숨김) ── */}
      {!isTestActive && <header className="sticky top-0 z-50 px-5 py-3 flex items-center justify-between"
        style={{
          background: 'rgba(15, 23, 42, 0.72)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}
      >
        {/* Left: Logo */}
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg animate-glow-pulse"
              style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #0ea5e9 100%)' }}
            >
              <i className="fas fa-brain text-white text-xl" />
            </div>
            {/* 온라인 표시 점 */}
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full" />
          </div>
          <div>
            <h1 className="font-black text-slate-100 text-base tracking-tight leading-tight drop-shadow-sm">
              {BRAND_NAME}
            </h1>
            <p className="text-[10px] font-bold tracking-[0.20em] uppercase"
              style={{ color: '#4f46e5' }}>
              {SUB_NAME}
            </p>
          </div>
        </div>

        {/* Center: Step badge (optional) */}
        <div className="flex-1 flex justify-center">
          {title && (
            <div className="badge-primary px-4 py-1.5 text-[10px] animate-fade-in">
              {title}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* 메인으로 */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('nav:home'))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all"
            style={{
              background: 'rgba(255,255,255,0.80)',
              border: '1px solid rgba(99,102,241,0.18)',
              color: '#4f46e5',
              boxShadow: '0 2px 8px rgba(99,102,241,0.08)',
            }}
            title="Go to main screen"
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(79,70,229,0.10)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.80)')}
          >
            <i className="fas fa-house text-xs" />
            <span>Main</span>
          </button>

          {/* 회원관리 */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('nav:history'))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all"
            style={{
              background: 'rgba(255,255,255,0.80)',
              border: '1px solid rgba(99,102,241,0.18)',
              color: '#4f46e5',
              boxShadow: '0 2px 8px rgba(99,102,241,0.08)',
            }}
            title="Manage member history"
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(79,70,229,0.10)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.80)')}
          >
            <i className="fas fa-users text-xs" />
            <span>History</span>
          </button>

          {/* K-관상 (임시 중단)
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('nav:kface'))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all"
            style={{
              background: 'rgba(255,255,255,0.80)',
              border: '1px solid rgba(147,51,234,0.18)',
              color: '#9333ea',
              boxShadow: '0 2px 8px rgba(147,51,234,0.08)',
            }}
            title={t('common.kfaceTooltip', 'AI K-관상')}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(147,51,234,0.10)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.80)')}
          >
            <i className="fas fa-smile text-xs" />
            <span>{t('common.kface', 'K-관상')}</span>
          </button>
          */}

          {/* K타로 (임시 중단)
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('nav:ktarot'))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all"
            style={{
              background: 'rgba(255,255,255,0.80)',
              border: '1px solid rgba(217,70,239,0.18)',
              color: '#d946ef',
              boxShadow: '0 2px 8px rgba(217,70,239,0.08)',
            }}
            title={t('common.ktarotTooltip', 'AI K-타로')}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(217,70,239,0.10)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.80)')}
          >
            <i className="fas fa-star-and-crescent text-xs" />
            <span>{t('common.ktarot', 'K타로')}</span>
          </button>
          */}

          {/* 설정 */}
          <button
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300"
            style={{
              background: 'rgba(255,255,255,0.80)',
              border: '1px solid rgba(99,102,241,0.18)',
              color: '#64748b',
              boxShadow: '0 2px 8px rgba(99,102,241,0.08)',
            }}
            title="설정"
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.10)';
              (e.currentTarget as HTMLButtonElement).style.color = '#4f46e5';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.80)';
              (e.currentTarget as HTMLButtonElement).style.color = '#64748b';
            }}
          >
            <i className="fas fa-cog text-sm" />
          </button>
        </div>
      </header>}

      {/* ── 메인 콘텐츠 ── */}
      <main className="relative z-10 flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col h-full">
          {children}
        </div>
      </main>

      {/* ── 풋터 (테스트 진행 중에는 숨김) ── */}
      {!isTestActive && <footer className="relative z-10 py-3 text-center text-[11px] tracking-wider"
        style={{
          background: 'rgba(255,255,255,0.45)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255,255,255,0.50)',
          color: '#94a3b8',
        }}
      >
        © 2026 Brain Training Center.&nbsp;
        <span style={{ color: '#4f46e5', fontWeight: 700 }}>AI Analyzer Web</span>
      </footer>}

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};

export default Layout;


