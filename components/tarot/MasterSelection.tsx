import React from 'react';
import { MASTERS } from '../../constants/masters';
import MasterIcon from './MasterIcons';

interface MasterSelectionProps {
  onMasterSelect: (masterId: string) => void;
}

const MasterSelection: React.FC<MasterSelectionProps> = ({ onMasterSelect }) => {
  return (
    <div className="w-full max-w-4xl mx-auto animate-fade-in text-center px-4">
      <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-indigo-400 mb-2">
        해석할 마스터를 선택하세요
      </h2>
      <p className="text-slate-400 mb-10 text-sm">천부경의 지혜를 빌려줄 당신만의 멘토를 선택하세요.</p>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        {MASTERS.map(master => (
          <button
            key={master.id}
            onClick={() => onMasterSelect(master.id)}
            className="group relative p-6 rounded-3xl transition-all duration-300 transform hover:-translate-y-2 focus:-translate-y-2 outline-none overflow-hidden bg-slate-800/80 border border-slate-700 hover:border-fuchsia-500/50 shadow-lg hover:shadow-[0_10px_30px_rgba(147,51,234,0.2)] flex flex-col justify-center items-center text-center h-[260px] md:h-[300px]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative z-10">
              <div className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-4 transition-all duration-300 group-hover:scale-110 drop-shadow-md">
                 <MasterIcon masterId={master.id} />
              </div>
              <h3 className="text-xl md:text-2xl font-black text-white mb-1">
                {master.name} 
                <span className="text-sm font-normal text-slate-400 ml-2">({master.age})</span>
              </h3>
              <p className="text-xs md:text-sm text-fuchsia-300/80">{master.title}</p>
            </div>
          </button>
        ))}
        
        <button
          onClick={() => onMasterSelect('random')}
          className="group relative p-6 rounded-3xl transition-all duration-300 transform hover:-translate-y-2 focus:-translate-y-2 outline-none overflow-hidden bg-gradient-to-br from-fuchsia-900/40 to-indigo-900/40 border border-fuchsia-500/30 hover:border-fuchsia-400 shadow-lg hover:shadow-[0_10px_30px_rgba(147,51,234,0.3)] flex flex-col justify-center items-center text-center h-[260px] md:h-[300px]"
        >
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%)] bg-[length:250%_250%] animate-[shimmer_3s_infinite]"></div>
          <div className="relative z-10 flex flex-col justify-center items-center h-full">
             <div className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-4 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                <span className="text-5xl md:text-6xl font-black text-white/90 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">?</span>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-white mb-1">랜덤 배정</h3>
            <p className="text-xs md:text-sm text-indigo-300/80">운명에 맡기기</p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default MasterSelection;
