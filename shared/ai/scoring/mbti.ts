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
    name: 'クォンタムエナジャイザー',
    englishName: 'All-in-One Aura Master',
    summary: 'すべてのエネルギーコードが完璧に循環するゴールドバランス',
    description: '生命力、知的な洞察力、感情的なコミュニケーション、精神的な安定が完璧なバランスを保ち、ポジティブなオーラを放つ理想的な状態です。',
    primaryColors: ['#E74C3C', '#E67E22', '#F1C40F', '#2ECC71', '#3498DB', '#9B59B6', '#E8D5F5'],
    imageKey: 'peag_aura_monarch',
    threeBodyAnalysis: '1コードから7コードまでエネルギーが滞りなく流れ、体・脳・心の黄金比を創り出しています。強いエネルギー回復力と高い免疫力を維持しています。',
    energyFortune: 'タロットの「太陽（The Sun）」のように生命力に満ち溢れた運勢です。意識が完璧に調和しているため、すべての物事がスムーズに進む幸運な時期です。',
    luckyPrescription: '白湯を持ち歩く、7コード循環体操を行う、ゴールド系のアクセサリーを身につける'
  },
  PEAF: {
    code: 'PEAF',
    name: 'バッテリー不足のブルドーザー',
    englishName: 'Low-Battery Bulldozer',
    summary: '身体的な推進力は高いが、感情적・정신적인 쿠션이 저조하여 번아웃 위험이 높은 상태',
    description: '強い目標指向型の実行力を持っていますが、感情の流れや心のバッファーが滞っています。内なる燃え尽き症候群（バーンアウト）に注意が必要です。',
    primaryColors: ['#E74C3C', '#E67E22'],
    imageKey: 'peaf_exhausted_bulldozer',
    threeBodyAnalysis: '1コードと3コード의 身体的コア 밸런스는 우수하나, 4코드(마음)가 정체되어 가슴 주변에 강한 감정적 긴장이 누적되었습니다.',
    energyFortune: '過熱したエンジンのような、逆位置の「戦車（The Chariot）」タロットに似た運勢です。立ち止まって呼吸を整え、深い呼吸で体熱を下げる時間が必要です。',
    luckyPrescription: 'ペパーミントアロマによる冷却テラピー、4コード胸部開放瞑想、グリーンの癒しアイテム'
  },
  PECG: {
    code: 'PECG',
    name: 'エネルギッシュな化学者',
    englishName: 'Energetic Chemist',
    summary: '高い生命力と親しみやすさでエネルギーをつなぐアクティブなコミュニケーター',
    description: '優れた身体적 코어와 친화력을 바탕으로, 어디서나 대인관계를 원활하게 조율하고 주변의 정체된 에너지를 일깨웁니다.',
    primaryColors: ['#E67E22', '#F1C40F'],
    imageKey: 'pecg_playful_alchemist',
    threeBodyAnalysis: '2コード（創造）と5コード（コミュニケーション）が活発に統合されています。優れた身体表現力と、ポジティブで明るい脳波状態を示しています。',
    energyFortune: 'あたたかい大地のエネルギーを表す「女帝（The Empress）」タロットのような運勢です。アイデアを共有し、他者と協力することで活力が倍増します。',
    luckyPrescription: '温かい陳皮茶、5コード活性化のための音読瞑想、オレンジ色のアクセサリー'
  },
  PECF: {
    code: 'PECF',
    name: '孤独なスポットライター',
    englishName: 'Lonely Spotlighter',
    summary: '外向的な活動は活発だが、内面の感情的な安定が抑制され、虚無感を感じやすい状態',
    description: '対外的なコミュニケーションや身体活動は活発ですが、胸の奥の深い感情的安定が抑えられており、内なる虚しさを感じやすい状態です。',
    primaryColors: ['#E67E22', '#9B59B6'],
    imageKey: 'pecf_wandering_dancer',
    threeBodyAnalysis: '2コード와 6코드의 고차원 연결이 활발하지만, 핵심 감정 센터인 4코드가 정체되어 외강내유형의 불안정한 밸런스 상태입니다.',
    energyFortune: 'フェスティバルが終わった後に一人残されたアーティストのような、「愚者（The Fool）」に似た運勢です。他人にエネルギーを使う代わりに、内なる静かな喜びに集中してください。',
    luckyPrescription: 'ハーブオイルを用いた半身浴、4コード自己慈愛肯定瞑想、レモンイエローの小物'
  },
  PSAG: {
    code: 'PSAG',
    name: 'グラウンディング建築家',
    englishName: 'Grounding Architect',
    summary: '深い根と堅実な実行力でシステムを支える強固な柱',
    description: '極めて現実的なエネルギーアライメントと、揺るぎない安定感を放つ持続的な意志力を持っています。周囲に流されず、冷静にタスクを遂行します。',
    primaryColors: ['#E74C3C', '#F1C40F'],
    imageKey: 'psag_silent_sentinel',
    threeBodyAnalysis: '1コードと3コードが岩のように強固に固定されており、7コードの脳波が深く落ち着いています。上半身と下반신의 에너지 균형이 안정적입니다.',
    energyFortune: '巨大な山脈を思わせる「皇帝（The Emperor）」タロットに似た運勢です。大地のエネルギーに満ちており、集中力が必要な現実적 계획 수행에 최고의 날입니다.',
    luckyPrescription: 'ウッディな香りのルームスプレー、1コード強化のためのスクワット運動、ダークブラウンの小物'
  },
  PSAF: {
    code: 'PSAF',
    name: '孤独な戦士',
    englishName: 'Lonely Warrior',
    summary: '強い下半身で重圧에 버티고 있으나, 가슴에 강한 긴장과 무거운 에너지가 고여있는 상태',
    description: '強い意志でプレッシャーに静かに耐えていますが、胸のエネルギーが強くブロックされています。高いストレスにより自律神経系が常に緊張しています。',
    primaryColors: ['#E74C3C', '#3498DB'],
    imageKey: 'psaf_lonely_guardian',
    threeBodyAnalysis: '1코드의 하체 지지력으로 피로를 버티고 있으나, 4코드 가슴 주변의 억압으로 호흡이 얕고 긴장도가 높은 뇌파 패턴이 나타납니다.',
    energyFortune: '嵐の中で一人で城門を守る兵士のような、「ワンドの10（Ten of Wands）」に似た運勢です。今日は少なくとも10分間は体をリラックスさせ、胸のつかえを解放してください。',
    luckyPrescription: '温かいナツメ茶、胸をたたくタッピングと脳波振動のエクササイズ、レッド系のアイテム'
  },
  PSCG: {
    code: 'PSCG',
    name: 'サイレントメーカー',
    englishName: 'Silent Maker',
    summary: '深い自己調和と静かな没頭により価値を創造する職人',
    description: '優れた身体的安定性と、内なる心を静める力を兼ね備えています。外部のノイズに左右されることなく、物事の本質に深く集中します。',
    primaryColors: ['#F1C40F', '#E8D5F5'],
    imageKey: 'pscg_master_artisan',
    threeBodyAnalysis: '3コードと7コードの調和が取れています。快適な腹部リラクゼーションと深いアルファ脳波により、優れた集中力と身体的な静けさが創り出されています。',
    energyFortune: '森의 깊은 곳에 자리 잡은 고요한 사찰처럼, 타로의 「은둔자(The Hermit)」와 같은 운세입니다. 외부의 소음을 차단하고 명상하기에 가장 좋습니다.',
    luckyPrescription: '温かい松葉茶、7コード百会脳呼吸瞑想、ディープグリーンのアクセサリー'
  },
  PSCF: {
    code: 'PSCF',
    name: 'コンクリートサイロ',
    englishName: 'Concrete Silo',
    summary: '他者とのコミュニケーションを閉ざし、自身の頑固さに閉じこもっている状態',
    description: '自分の砦の中で感情的な交流が完全に遮断された孤立状態です。胸や首の筋肉の緊張をほぐし、エネルギーを循環させることが不可欠です。',
    primaryColors: ['#F1C40F'],
    imageKey: 'pscf_blocked_stoic',
    threeBodyAnalysis: '5코드와 4코드가 강하게 정체되어 자기표현이 억제되고, 에너지가 머리와 하체에 과도하게 고여 완고한 형태의 뇌파가 관찰됩니다.',
    energyFortune: '鍵のかかった城門を思わせる「ペンタクルの4（Four of Pentacles）」に似た運勢です。古いルーティンに囚われやすいため、今日は意識的に体を動かして滞りを解いてください。',
    luckyPrescription: '生姜茶、15分間のリンパパタパ타 운동, 에메랄드 블루 소품'
  },
  MEAG: {
    code: 'MEAG',
    name: 'ディープブレイン戦略家',
    englishName: 'Deep-Brain Strategist',
    summary: '高度な洞察力と冷静な判断力で明確な方向性を設計する戦略家',
    description: '明確な分析力と明るい上位エネルギーを持ち、問題の本質を見抜きます。エネルギーが論理的に安定しており、効率的に思考を巡らせます。',
    primaryColors: ['#9B59B6', '#F1C40F'],
    imageKey: 'meag_wise_strategist',
    threeBodyAnalysis: '6コード（印堂）の脳波が非常に安定しており、3コードの胃腸領域もリラックスしています。高い演算効率と最適化されたエネルギー消費を示しています。',
    energyFortune: '雲の上から獲物を狙うタカのような、「ソードのクイーン（Queen of Swords）」タロットに似た運勢です。頭脳が非常に明晰で、知的タスクに取り組むのに最適な日です。',
    luckyPrescription: '冷たい菊花茶、6コード印堂への指圧、パープルカラー의 액세서리'
  },
  MEAF: {
    code: 'MEAF',
    name: 'オーバークロックシンカー',
    englishName: 'Overclocked Thinker',
    summary: '身体的な土台が枯渇している一方で、脳波が常に過熱している状態',
    description: '過度な考えすぎによって脳波がオーバーヒートしている一方で、下半身のエネルギーが枯渇しており、極端な「頭熱足寒」の不均衡が生じています。',
    primaryColors: ['#9B59B6', '#E74C3C'],
    imageKey: 'meaf_overheated_thinker',
    threeBodyAnalysis: '6코드와 7코드 에너지가 과열되어 머리 쪽은 뜨거우나, 지탱해 주는 1코드가 방전되어 에너지가 공중에 떠 있는 불균형 상태입니다.',
    energyFortune: '冷却水がない状態で限界まで回転するエンジンのような、「塔（The Tower）」に似た運勢です。すぐにデジタル機器をオフにし、土の上を歩くなどしてエネルギーをグラウンディングさせてください。',
    luckyPrescription: '温かいハーブティー、1コード強化のための下丹田グラウンディング瞑想、아ース컬러의 소품'
  },
  MECG: {
    code: 'MECG',
    name: 'コズミック・クリエイティブ・ミューズ',
    englishName: 'Cosmic Creative Muse',
    summary: '豊かな芸術的インスピレーションと表現力で世界を魅了するクリエイター',
    description: '宇宙のアンテナのように明確なインスピレーションを受け取り、それを滑らかなコミュニケーションで表現します。クリエイティブなアイデアが絶えず湧き出します。',
    primaryColors: ['#3498DB', '#9B59B6'],
    imageKey: 'mecg_cosmic_muse',
    threeBodyAnalysis: '6コード와 5코드의 유연한 연동으로, 7코드 백회 뇌파가 넓게 활성화되어 창의적 언어 감각이 매우 발달한 상태입니다.',
    energyFortune: '夜空を彩るオーロラのような、「星（The Star）」タロットに似た運勢です。アイデアが溢れ出ており、表現や共有において素晴らしい成果が得られるでしょう。',
    luckyPrescription: '香りの良いアッサム紅茶、10分間の7コード百会呼吸、シルバーのアクセサリー'
  },
  MECF: {
    code: 'MECF',
    name: '繊細なハリケーン',
    englishName: 'Sensitive Hurricane',
    summary: '脳の演算力は高いが、胸のエネルギー의 정체로 감정 기복이 심한 상태',
    description: '優れたインスピレーションを持っていますが、胸の感情的な安定が損なわれているため、小さなトラブルでも感情が激しく揺れ動きやすい状態です。',
    primaryColors: ['#3498DB', '#E74C3C', '#9B59B6'],
    imageKey: 'mecf_tempest_wizard',
    threeBodyAnalysis: '6코드와 7코드의 두뇌 에너지는 높은 반면, 4코드 가슴 주변의 정체로 인해 자율신경계가 쉽게 흔들리고 피로를 느끼기 쉽습니다.',
    energyFortune: '台風の渦中にある嵐の海のような、「ソードの3（Three of Swords）」に似た運勢です。今日は頭の熱を胸や下腹部に下ろし、内なる静けさを保つことに集中してください。',
    luckyPrescription: '心を落ち着かせるカモミール茶、4コードフォーカス呼吸瞑想、オレンジアロマミスト'
  },
  MSAG: {
    code: 'MSAG',
    name: 'アルゴリズムアナリスト',
    englishName: 'Algorithm Analyst',
    summary: '感情的なノイズを排し、冷徹な理性と正確なデータで問題を解決하는 아날리스트',
    description: '감정적인 노이즈를 완전히 거르고 차분한 이성과 실행력으로 최선의 대안을 설계합니다. 외부 자극에 동요하지 않는 이성적 에너지 상태입니다.',
    primaryColors: ['#3498DB', '#9B59B6'],
    imageKey: 'msag_stoic_analyst',
    threeBodyAnalysis: '6コードの脳波が穏やかなアルファ波を示しており、3コードの胃腸機能も安定しています。心と身体のフィードバックループが理想的です。',
    energyFortune: '霧のない早朝の氷의 숲과 같은, 타로의 「정의(Justice)」와 닮은 운세입니다. 판단과 이성적 조율이 필요한 문제 해결에 최적의 날입니다.',
    luckyPrescription: '冷たい緑茶、3コード活性化のためのコアマッスル運動、네イビー 컬러의 소품'
  },
  MSAF: {
    code: 'MSAF',
    name: 'ジレンマ学者',
    englishName: 'Dilemma Scholar',
    summary: '知的な洞察力は高いが、하체의 에너지 방전으로 인해 내면의 불안을 느끼기 쉬운 상태',
    description: '深い思考力と脳の容量を持っていますが、大地のグラウンディング（根）が弱くなっているため、自律神経系に慢性的な微細な不安が生じやすい状態です。',
    primaryColors: ['#9B59B6', '#E74C3C'],
    imageKey: 'msaf_anxious_scholar',
    threeBodyAnalysis: '6코드의 지적 사용량은 매우 높으나 1코드의 뿌리 에너지가 고갈되어, 상기된 기운을 아래로 내리지 못해 불안정한 흐름을 보입니다.',
    energyFortune: '雲の中で揺れ動く木の枝のような、「ソード의 9(Nine of Swords)」에 닮은 운세입니다. 지나친 생각을 비우고 다리를 많이 쓰는 단순 활동을 권장합니다.',
    luckyPrescription: '香ばしいアマドコロ茶、1コード強化のためのランジやスクワット、묵직한 가죽 액세서리'
  },
  MSCG: {
    code: 'MSCG',
    name: 'K-瞑想グル',
    englishName: 'K-Meditation Guru',
    summary: '深い洞察力と穏やかな平和が完全に統合された究極の瞑想状態',
    description: '지혜와 내성, 가슴 깊은 사랑이 조화를 이루며 온전한 평화를 실현하고 있습니다. 외부 흔들림에 지장을 받지 않는 단단한 마음의 방패를 형성하고 있습니다.',
    primaryColors: ['#2ECC71', '#E8D5F5'],
    imageKey: 'mscg_zen_master',
    threeBodyAnalysis: '6コード、4コード、7コードが柔軟に連動しています。心拍変動（HRV）が安定し、脳波は深い瞑想状態を示すアルファ波を維持しています。',
    energyFortune: '澄み切った穏やかな湖のような、「節制（Temperance）」タロットに似た運勢です。内省を深め、インスピレーションを受け取り、インナーヒーリングを行うのに最適な日です。',
    luckyPrescription: 'リラックスできるカモミール茶、4〜6コード調和呼吸瞑想、エメラルドグリーンの小物'
  },
  MSCF: {
    code: 'MSCF',
    name: 'クラウドウォーカー',
    englishName: 'Cloud Walker',
    summary: '精神性と意識は極めて高いが、現実的なグラウンディング이 부족하여 떠 있는 상태',
    description: '優れた精神的な気高さを持っていますが、現実世界で具現化・実行するためのグラウンディングエネルギーが不足しています。エネルギーが天に浮いています。',
    primaryColors: ['#3498DB', '#E8D5F5'],
    imageKey: 'mscf_ethereal_mystic',
    threeBodyAnalysis: '7코드 백회는 맑게 열려 있으나, 1코드와 2코드의 지지력이 부족하여 생각이 구체적인 실천과 실행으로 연결되지 못하는 지연 상태입니다.',
    energyFortune: '空中に逆さまに吊るされた修行者のような、「吊るされた男（The Hanged Man）」に似た運勢です。今日は体をしっかり動かす現実的な肉体労働や掃除を行って地に足をつけましょう。',
    luckyPrescription: '温かい烏龍茶、20分間の裸足でのグラウンディング、重みのある陶器の食器を使用する'
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
