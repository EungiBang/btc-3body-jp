import React from 'react';

interface StickShakerProps {
  mode: 'SHUFFLING' | 'INTERPRETING';
}

const StickShaker: React.FC<StickShakerProps> = ({ mode }) => {
  const sticks = Array.from({ length: 81 });
  
  const mainMessage = "천부경 81자의 우주적 에너지가 모이고 있습니다.";
  const subMessage = mode === 'SHUFFLING' 
    ? "운명의 막대를 섞는 중..." 
    : "선택된 세 장의 카드를 해석하고 있습니다...";

  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-center animate-fade-in relative py-10">
       {/* Text is visually on top */}
      <div className="relative z-20 mb-12 max-w-md">
        <p className="text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-indigo-400">{mainMessage}</p>
        <p className={`text-sm text-slate-400 mt-3 h-5 ${mode === 'INTERPRETING' ? 'animate-pulse text-fuchsia-300' : ''}`}>{subMessage}</p>
      </div>

      {/* Animation Container */}
      <div className="relative w-[300px] h-[350px]" style={{ perspective: '1000px' }}>
        
        {/* Background Effects */}
        <div className="absolute inset-0 z-0 overflow-hidden rounded-full mix-blend-screen opacity-50 blur-2xl bg-gradient-to-tr from-fuchsia-600/20 to-indigo-600/20"></div>

        {/* Ethereal energy motes for interpretation */}
        {mode === 'INTERPRETING' && (
          <div className="absolute inset-0 z-15 overflow-hidden pointer-events-none">
            {Array.from({ length: 15 }).map((_, i) => (
              <div
                key={i}
                className="absolute bottom-10 w-2 h-2 rounded-full bg-fuchsia-400"
                style={{
                  left: `${20 + Math.random() * 60}%`,
                  boxShadow: '0 0 10px 2px rgba(232, 121, 249, 0.8)',
                  animation: `rise-mote ${4 + Math.random() * 2}s infinite ease-out`,
                  animationDelay: `${Math.random() * 2}s`,
                  '--x-end-offset': `${(Math.random() - 0.5) * 100}px`,
                } as React.CSSProperties}
              />
            ))}
          </div>
        )}

        {/* Container (The Cup) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160px] h-[220px] rounded-b-3xl rounded-t-lg bg-slate-800 border-2 border-slate-700 shadow-[inset_0_-20px_40px_rgba(0,0,0,0.8),_0_20px_50px_rgba(0,0,0,0.5)] z-10 flex justify-center transform-style-3d">
            <div className="absolute top-4 w-[140px] h-[30px] rounded-[50%] bg-slate-900 shadow-[inset_0_5px_10px_rgba(0,0,0,0.8)] border border-slate-700"></div>
            
            {/* Sticks */}
            <div className={`absolute top-0 w-full h-[180px] -translate-y-5 -rotate-x-10 transform-style-3d ${mode === 'SHUFFLING' ? 'is-shuffling' : 'is-interpreting'}`}>
                {sticks.map((_, i) => (
                <div
                    key={i}
                    className="stick"
                    style={{
                    '--r': `${Math.random() * 40 - 20}deg`,
                    '--x': `${Math.random() * 40 - 20}px`,
                    '--delay': `${Math.random() * 1.5}s`
                    } as React.CSSProperties}
                />
                ))}
            </div>
            
            <div className="absolute bottom-6 font-bold text-slate-600 text-sm tracking-widest opacity-50">天符經</div>
        </div>
      </div>
      
      <style>{`
        .transform-style-3d {
          transform-style: preserve-3d;
        }

        .stick {
          position: absolute;
          top: 0;
          left: 50%;
          margin-left: -4px;
          width: 8px;
          height: 150px;
          background: linear-gradient(to right, #475569, #94a3b8, #475569); /* Slate 600-400-600 */
          border-radius: 4px;
          transform-origin: bottom center;
          transition: transform 0.5s ease-out, opacity 0.5s ease-out;
        }

        /* SHUFFLING ANIMATION */
        .is-shuffling .stick {
            animation: shuffle 1.2s infinite ease-in-out;
            animation-delay: var(--delay);
        }
        @keyframes shuffle {
            0%, 100% { transform: rotateZ(calc(var(--r) / 2)) translateY(0); }
            50% { transform: rotateZ(calc(var(--r) * -1.5)) translateY(-30px) translateX(var(--x)); }
        }

        /* INTERPRETING (SELECTION) ANIMATION */
        .is-interpreting .stick {
            animation: none;
            opacity: 0.15;
            transform: rotateZ(var(--r)) translateY(0) translateX(var(--x));
        }

        /* The selected 3 sticks rise up and glow */
        .is-interpreting .stick:nth-child(1),
        .is-interpreting .stick:nth-child(2),
        .is-interpreting .stick:nth-child(3) {
            opacity: 1;
            background: linear-gradient(to right, #c026d3, #e879f9, #c026d3); /* Fuchsia */
            animation: rise-up 2s forwards cubic-bezier(0.22, 1, 0.36, 1), stick-glow 2s infinite alternate;
            z-index: 20;
        }
        
        .is-interpreting .stick:nth-child(1) { animation-delay: 0.2s, 2.2s; left: 40%; }
        .is-interpreting .stick:nth-child(2) { animation-delay: 0.6s, 2.6s; left: 50%; }
        .is-interpreting .stick:nth-child(3) { animation-delay: 0.4s, 2.4s; left: 60%; }

        @keyframes rise-up {
            from { transform: translateY(0); }
            to { transform: translateY(-120px) rotateZ(0) scale(1.1); }
        }
        
        @keyframes stick-glow {
            from { box-shadow: 0 0 10px 2px rgba(232, 121, 249, 0.5); }
            to { box-shadow: 0 0 25px 8px rgba(232, 121, 249, 0.9); }
        }

        @keyframes rise-mote {
          0% { transform: translateY(0) scale(1); opacity: 0.8; }
          100% { transform: translateY(-300px) translateX(var(--x-end-offset)) scale(0.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default StickShaker;
