import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrainTestData } from '../types';
import { speak, stopSpeaking } from '../services/ttsService';

interface TmtBrainTestModuleProps {
  onComplete: (dataUrl: string, brainTestData: BrainTestData) => void;
}

type TmtPhase = 'intro' | 'round1_ready' | 'round1_play' | 'round1_result' | 'round2_ready' | 'round2_play' | 'round2_result' | 'result';

interface Ball {
  id: string;
  color: 'green' | 'blue' | 'red';
  colorHex: string;
  colorHexDark: string;
  number: number;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  isClicked: boolean;
}

interface ClickEffect {
  id: string;
  x: number;
  y: number;
  color: string;
}

const COLORS = [
  { id: 'green', hex: '#10b981', hexDark: '#047857', name: 'Green', gradient: 'from-emerald-400 to-emerald-600', shadow: 'shadow-emerald-500/50' },
  { id: 'blue', hex: '#3b82f6', hexDark: '#1d4ed8', name: 'Blue', gradient: 'from-blue-400 to-blue-600', shadow: 'shadow-blue-500/50' },
  { id: 'red', hex: '#ef4444', hexDark: '#b91c1c', name: 'Red', gradient: 'from-rose-400 to-rose-600', shadow: 'shadow-rose-500/50' }
] as const;

const NUM_BALLS_PER_COLOR = 10;
const ROUND_TIME_LIMIT = 15; // 15 seconds

// --- Web Audio API Sounds ---
const audioCtxRef = { current: null as AudioContext | null };
const initAudio = () => {
  if (!audioCtxRef.current) {
    audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
};

const playSound = (type: 'tick' | 'correct' | 'wrong' | 'complete') => {
  if (!audioCtxRef.current) return;
  const ctx = audioCtxRef.current;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  const now = ctx.currentTime;
  if (type === 'tick') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.1);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'correct') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (type === 'wrong') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.15);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'complete') {
    // Play a chord (C major arpeggio)
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.value = freq;
      const startTime = now + i * 0.1;
      g.gain.setValueAtTime(0, startTime);
      g.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);
      o.start(startTime);
      o.stop(startTime + 0.5);
    });
  }
};

export const TmtBrainTestModule: React.FC<TmtBrainTestModuleProps> = ({ onComplete }) => {
  const [isPortraitMode, setIsPortraitMode] = useState(false); // 가로모드 기본
  const [phase, setPhase] = useState<TmtPhase>('intro');
  const [balls, setBalls] = useState<Ball[]>([]);
  
  // Round states
  const [targetColor, setTargetColor] = useState<typeof COLORS[number]>(COLORS[0]);
  const [currentNumber, setCurrentNumber] = useState<number>(1);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME_LIMIT);
  const [timeMs, setTimeMs] = useState(ROUND_TIME_LIMIT * 1000);
  
  // Scoring states
  const [reactionErrors, setReactionErrors] = useState(0);
  const [clickTimes, setClickTimes] = useState<number[]>([]);
  const lastClickTimeRef = useRef<number>(0);
  
  // Visual feedback
  const [screenFeedback, setScreenFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const [effects, setEffects] = useState<ClickEffect[]>([]);
  
  const timerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Generate non-overlapping balls using Grid approach
  const generateBalls = useCallback(() => {
    const newBalls: Ball[] = [];
    
    // Divide screen into grid to ensure even distribution
    // We need 30 balls, a 6x5 grid gives 30 cells. Let's use 7x5 to leave some empty spaces
    const cols = 7;
    const rows = 5;
    const cells = Array.from({length: cols * rows}, (_, i) => i);
    // Shuffle cells
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    
    let ballCount = 0;
    
    COLORS.forEach(c => {
      for (let i = 1; i <= NUM_BALLS_PER_COLOR; i++) {
        const cellIdx = cells[ballCount++];
        const col = cellIdx % cols;
        const row = Math.floor(cellIdx / cols);
        
        // Add some jitter within the cell
        const cellWidth = 100 / cols;
        const cellHeight = 100 / rows;
        
        // 10% padding within cell to avoid edge clipping
        const paddingX = cellWidth * 0.2;
        const paddingY = cellHeight * 0.2;
        
        const x = (col * cellWidth) + paddingX + Math.random() * (cellWidth - paddingX * 2);
        const y = (row * cellHeight) + paddingY + Math.random() * (cellHeight - paddingY * 2);
        
        newBalls.push({
          id: `${c.id}-${i}`,
          color: c.id,
          colorHex: c.hex,
          colorHexDark: c.hexDark,
          number: i,
          x,
          y,
          isClicked: false
        });
      }
    });
    
    setBalls(newBalls.sort(() => Math.random() - 0.5));
  }, []);

  // Intro narration
  useEffect(() => {
    if (phase === 'intro') {
      speak('This is the cognitive reaction test. Click the balls with target color and correct number order in 15 seconds. Press start button when you are ready.');
    }
  }, [phase]);

  // Frame-based timer
  useEffect(() => {
    let lastTime = performance.now();
    
    const updateTimer = (currentTime: number) => {
      if (phase !== 'round1_play' && phase !== 'round2_play') return;
      
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;
      
      setTimeMs(prev => {
        const newMs = prev - deltaTime;
        if (newMs <= 0) {
          handleTimeUp();
          return 0;
        }
        return newMs;
      });
      
      timerRef.current = requestAnimationFrame(updateTimer);
    };

    if (phase === 'round1_play' || phase === 'round2_play') {
      lastTime = performance.now();
      timerRef.current = requestAnimationFrame(updateTimer);
    }
    
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, [phase, currentNumber]);

  useEffect(() => {
    setTimeLeft(Math.ceil(timeMs / 1000));
  }, [timeMs]);

  const handleTimeUp = useCallback(() => {
    if (timerRef.current) cancelAnimationFrame(timerRef.current);
    
    const remainingCount = phase === 'round1_play' ? (11 - currentNumber) : currentNumber;
    for(let i=0; i<Math.max(1, remainingCount); i++) {
        setClickTimes(prev => [...prev, 2000]);
    }
    setReactionErrors(prev => prev + 1);
    playSound('wrong');
    
    if (phase === 'round1_play') {
      speak("Time out.");
      setPhase('round1_result');
    } else {
      speak("Time out.");
      setPhase('round2_result');
    }
  }, [phase, currentNumber]);

  const startGame = () => {
    initAudio();
    stopSpeaking();
    setupRound1();
  };

  const setupRound1 = () => {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    setTargetColor(color);
    setCurrentNumber(1);
    setTimeMs(ROUND_TIME_LIMIT * 1000);
    setReactionErrors(0);
    setClickTimes([]);
    generateBalls();
    speak(`Click ${color.name} balls from 1 to 10 in order. Press the start button when you are ready.`);
    setPhase('round1_ready');
  };

  const startRound1Play = () => {
    playSound('correct');
    setPhase('round1_play');
    lastClickTimeRef.current = performance.now();
  };

  const setupRound2 = () => {
    const availableColors = COLORS.filter(c => c.id !== targetColor?.id);
    const color = availableColors[Math.floor(Math.random() * availableColors.length)];
    
    setTargetColor(color);
    setCurrentNumber(10);
    setTimeMs(ROUND_TIME_LIMIT * 1000);
    generateBalls();
    speak(`Second test. This time, click ${color.name} balls backward from 10 to 1. Press the start button when you are ready.`);
    setPhase('round2_ready');
  };

  const startRound2Play = () => {
    playSound('correct');
    setPhase('round2_play');
    lastClickTimeRef.current = performance.now();
  };

  const finishTest = () => {
    playSound('complete');
    setPhase('result');
    setClickTimes(prevTimes => {
        const avgTimeMs = prevTimes.length > 0 
            ? Math.round(prevTimes.reduce((a, b) => a + b, 0) / prevTimes.length) 
            : 2000;
            
        // Create screenshot
        const canvas = document.createElement('canvas');
        canvas.width = 640; canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const grd = ctx.createLinearGradient(0,0,640,480);
            grd.addColorStop(0, '#0f172a');
            grd.addColorStop(1, '#1e293b');
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, 640, 480);
            ctx.fillStyle = '#10b981';
            ctx.font = 'bold 36px Arial';
            ctx.fillText(`TMT Brain Test Complete`, 100, 200);
            ctx.font = '24px Arial';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(`Avg Reaction: ${avgTimeMs}ms`, 100, 250);
            ctx.fillText(`Total Errors: ${reactionErrors}`, 100, 290);
        }
        // Automatically advancing is disabled.
        // User must click '다음 단계로 이동' in the result UI.
        
        return prevTimes;
    });
  };

  const handleBallClick = (ball: Ball, e: React.MouseEvent) => {
    if (phase !== 'round1_play' && phase !== 'round2_play') return;
    if (ball.isClicked) return;

    const isRound1 = phase === 'round1_play';
    const isCorrectColor = ball.color === targetColor?.id;
    const isCorrectNumber = ball.number === currentNumber;

    if (isCorrectColor && isCorrectNumber) {
      playSound('correct');
      const now = performance.now();
      const timeTaken = now - lastClickTimeRef.current;
      setClickTimes(prev => [...prev, timeTaken]);
      lastClickTimeRef.current = now;
      
      setBalls(prev => prev.map(b => b.id === ball.id ? { ...b, isClicked: true } : b));
      
      // Particle effect
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
      const x = rect.left + rect.width / 2 - containerRect.left;
      const y = rect.top + rect.height / 2 - containerRect.top;
      
      const effectId = Date.now().toString();
      setEffects(prev => [...prev, { id: effectId, x, y, color: ball.colorHex }]);
      setTimeout(() => setEffects(prev => prev.filter(e => e.id !== effectId)), 500);

      // Screen flash
      setScreenFeedback('correct');
      setTimeout(() => setScreenFeedback('none'), 150);

      // Next number
      const nextNum = isRound1 ? currentNumber + 1 : currentNumber - 1;
      if ((isRound1 && nextNum > 10) || (!isRound1 && nextNum < 1)) {
        if (timerRef.current) cancelAnimationFrame(timerRef.current);
        if (isRound1) {
          speak("Success!");
          setPhase('round1_result');
        } else {
          speak("All tests completed.");
          setPhase('round2_result');
        }
      } else {
        setCurrentNumber(nextNum);
      }
    } else {
      playSound('wrong');
      setReactionErrors(prev => prev + 1);
      setScreenFeedback('wrong');
      setTimeout(() => setScreenFeedback('none'), 300);
      
      // Error penalty animation on the clicked ball
      setBalls(prev => prev.map(b => b.id === ball.id ? { ...b, errorAnim: true } : b));
      setTimeout(() => setBalls(prev => prev.map(b => b.id === ball.id ? { ...b, errorAnim: false } : b)), 300);
    }
  };

  // Helper for SVG Progress Ring
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (timeMs / (ROUND_TIME_LIMIT * 1000)) * circumference;

  // Render
  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-slate-950 p-6 overflow-hidden text-white relative">
      {/* Header */}
      <div className="mb-4 flex justify-between items-end shrink-0">
        <div className="animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
              <i className="fas fa-brain text-emerald-400 text-sm"></i>
            </span>
            <span className="text-emerald-500 font-bold text-xs uppercase tracking-widest">Cognitive Test Stage 1 (v5.0)</span>
          </div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Cognitive Reaction Test</h3>
        </div>
        <button
          onClick={() => setIsPortraitMode(!isPortraitMode)}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-colors border border-slate-700"
        >
          <i className={`fas fa-${isPortraitMode ? 'mobile-alt' : 'desktop'}`}></i>
          {isPortraitMode ? 'Portrait' : 'Landscape'}
        </button>
      </div>

      {/* Game Area */}
      <div className={`flex-1 min-h-0 w-full flex relative perspective-1000 p-2 md:p-8 ${isPortraitMode ? 'justify-center items-center bg-slate-950/50' : 'flex-col'}`}>
        <div 
          className={`relative w-full overflow-hidden bg-slate-900 shadow-2xl border border-slate-700/50 transition-all duration-500 
            ${phase === 'intro' ? 'shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]' : 'shadow-none'}
            ${isPortraitMode ? 'w-[95%] max-w-5xl max-h-[85vh] aspect-[4/5] mx-auto rounded-[3rem]' : 'flex-1 max-w-5xl mx-auto rounded-[2.5rem]'}
          `}
          ref={containerRef}
        >
          {/* Background Ambient */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950"></div>
          <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>

          {/* INTRO */}
          {phase === 'intro' && (
            <div className="absolute inset-0 flex items-center justify-center z-50 animate-fade-in">
              <div className="relative z-10 max-w-md w-full p-10 rounded-[2rem] text-center border border-white/10 bg-slate-800/80 backdrop-blur-xl shadow-2xl">
                <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                  <div className="absolute inset-0 border-t-2 border-l-2 border-emerald-500 rounded-full animate-spin" style={{ animationDuration: '3s' }}></div>
                  <div className="absolute inset-2 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center z-10 shadow-[0_0_20px_rgba(16,185,129,0.5)] animate-pulse">
                    <i className="fas fa-crosshairs text-3xl text-white drop-shadow-md"></i>
                  </div>
                </div>
                <h2 className="text-3xl font-black text-white mb-8 tracking-tight">Cognitive Reaction Test</h2>
                
                <div className="space-y-3 mb-8 text-left">
                  <div className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                      <i className="fas fa-hand-pointer text-blue-400"></i>
                    </div>
                    <div className="text-sm font-medium text-slate-300">Click the <strong className="text-white">color and numbers</strong> in <strong className="text-white">order</strong> within 15 seconds.</div>
                  </div>
                </div>

                <button
                  onClick={startGame}
                  className="w-full py-5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-lg font-black rounded-2xl shadow-[0_10px_25px_-5px_rgba(16,185,129,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-out"></div>
                  <span className="relative z-10 flex items-center justify-center gap-2">Start Assessment <i className="fas fa-play text-sm"></i></span>
                </button>
              </div>
            </div>
          )}

          {/* READY PHASES */}
          {(phase === 'round1_ready' || phase === 'round2_ready') && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm z-40">
              <div className="bg-slate-800/95 p-8 rounded-3xl shadow-2xl border border-slate-600/50 max-w-sm w-full text-center flex flex-col items-center">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner border border-white/10 bg-gradient-to-br ${targetColor.gradient} mb-4`}>
                    <i className="fas fa-bullseye text-white text-3xl drop-shadow-md"></i>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Get Ready</h3>
                <p className="text-slate-300 font-medium mb-6 leading-relaxed">
                  Click the <strong style={{ color: targetColor.hex }}>{targetColor.name}</strong> balls
                  {phase === 'round1_ready' ? ' from 1 to 10 in order.' : ' backward from 10 to 1.'}
                </p>
                <button 
                  onClick={phase === 'round1_ready' ? startRound1Play : startRound2Play}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-black rounded-xl text-lg shadow-lg shadow-emerald-500/30 transition-all active:scale-95"
                >
                  Start
                </button>
              </div>
            </div>
          )}

          {/* RESULT PHASES */}
          {(phase === 'round1_result' || phase === 'round2_result') && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-md z-40">
              <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-600 max-w-sm w-full text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center mb-4">
                  <i className="fas fa-flag-checkered text-3xl text-emerald-400"></i>
                </div>
                <h3 className="text-2xl font-black text-white mb-6">Round Completed</h3>
                <div className="flex flex-col gap-3 w-full">
                  <button 
                    onClick={phase === 'round1_result' ? setupRound1 : setupRound2}
                    className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl border border-slate-500 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-redo"></i> Retry Test
                  </button>
                  <button 
                    onClick={phase === 'round1_result' ? setupRound2 : finishTest}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    {phase === 'round1_result' ? 'Proceed to Next Test' : 'View Final Results'} <i className="fas fa-arrow-right"></i>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PLAY HUD AND BALLS */}
          {(phase === 'round1_play' || phase === 'round2_play' || phase === 'round1_ready' || phase === 'round2_ready' || phase === 'round1_result' || phase === 'round2_result') && (
            <>
              {/* Premium Top HUD */}
              <div className={`absolute top-4 z-20 pointer-events-none flex justify-between items-start ${isPortraitMode ? 'inset-x-3' : 'inset-x-6'}`}>
                {/* Mission Card */}
                <div className={`bg-slate-800/90 backdrop-blur-md border border-slate-600/50 shadow-xl rounded-2xl flex items-center animate-fade-in transform-style-3d perspective-1000 ${isPortraitMode ? 'p-2 gap-2' : 'p-4 gap-4'}`}>
                  <div className={`${isPortraitMode ? 'w-8 h-8 rounded-lg' : 'w-12 h-12 rounded-xl'} flex items-center justify-center shadow-inner border border-white/10 bg-gradient-to-br ${targetColor.gradient}`}>
                    <i className={`fas fa-bullseye text-white drop-shadow-md ${isPortraitMode ? 'text-sm' : 'text-xl'}`}></i>
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-slate-400 font-bold uppercase tracking-wider mb-0.5 ${isPortraitMode ? 'text-[8px]' : 'text-[10px]'}`}>Target Color & Direction</span>
                    <div className={`font-black text-white flex items-center ${isPortraitMode ? 'text-sm gap-1' : 'text-xl gap-2'}`}>
                      <span style={{ color: targetColor.hex }} className="whitespace-nowrap">{targetColor.name}</span>
                      <i className={`fas fa-chevron-right text-slate-500 mx-1 ${isPortraitMode ? 'text-[10px]' : 'text-sm'}`}></i>
                      <span className={`bg-slate-700 text-emerald-400 rounded-md whitespace-nowrap ${isPortraitMode ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-0.5 text-base'}`}>
                        {phase === 'round1_play' ? '1 → 10 (Forward)' : '10 → 1 (Backward)'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Errors & Timer */}
                <div className={`flex ${isPortraitMode ? 'gap-1.5' : 'gap-3'}`}>
                  <div className={`bg-slate-800/90 backdrop-blur-md border border-slate-600/50 shadow-xl rounded-2xl flex flex-col items-center justify-center ${isPortraitMode ? 'px-3 py-2' : 'px-5 py-3'}`}>
                    <span className={`text-slate-400 font-bold uppercase tracking-wider mb-1 ${isPortraitMode ? 'text-[8px]' : 'text-[10px]'}`}>Errors</span>
                    <span className={`font-black tabular-nums ${reactionErrors > 0 ? 'text-rose-500' : 'text-slate-300'} ${isPortraitMode ? 'text-lg' : 'text-2xl'}`}>
                      {reactionErrors}
                    </span>
                  </div>

                  <div className={`bg-slate-800/90 backdrop-blur-md border border-slate-600/50 shadow-xl rounded-2xl flex items-center ${isPortraitMode ? 'p-1.5 gap-2' : 'p-3 gap-4'}`}>
                    <div className={`relative flex items-center justify-center ${isPortraitMode ? 'w-10 h-10' : 'w-14 h-14'}`}>
                      <svg className="w-full h-full transform -rotate-90" overflow="visible">
                        <circle cx={isPortraitMode ? '20' : '28'} cy={isPortraitMode ? '20' : '28'} r={isPortraitMode ? '16' : radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={isPortraitMode ? '4' : '6'} />
                        <circle 
                          cx={isPortraitMode ? '20' : '28'} cy={isPortraitMode ? '20' : '28'} r={isPortraitMode ? '16' : radius} 
                          fill="none" 
                          stroke={timeLeft <= 5 ? '#ef4444' : '#10b981'} 
                          strokeWidth={isPortraitMode ? '4' : '6'} 
                          strokeDasharray={isPortraitMode ? 2 * Math.PI * 16 : circumference}
                          strokeDashoffset={isPortraitMode ? (2 * Math.PI * 16) * (1 - timeMs / (15 * 1000)) : strokeDashoffset}
                          strokeLinecap="round"
                          className="transition-all duration-100 ease-linear"
                        />
                      </svg>
                      <span className={`absolute font-black tabular-nums ${timeLeft <= 5 ? 'text-rose-500 animate-pulse' : 'text-white'} ${isPortraitMode ? 'text-sm' : 'text-xl'}`}>
                        {timeLeft}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Target Indicator */}
              <div className={`absolute inset-x-0 flex justify-center z-20 pointer-events-none ${isPortraitMode ? 'bottom-4' : 'bottom-8'}`}>
                 <div className={`bg-slate-800/90 backdrop-blur-xl border border-slate-600/50 shadow-2xl flex items-center animate-slide-up ${isPortraitMode ? 'rounded-3xl px-5 py-2 gap-3' : 'rounded-[2rem] px-8 py-4 gap-6'}`}>
                    <div className="flex flex-col items-end">
                      <span className={`text-slate-400 font-bold uppercase tracking-widest mb-1 ${isPortraitMode ? 'text-[9px]' : 'text-xs'}`}>Next Number</span>
                      <span className={`text-slate-500 ${isPortraitMode ? 'text-[8px]' : 'text-[10px]'}`}>Target Number</span>
                    </div>
                    <div className={`w-px bg-slate-700 ${isPortraitMode ? 'h-6' : 'h-10'}`}></div>
                    <div className="flex items-baseline gap-2">
                      <span className={`font-black drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] ${isPortraitMode ? 'text-3xl' : 'text-5xl'}`} style={{ color: targetColor.hex }}>
                        {currentNumber}
                      </span>
                    </div>
                 </div>
              </div>

              {/* Balls Area */}
              <div className={`absolute inset-0 z-10 ${isPortraitMode ? 'pt-24 pb-20 px-2' : 'pt-28 pb-32 px-8'}`}>
                <div className="relative w-full h-full">
                  {balls.map(ball => {
                    return (
                      <button
                        key={ball.id}
                        onClick={(e) => handleBallClick(ball, e)}
                        disabled={ball.isClicked}
                        className={`absolute flex items-center justify-center font-black transition-all duration-300 ease-out
                          ${ball.isClicked ? 'animate-ball-pop pointer-events-none' : 'hover:scale-110 active:scale-95'}
                          opacity-100 z-10
                          ${(ball as any).errorAnim ? 'animate-[shake_0.3s_ease-in-out]' : ''}
                        `}
                        style={{
                          left: `${ball.x}%`,
                          top: `${ball.y}%`,
                          transform: 'translate(-50%, -50%)',
                          width: isPortraitMode ? 'clamp(60px, 15vw, 90px)' : 'clamp(50px, 8vmin, 80px)',
                          height: isPortraitMode ? 'clamp(60px, 15vw, 90px)' : 'clamp(50px, 8vmin, 80px)',
                          fontSize: isPortraitMode ? 'clamp(24px, 6vw, 36px)' : 'clamp(20px, 3.5vmin, 36px)',
                          borderRadius: '50%',
                          background: `radial-gradient(circle at 30% 30%, ${ball.colorHex}, ${ball.colorHexDark})`,
                          color: '#ffffff',
                          textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                          boxShadow: ball.isClicked ? 'none' : `
                            inset 0 -5px 10px rgba(0,0,0,0.4), 
                            inset 0 5px 10px rgba(255,255,255,0.4), 
                            0 10px 20px rgba(0,0,0,0.4)
                          `,
                          border: '1px solid rgba(255,255,255,0.2)'
                        }}
                      >
                        {ball.number}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Particle Effects */}
              {effects.map(effect => (
                <div key={effect.id} className="absolute pointer-events-none z-30" style={{ left: effect.x, top: effect.y }}>
                  {[...Array(6)].map((_, i) => {
                    const angle = (i * 60) * Math.PI / 180;
                    const dist = 60;
                    const tx = Math.cos(angle) * dist;
                    const ty = Math.sin(angle) * dist;
                    return (
                      <div 
                        key={i}
                        className="absolute w-3 h-3 rounded-full"
                        style={{
                          backgroundColor: effect.color,
                          boxShadow: `0 0 10px ${effect.color}`,
                          '--tx': `${tx}px`,
                          '--ty': `${ty}px`,
                          animation: 'particle-burst 0.5s ease-out forwards'
                        } as any}
                      />
                    );
                  })}
                </div>
              ))}

              {/* Screen Flash Feedback */}
              <div 
                className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-200 
                  ${screenFeedback === 'correct' ? 'opacity-100' : 'opacity-0'}`} 
                style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)' }}
              />
              <div 
                className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-200 mix-blend-color-dodge
                  ${screenFeedback === 'wrong' ? 'opacity-100' : 'opacity-0'}`} 
                style={{ background: 'radial-gradient(circle, rgba(244,63,94,0.3) 0%, transparent 80%)' }}
              />
            </>
          )}

          {/* RESULT / SCORE CARD */}
          {phase === 'result' && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/95 backdrop-blur-xl z-50 animate-fade-in">
              <div className="max-w-md w-full relative">
                {/* Glow behind card */}
                <div className="absolute inset-0 bg-emerald-500/20 blur-[100px] rounded-full"></div>
                
                <div className="relative bg-slate-800 border border-slate-600 rounded-[2.5rem] p-8 shadow-2xl animate-score-reveal">
                  <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_10px_30px_rgba(16,185,129,0.4)] transform rotate-3">
                      <i className="fas fa-check-double text-4xl text-white"></i>
                    </div>
                    <h2 className="text-3xl font-black text-white tracking-tight">Assessment Completed</h2>
                    <p className="text-slate-400 font-medium mt-1">AI Cognitive Speed Analysis Results</p>
                  </div>

                  <div className="space-y-4 mb-8">
                    {/* Reaction Time Row */}
                    {(() => {
                      const avgMs = clickTimes.length > 0 ? Math.round(clickTimes.reduce((a, b) => a + b, 0) / clickTimes.length) : 2000;
                      let rank = 'C'; let rankColor = 'text-rose-500 bg-rose-500/10 border-rose-500/20';
                      if (avgMs <= 800) { rank = 'S'; rankColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'; }
                      else if (avgMs <= 1100) { rank = 'A'; rankColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20'; }
                      else if (avgMs <= 1400) { rank = 'B'; rankColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20'; }

                      return (
                        <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">
                          <div className="flex items-center gap-3">
                            <i className="fas fa-bolt text-amber-400 text-lg"></i>
                            <span className="text-slate-300 font-bold">Avg Reaction Time</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-black text-white tabular-nums">{avgMs}<span className="text-sm text-slate-500 ml-1">ms</span></span>
                            <span className={`w-8 h-8 flex items-center justify-center rounded-lg border font-black ${rankColor}`}>{rank}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Errors Row */}
                    {(() => {
                      let rank = 'C'; let rankColor = 'text-rose-500 bg-rose-500/10 border-rose-500/20';
                      if (reactionErrors === 0) { rank = 'S'; rankColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'; }
                      else if (reactionErrors === 1) { rank = 'A'; rankColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20'; }
                      else if (reactionErrors === 2) { rank = 'B'; rankColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20'; }

                      return (
                        <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">
                          <div className="flex items-center gap-3">
                            <i className="fas fa-times-circle text-rose-400 text-lg"></i>
                            <span className="text-slate-300 font-bold">Cognitive Errors</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-black text-white tabular-nums">{reactionErrors}<span className="text-sm text-slate-500 ml-1"> time(s)</span></span>
                            <span className={`w-8 h-8 flex items-center justify-center rounded-lg border font-black ${rankColor}`}>{rank}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="mt-8 flex justify-center">
                    <button
                      onClick={() => onComplete('', { 
                        reactionTimeMs: clickTimes.length > 0 ? Math.round(clickTimes.reduce((a, b) => a + b, 0) / clickTimes.length) : 2000, 
                        reactionErrors 
                      })}
                      className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-lg font-black rounded-2xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden group"
                    >
                      <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-out"></div>
                      <span className="relative z-10 flex items-center justify-center gap-2">Next Step <i className="fas fa-arrow-right text-sm"></i></span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
