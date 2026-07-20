import React from 'react';
import type { CheonbugyeongCharacter } from '../../types';

interface CharacterCardProps {
  character: CheonbugyeongCharacter;
  label: string;
}

const CharacterCard: React.FC<CharacterCardProps> = ({ character, label }) => {
  return (
    <div 
      className="relative w-28 h-[280px] md:w-32 md:h-[320px] flex flex-col items-center justify-between text-center transition-all duration-300 ease-in-out transform hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(147,51,234,0.3)] animate-fade-in rounded-2xl overflow-hidden flex-shrink-0 cursor-pointer group border border-slate-600/50"
      style={{
        background: 'linear-gradient(135deg, #1e293b, #0f172a)', // slate-800 to slate-950
        boxShadow: 'inset 0 2px 10px rgba(255, 255, 255, 0.05)',
      }}
    >
      
      {/* Top Cap */}
      <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-fuchsia-900 to-indigo-950 shadow-inner border-b border-fuchsia-500/20"></div>

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-col items-center justify-between h-full text-white w-full pt-8 pb-6 px-2">
        
        {/* Background Image if available */}
        {character.imageUrl && (
          <div className="absolute inset-0 z-0 opacity-40 mix-blend-overlay">
            <img 
              src={character.imageUrl} 
              alt={character.char} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-fuchsia-900/30 via-transparent to-slate-900/80"></div>
          </div>
        )}

        {/* Top section: Label */}
        <div className="relative z-10 flex-shrink-0 mb-2">
            <p className="font-bold text-xs md:text-sm text-fuchsia-300 tracking-widest bg-fuchsia-900/40 px-3 py-1 rounded-full border border-fuchsia-500/30">
              {label}
            </p>
        </div>
        
        {/* Middle section: Character info */}
        <div className="relative z-10 flex flex-col items-center justify-center flex-grow my-2 w-full">
            {/* Character (Hanja) */}
            <p className="text-5xl md:text-6xl font-serif text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">
              {character.char}
            </p>
            {/* Reading (Korean) */}
            <p className="text-lg md:text-xl font-bold mt-3 text-slate-300 tracking-widest">
              {character.reading}
            </p>
        </div>

        {/* Bottom section: Meaning */}
        <div className="relative z-10 flex-shrink-0 bg-slate-800/80 backdrop-blur-sm px-3 py-2 rounded-xl w-full border border-slate-700">
            <p className="text-xs md:text-sm font-medium leading-tight text-fuchsia-100 line-clamp-2">
              {character.meaning}
            </p>
        </div>
      </div>

      {/* Bottom Cap */}
      <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-fuchsia-900 to-indigo-950 shadow-inner border-t border-fuchsia-500/20"></div>

       {/* Glossy shine effect */}
      <div 
        className="absolute top-0 left-[-75%] w-[250%] h-full opacity-[0.03] group-hover:opacity-10 transition-opacity duration-500 pointer-events-none -rotate-45"
        style={{
          background: 'linear-gradient(to right, transparent 0%, white 50%, transparent 100%)'
        }}
      />
    </div>
  );
};

export default CharacterCard;
