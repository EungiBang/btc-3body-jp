import React from 'react';

// 통찰의 현자 (Insight)
const MasterKiIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5C4 5 2 12 2 12s2 7 10 7 10-7 10-7-2-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 12l-1.5 2.598" />
    <path d="M12 12l-2.598-1.5" />
    <path d="M12 12l1.5-2.598" />
    <path d="M12 12l2.598 1.5" />
  </svg>
);

// 균형의 안내자 (Balance)
const CheonInIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12h20" />
    <path d="M12 2v20" />
    <path d="M8 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0" />
    <path d="M8 17a4 4 0 1 0 8 0a4 4 0 1 0-8 0" />
  </svg>
);

// 고대의 신탁 (Cycles)
const HwanIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.28 15.42A8.996 8.996 0 0 1 3 12a9 9 0 0 1 9-9 8.996 8.996 0 0 1 6.42 2.72" />
      <path d="M19.72 8.58A8.996 8.996 0 0 1 21 12a9 9 0 0 1-9 9 8.996 8.996 0 0 1-6.42-2.72" />
      <path d="M4 14l-1.5 1.5 1.5 1.5" />
      <path d="M20 10l1.5-1.5-1.5-1.5" />
      <path d="M12 12l-1 2-2-1" />
    </svg>
);

// 운명의 별 (Destiny)
const DoRyeongIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L15.5 8.5L22 12L15.5 15.5L12 22L8.5 15.5L2 12L8.5 8.5L12 2z" />
    <path d="M12 12L18 6" />
    <path d="M12 12L6 6" />
    <path d="M12 12L6 18" />
    <path d="M12 12L18 18" />
  </svg>
);


// 영적인 아이 (Purity)
const AraIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="#7dd3fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 18c2.8-2.8 4.2-6.3 4.2-9.3C12.7 5.7 11 4 9.3 4c-1.7 0-3.2 1.7-3.2 4.7 0 3 1.4 6.5 4.2 9.3z" />
        <path d="M15.5 18c-2.8-2.8-4.2-6.3-4.2-9.3C11.3 5.7 13 4 14.7 4c1.7 0 3.2 1.7 3.2 4.7 0 3-1.4 6.5-4.2 9.3z" />
        <path d="M12 21V11" />
        <path d="M7 10.5c-2.3 2.3-3.5 5-3.5 7.5" />
        <path d="M17 10.5c2.3 2.3 3.5 5 3.5 7.5" />
    </svg>
);

interface MasterIconProps {
  masterId: string;
}

const MasterIcon: React.FC<MasterIconProps> = ({ masterId }) => {
  switch (masterId) {
    case 'masterKi':
      return <MasterKiIcon />;
    case 'cheonIn':
      return <CheonInIcon />;
    case 'hwan':
      return <HwanIcon />;
    case 'doRyeong':
      return <DoRyeongIcon />;
    case 'ara':
      return <AraIcon />;
    default:
      return null;
  }
};

export default MasterIcon;
