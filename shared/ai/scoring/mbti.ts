// 3바디 7코드 분석 데이터로부터 에너지 MBTI 코드를 도출하고 관련 상세 유형 정보를 제공하는 모듈

import { BodyReport } from '../../types/core';

export interface EnergyMbtiDetail {
  code: string;
  name: string;
  englishName: string;
  summary: string;
  description: string;
  primaryColors: string[];
  imageKey: string;
  threeBodyAnalysis: string;
  energyFortune: string;
  luckyPrescription: string;
}

export const ENERGY_MBTI_DATA: Record<string, EnergyMbtiDetail> = {
  PEAG: {
    code: 'PEAG',
    name: 'Quantum Energizer',
    englishName: 'All-in-One Aura Master',
    summary: 'Ideal gold balance with perfect circulation of all energy codes',
    description: 'An ideal state where vitality, intellectual insight, emotional communication, and mental stability are in perfect balance, radiating positive aura.',
    primaryColors: ['#E74C3C', '#E67E22', '#F1C40F', '#2ECC71', '#3498DB', '#9B59B6', '#E8D5F5'],
    imageKey: 'peag_aura_monarch',
    threeBodyAnalysis: 'Unblocked energy flow from 1-Code to 7-Code, creating a golden ratio of body, brain waves, and mind. Strong energy resilience and peak immunity.',
    energyFortune: 'An abundant fortune akin to the "The Sun" tarot card. Since your consciousness is perfectly tuned, it is a lucky timing for everything to go smoothly.',
    luckyPrescription: 'Carry a warm water tumbler, practice signature 7-code circulation gymnastics, wear gold-tone accessories',
  },
  PEAF: {
    code: 'PEAF',
    name: 'Low-Battery Bulldozer',
    englishName: 'Low-Battery Bulldozer',
    summary: 'High physical drive but severely exhausted emotional/mental cushion',
    description: 'You show strong goal-oriented physical action, but your emotional flow and heart-level buffer are highly stagnant. Be cautious of internal burnout.',
    primaryColors: ['#E74C3C', '#E67E22'],
    imageKey: 'peaf_exhausted_bulldozer',
    threeBodyAnalysis: 'Your 1-Code and 3-Code physical core drives are at peak, but 4-Code (Heart) is under 40 points, meaning heavy emotional tension is accumulated in your chest.',
    energyFortune: 'A hot-running engine akin to the reversed "The Chariot" tarot. Time to pause and breathe; focus on lowering your body heat with deep breathing today.',
    luckyPrescription: 'Peppermint aroma cooling therapy, 4-Code chest opening meditation, green healing items',
  },
  PECG: {
    code: 'PECG',
    name: 'Energetic Chemist',
    englishName: 'Energetic Chemist',
    summary: 'An active communicator connecting energy through high vitality and friendliness',
    description: 'You show natural relational coordination anywhere with excellent physical core and high communication. You awaken stagnant energies around you.',
    primaryColors: ['#E67E22', '#F1C40F'],
    imageKey: 'pecg_playful_alchemist',
    threeBodyAnalysis: 'Active integration of 2-Code (Creation) and 5-Code (Communication). Excellent physical expression and positive, bright brainwave status.',
    energyFortune: 'Warm earth energy resembling the "The Empress" tarot card. A clear fortune where sharing ideas and collaborating with others doubles your vitality.',
    luckyPrescription: 'Fresh tangerine peel tea, voice reading meditation for 5-Code activation, orange-colored accessories',
  },
  PECF: {
    code: 'PECF',
    name: 'Lonely Spotlighter',
    englishName: 'Lonely Spotlighter',
    summary: 'A state of bright external activity but latent inner isolation and empty feelings',
    description: 'Your external communication and physical activities are high, but deep emotional stability in your heart is suppressed, leading to inner void.',
    primaryColors: ['#E67E22', '#9B59B6'],
    imageKey: 'pecf_wandering_dancer',
    threeBodyAnalysis: 'High-level connections of 2-Code and 6-Code are active, but the key emotional center 4-Code is stagnant, creating an unstable outer-heavy balance.',
    energyFortune: 'An artist left alone under bright lights after the festival, resembling "The Fool". Instead of spending energy on others, focus on your quiet inner joy.',
    luckyPrescription: 'Herb oil half-bath, 4-Code self-compassion affirmation meditation, lemon-yellow accessories',
  },
  PSAG: {
    code: 'PSAG',
    name: 'Grounding Architect',
    englishName: 'Grounding Architect',
    summary: 'A solid pillar supporting the system with a deep root and firm execution',
    description: 'Highly realistic energy alignment and persistent willpower that radiates steady stability. You perform tasks calmly without being swayed.',
    primaryColors: ['#E74C3C', '#F1C40F'],
    imageKey: 'psag_silent_sentinel',
    threeBodyAnalysis: '1-Code and 3-Code are firmly anchored like a rock, and 7-Code brain waves are deeply calmed. Balanced distribution of upper and lower body energy.',
    energyFortune: 'A giant mountain range resembling the "The Emperor" tarot. Earth energy is full; the best day to execute realistic plans and tasks needing concentration.',
    luckyPrescription: 'Woody-scented room spray, squat exercises for 1-Code root strengthening, dark brown accessories',
  },
  PSAF: {
    code: 'PSAF',
    name: 'Lonely Warrior',
    englishName: 'Lonely Warrior',
    summary: 'Heavy responsibilities supported by leg strength but holding accumulated tension in chest',
    description: 'You silently endure pressure with strong will, but heavy energy is tightly blocked in your chest. High stress levels keep your nervous system tense.',
    primaryColors: ['#E74C3C', '#3498DB'],
    imageKey: 'psaf_lonely_guardian',
    threeBodyAnalysis: 'Forcefully holding fatigue using 1-Code root, but tension is blocked in 4-Code, causing shallow breathing and defensive, anxious brainwaves.',
    energyFortune: 'A soldier blocking the castle gate alone in a storm, resembling "Ten of Wands". Relax your body for at least 10 minutes today to release the chest dam.',
    luckyPrescription: 'Warm jujube-cinnamon tea, chest tapping and brainwave relaxation exercises, red-tone items',
  },
  PSCG: {
    code: 'PSCG',
    name: 'Silent Maker',
    englishName: 'Silent Maker',
    summary: 'An artisan creating value through deep self-alignment and quiet immersion',
    description: 'Excellent physical stability combined with the power to calm your inner mind. You focus deeply on the essence without being shaken by external noise.',
    primaryColors: ['#F1C40F', '#E8D5F5'],
    imageKey: 'pscg_master_artisan',
    threeBodyAnalysis: 'Harmonious path between 3-Code and 7-Code. Comfortable stomach relaxation and deep alpha brainwaves create excellent focus and physical calm.',
    energyFortune: 'A quiet temple deep in the forest, resembling "The Hermit". Turning off external noises and meditating quietly brings forth your deepest wisdom.',
    luckyPrescription: 'A cup of warm pine needle tea, 7-Code Baekhoe brain breathing meditation, deep green accessories',
  },
  PSCF: {
    code: 'PSCF',
    name: 'Concrete Silo',
    englishName: 'Concrete Silo',
    summary: 'A state of shut communication, trapping yourself in stubbornness',
    description: 'A state of isolation where emotional exchange is completely cut off inside your fortress. Flexing the tension in your chest and neck is required.',
    primaryColors: ['#F1C40F'],
    imageKey: 'pscf_blocked_stoic',
    threeBodyAnalysis: '5-Code and 4-Code are highly blocked, restricting expression, while energy is strictly locked in the head and lower body, emitting stubborn brainwaves.',
    energyFortune: 'A locked castle gate resembling "Four of Pentacles". Trapped in old routines; shake your whole body actively today to unlock the physical stagnation.',
    luckyPrescription: 'Ginger-ginger tea, 15 minutes of lymphatic body vibration, emerald-blue accessories',
  },
  MEAG: {
    code: 'MEAG',
    name: 'Deep-Brain Strategist',
    englishName: 'Deep-Brain Strategist',
    summary: 'A strategist designing direction with high-level insight and cool judgment',
    description: 'A strategist state that pierces the core of issues with clear analytical power and bright upper energy. Your energy is logically stable.',
    primaryColors: ['#9B59B6', '#F1C40F'],
    imageKey: 'meag_wise_strategist',
    threeBodyAnalysis: '6-Code (Indang) brain waves maintain peak stability, and 3-Code visceral metrics are relaxed. High computing efficiency and optimized energy.',
    energyFortune: 'A hawk targeting prey from above the clouds, resembling "Queen of Swords" tarot. Your mind is extremely clear; the best day to tackle intellectual tasks.',
    luckyPrescription: 'A cup of cool chrysanthemum tea, acupressure on 6-Code Indang, purple accessories',
  },
  MEAF: {
    code: 'MEAF',
    name: 'Overclocked Thinker',
    englishName: 'Overclocked Thinker',
    summary: 'Brain computing at limits while physical foundation is completely depleted',
    description: 'Overheated brain waves due to excessive overthinking, while the physical lower base is depleted, creating extreme upper-heat/lower-cold imbalance.',
    primaryColors: ['#9B59B6', '#E74C3C'],
    imageKey: 'meaf_overheated_thinker',
    threeBodyAnalysis: '6-Code and 7-Code energies are high, heating up the head, but the supporting 1-Code is depleted, leaving energy floating in the air.',
    energyFortune: 'An engine spinning at limit speeds without a coolant, resembling "The Tower". Turn off devices immediately and walk on soil to ground your energy.',
    luckyPrescription: 'Warm herbal tea, lower danjeon grounding meditation for 1-Code root, earth-toned items',
  },
  MECG: {
    code: 'MECG',
    name: 'Cosmic Creative Muse',
    englishName: 'Cosmic Creative Muse',
    summary: 'A creator fascinating the world with rich artistic inspiration and communication',
    description: 'Receiving clear insights like a cosmic antenna and conveying them into smooth communication. Creative ideas spring brightly from you.',
    primaryColors: ['#3498DB', '#9B59B6'],
    imageKey: 'mecg_cosmic_muse',
    threeBodyAnalysis: 'Flexible integration of 6-Code and 5-Code, with 7-Code brain waves wide open. High-level synergy of language path and cognitive energy.',
    energyFortune: 'An aurora lighting up the night sky, resembling "The Star" tarot. Ideas are flowing; you will see wonderful results in expression and sharing.',
    luckyPrescription: 'Fragrant Assam black tea, 10 minutes of 7-Code Baekhoe breathing, silver accessories',
  },
  MECF: {
    code: 'MECF',
    name: 'Sensitive Hurricane',
    englishName: 'Sensitive Hurricane',
    summary: 'High brain computing but emotional waves crashing due to stagnant heart-level energy',
    description: 'Possessing brilliant inspiration but blocked heart-level emotional stability, causing emotions to fluctuate violently even in small storms.',
    primaryColors: ['#3498DB', '#E74C3C', '#9B59B6'],
    imageKey: 'mecf_tempest_wizard',
    threeBodyAnalysis: '6-Code and 7-Code brain energies are high, but 4-Code (Heart) and 2-Code core are low, meaning accumulated chest tension destabilizes heart rate.',
    energyFortune: 'A stormy sea in the middle of a typhoon, resembling "Three of Swords". Lower the heat from your head to your chest to preserve inner calm today.',
    luckyPrescription: 'Calming chamomile tea, 4-Code chest-focused breathing meditation, orange aroma mist',
  },
  MSAG: {
    code: 'MSAG',
    name: 'Algorithm Analyst',
    englishName: 'Algorithm Analyst',
    summary: 'An analyst excluding emotions to solve problems with clear logic and data',
    description: 'Filtering out emotional noise and establishing accurate solutions with cold reason and execution. A logical energy state without shaking.',
    primaryColors: ['#3498DB', '#9B59B6'],
    imageKey: 'msag_stoic_analyst',
    threeBodyAnalysis: '6-Code brain waves are in a calm alpha state, and 3-Code visceral metrics are stable, yielding an ideal mind-gut feedback loop.',
    energyFortune: 'An icy forest in the early morning without a hint of fog, resembling "Justice" tarot. Clear mind; perfect day for decisions, sorting, and analyzing.',
    luckyPrescription: 'A cup of iced green tea, 200 core exercises for 3-Code activation, navy-toned stationery',
  },
  MSAF: {
    code: 'MSAF',
    name: 'Dilemma Scholar',
    englishName: 'Dilemma Scholar',
    summary: 'Intellectual insights stretching to the sky but feeling anxious due to depleted lower body energy',
    description: 'Deep thinking and brain depth, but the grounding root is dried up, causing the autonomic nervous system to generate subtle anxiety.',
    primaryColors: ['#9B59B6', '#E74C3C'],
    imageKey: 'msaf_anxious_scholar',
    threeBodyAnalysis: '6-Code energy usage is high, but 1-Code grounding is deficient. Energy is concentrated in the head, failing to anchor to the earth.',
    energyFortune: 'A tree branch hanging and shaking in the clouds, resembling "Nine of Swords" tarot. Stop overthinking and engage in simple physical work today.',
    luckyPrescription: 'Savory Solomon-seal tea, 10 minutes of lunges and squats for 1-Code root, heavy leather accessories',
  },
  MSCG: {
    code: 'MSCG',
    name: 'K-Meditation Guru',
    englishName: 'K-Meditation Guru',
    summary: 'An ultimate meditative state where insight and deep peace are integrated',
    description: 'Wisdom, reflection, and huge heart-level love are smoothly merged into complete peace. You have established a shield unshaken by external noise.',
    primaryColors: ['#2ECC71', '#E8D5F5'],
    imageKey: 'mscg_zen_master',
    threeBodyAnalysis: '6-Code, 4-Code, and 7-Code coordinate smoothly. Heart rate variability (HRV) is optimized, and brainwaves show deep meditative alpha waves.',
    energyFortune: 'A crystal clear, tranquil lake resembling "The Temperance" tarot card. Perfect day to reflect, seek insights, and practice inner healing.',
    luckyPrescription: 'Relaxing chamomile tea, 15 minutes of 4-6 code harmonizing breath, emerald-green accessories',
  },
  MSCF: {
    code: 'MSCF',
    name: 'Cloud Walker',
    englishName: 'Cloud Walker',
    summary: 'Clear consciousness and spirituality but floating because realistic grounding energy is dry',
    description: 'Outstanding mental nobility, but blocked lower body grounding to execute physically in the real world. Your energy floats in the air.',
    primaryColors: ['#3498DB', '#E8D5F5'],
    imageKey: 'mscf_ethereal_mystic',
    threeBodyAnalysis: '7-Code Baekhoe is wide open, but 1-Code and 2-Code physical densities are low. Energy does not collect below, causing execution delay.',
    energyFortune: 'A mystic hanging upside down in the sky, resembling "The Hanged Man" tarot. Ground yourself today by doing real physical labor.',
    luckyPrescription: 'Warm oolong tea, 20 minutes of barefoot grounding exercises, using heavy tableware',
  }
};

export const getEnergyMbtiCode = (report: BodyReport | null): string => {
  if (!report || !report.sevenCodeAnalysis) return 'MSCG';
  const analysis = report.sevenCodeAnalysis;

  const scores = [
    analysis.code1.score,
    analysis.code2.score,
    analysis.code3.score,
    analysis.code4.score,
    analysis.code5.score,
    analysis.code6.score,
    analysis.code7.score,
  ];

  const allAvg = scores.reduce((sum, s) => sum + s, 0) / 7;
  const lowScoresCount = scores.filter((s) => s < 40).length;
  const minScore = Math.min(...scores);

  // 1차원: M(지성) vs P(신체)
  const mindAvg = (analysis.code6.score + analysis.code7.score) / 2;
  const physAvg = (analysis.code1.score + analysis.code2.score) / 2;
  const dim1 = mindAvg >= physAvg ? 'M' : 'P';

  // 2차원: S(성찰/성실) vs E(표현/사교)
  const stoicAvg = (analysis.code3.score + analysis.code7.score) / 2;
  const exprAvg = (analysis.code2.score + analysis.code5.score) / 2;
  const dim2 = stoicAvg >= exprAvg ? 'S' : 'E';

  // 3차원: A(추진/주체) vs C(창조/협력)
  const actAvg = (analysis.code1.score + analysis.code3.score) / 2;
  const crtAvg = (analysis.code2.score + analysis.code6.score) / 2;
  const dim3 = actAvg >= crtAvg ? 'A' : 'C';

  // 4차원: G(안정/순환) vs F(정체/기복)
  let dim4 = 'G';
  if (analysis.code4.score < 50 || allAvg < 55 || lowScoresCount >= 3) {
    dim4 = 'F';
  }

  const tempCode = `${dim1}${dim2}${dim3}${dim4}`;

  // 최상위 안정형 코드에 대한 최소 기준 조건 검증 및 Fallback 처리
  if (tempCode === 'PEAG') {
    if (allAvg < 75 || minScore < 60) {
      dim4 = 'F';
    }
  } else if (tempCode === 'MSCG') {
    if (allAvg < 70) {
      dim4 = 'F';
    }
  } else if (tempCode === 'PSAG') {
    if (allAvg < 65) {
      dim4 = 'F';
    }
  }

  return `${dim1}${dim2}${dim3}${dim4}`;
};
