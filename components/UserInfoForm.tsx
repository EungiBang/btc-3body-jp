// 사용자 개인정보 및 측정 목적 설정을 입력받는 폼 컴포넌트
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UserInfo, MemberRecord } from '../types';
import { getRecordsLocally } from '../services/localDb';

interface UserInfoFormProps {
  onSubmit: (info: UserInfo) => void;
}

const UserInfoForm: React.FC<UserInfoFormProps> = ({ onSubmit }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<UserInfo>({
    name: '',
    gender: 'male',
    age: 30,
    phone: '',
    resultDelivery: 'none',
    memberType: 'new',
  });

  const [birth, setBirth] = useState({ year: '', month: '' });
  const [error, setError] = useState<string | null>(null);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [showPrivacyDetail, setShowPrivacyDetail] = useState(false);

  // 컴포넌트 마운트 시 이전에 입력했던 전화번호와 수신 방식 불러오기 (현장 요청 반영)
  useEffect(() => {
    const savedPhone = localStorage.getItem('bt_last_phone');
    const savedDelivery = localStorage.getItem('bt_last_delivery');
    if (savedPhone) {
      setFormData(prev => ({ 
        ...prev, 
        phone: savedPhone, 
        resultDelivery: (savedDelivery as any) || 'none' 
      }));
    }
  }, []);

  // 재측정 모드
  const [mode, setMode] = useState<'new' | 'retest'>('new');
  const [existingRecords, setExistingRecords] = useState<MemberRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<MemberRecord | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // DB에서 기존 회원 로드
  useEffect(() => {
    if (mode === 'retest') {
      getRecordsLocally().then(records => {
        // pending 레코드 제외, report가 있는 것만
        const valid = records.filter(r => !r.id.startsWith('pending-') && r.report?.id);
        // 이름별로 최신 것만 추출
        const latestByName = new Map<string, MemberRecord>();
        valid.sort((a, b) => new Date(b.lastTestDate).getTime() - new Date(a.lastTestDate).getTime());
        for (const r of valid) {
          if (!latestByName.has(r.name)) latestByName.set(r.name, r);
        }
        setExistingRecords(Array.from(latestByName.values()));
      });
    }
  }, [mode]);

  const filteredRecords = existingRecords.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectExistingMember = (record: MemberRecord) => {
    setSelectedRecord(record);
    const info = record.report.userInfo;
    setFormData({
      name: info.name,
      gender: info.gender,
      age: info.age,
      phone: info.phone || '',
      resultDelivery: info.resultDelivery || 'none',
      memberType: info.memberType || 'existing',
      previousRecordId: record.id,
    });
    setShowDropdown(false);
    setSearchTerm('');
    setError(null);
  };

  // 생년월일로 만나이 계산
  const calculateAge = (year: string, month: string) => {
    if (!year || !month) return 30;
    const y = parseInt(year);
    const m = parseInt(month);
    if (isNaN(y) || isNaN(m)) return 30;
    let fullYear = y;
    if (y < 100) fullYear = y < 30 ? 2000 + y : 1900 + y;
    const today = new Date();
    const birthDate = new Date(fullYear, m - 1, 1);
    let age = today.getFullYear() - birthDate.getFullYear();
    const mDiff = today.getMonth() - birthDate.getMonth();
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < birthDate.getDate())) age--;
    return Math.max(0, age);
  };

  const handleBirthChange = (field: 'year' | 'month', value: string) => {
    const onlyNum = value.replace(/[^0-9]/g, '');
    
    // 월: 1~12 범위만 허용
    if (field === 'month') {
      const num = parseInt(onlyNum);
      if (onlyNum.length > 0 && num > 12) return; // 12 초과 입력 차단
      if (onlyNum === '00') return; // 00 차단
    }
    
    const newBirth = { ...birth, [field]: onlyNum };
    setBirth(newBirth);
    if (newBirth.year && newBirth.month) {
      const calculatedAge = calculateAge(newBirth.year, newBirth.month);
      setFormData(prev => ({ ...prev, age: calculatedAge }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) { setError(t('userInfo.errorName')); return; }
    if (mode === 'new' && (!birth.year || !birth.month)) { setError(t('userInfo.errorBirth')); return; }
    if (!privacyConsent) { setError(t('userInfo.errorConsent')); return; }
    setError(null);

    // 제출 시 전화번호 및 수신 방식 로컬 스토리지에 저장
    if (formData.phone) {
      localStorage.setItem('bt_last_phone', formData.phone);
      if (formData.resultDelivery) {
        localStorage.setItem('bt_last_delivery', formData.resultDelivery);
      }
    } else {
      localStorage.removeItem('bt_last_phone');
      localStorage.removeItem('bt_last_delivery');
    }

    onSubmit(formData);
  };

  const formatPhone = (value: string) => {
    const nums = value.replace(/[^0-9]/g, '');
    if (nums.length <= 3) return nums;
    if (nums.length <= 7) return `${nums.slice(0, 3)}-${nums.slice(3)}`;
    return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7, 11)}`;
  };

  return (
    <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-slate-900 w-full h-full">
      <div className="absolute top-[-10%] right-[20%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[20%] w-[30%] h-[30%] bg-blue-500/10 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '2s' }}></div>

      <div className="relative z-10 max-w-md w-full p-10 rounded-[2.5rem] border border-white/10 shadow-2xl"
           style={{
             background: 'rgba(15, 23, 42, 0.75)',
             backdropFilter: 'blur(30px)',
             boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
           }}>
        
        <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-white to-indigo-200 mb-6 text-center tracking-tight">{t('userInfo.title')}</h3>
        
        {/* 모드 선택: 신규 vs 재측정 */}
        <div className="mb-6 flex gap-2 p-1.5 bg-slate-800/80 rounded-xl border border-slate-700/50 shadow-inner">
          <button 
            type="button"
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${mode === 'new' ? 'bg-indigo-600/90 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
            onClick={() => { setMode('new'); setSelectedRecord(null); setFormData(prev => ({ ...prev, previousRecordId: undefined })); }}
          >
            {t('userInfo.newTest')}
          </button>
          <button 
            type="button"
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${mode === 'retest' ? 'bg-amber-500/90 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
            onClick={() => setMode('retest')}
          >
            {t('userInfo.retest')}
          </button>
        </div>

        {/* 재측정 모드: 기존 회원 검색 */}
        {mode === 'retest' && !selectedRecord && (
          <div className="mb-6">
            <label className="block text-xs font-bold tracking-widest uppercase text-amber-300/80 mb-2">
              {t('userInfo.searchExisting')}
            </label>
            <div className="relative">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
              <input 
                type="text"
                className="w-full pl-10 pr-4 py-3.5 bg-slate-800/60 rounded-xl border border-amber-500/30 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                placeholder={t('userInfo.searchPlaceholder')}
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
              />
            </div>
            
            {showDropdown && (
              <div className="mt-2 bg-slate-800 border border-slate-700 rounded-xl max-h-60 overflow-y-auto shadow-2xl">
                {filteredRecords.length > 0 ? filteredRecords.map(record => (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => selectExistingMember(record)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-600/20 transition-all text-left border-b border-slate-700/50 last:border-0"
                  >
                    <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400 font-bold text-lg shrink-0">
                      {record.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-bold text-sm">{record.name}</div>
                      <div className="text-slate-400 text-[10px]">
                        {new Date(record.lastTestDate).toLocaleDateString()} · 
                        {t('userInfo.physicalAgeShort')} {record.report.physicalAge}{t('userInfo.yearsOldShort')} · 
                      {t('userInfo.overallScoreShort')} {record.report.overallScore}{t('userInfo.pointsShort')}
                    </div>
                  </div>
                  <i className="fas fa-chevron-right text-slate-500 text-xs"></i>
                </button>
              )) : (
                <div className="px-4 py-6 text-center text-slate-400 text-sm">
                  {existingRecords.length === 0 
                    ? t('userInfo.noHistory') 
                    : t('userInfo.noSearchResults')}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 재측정 - 선택된 회원 표시 */}
      {mode === 'retest' && selectedRecord && (
        <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-amber-300 text-xs font-bold">{t('userInfo.loadedRecord')}</span>
            <button 
              type="button"
              onClick={() => { setSelectedRecord(null); setFormData(prev => ({ ...prev, name: '', previousRecordId: undefined })); }}
              className="text-slate-400 text-xs hover:text-white transition-all"
            >
              {t('userInfo.clearSelection')}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-400 font-bold text-xl">
              {selectedRecord.name[0]}
            </div>
            <div>
              <div className="text-white font-bold">{selectedRecord.name}</div>
              <div className="text-slate-400 text-[10px]">
                {t('userInfo.prevTestDate')} {new Date(selectedRecord.lastTestDate).toLocaleDateString()} · 
                {t('userInfo.physicalAge')} {selectedRecord.report.physicalAge}{t('userInfo.yearsOldShort')} · {t('userInfo.overallScore')} {selectedRecord.report.overallScore}{t('userInfo.pointsShort')}
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-800/60 rounded-lg p-2">
              <div className="text-[10px] text-slate-400">{t('userInfo.physicalAge')}</div>
              <div className="text-indigo-400 font-black text-lg">{selectedRecord.report.physicalAge} {t('userInfo.yearsOld')}</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-2">
              <div className="text-[10px] text-slate-400">{t('userInfo.brainAge')}</div>
              <div className="text-purple-400 font-black text-lg">{selectedRecord.report.brainAge} {t('userInfo.yearsOld')}</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-2">
              <div className="text-[10px] text-slate-400">{t('userInfo.overallScore')}</div>
              <div className="text-emerald-400 font-black text-lg">{selectedRecord.report.overallScore} {t('userInfo.pointsShort')}</div>
            </div>
          </div>
        </div>
      )}


        <form onSubmit={handleSubmit} className="space-y-6">
          {/* memberType selection tab is removed to prevent double tab layout confusion */}

          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-indigo-300/80 mb-2">{t('userInfo.name')}</label>
            <input 
              type="text" 
              className={`w-full px-4 py-3.5 bg-slate-800/60 rounded-xl border ${error?.includes('name') ? 'border-rose-500/50 focus:ring-rose-500/50' : 'border-slate-700/50 focus:ring-indigo-500/50'} text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all shadow-inner`}
              placeholder={t('userInfo.name')}
              value={formData.name}
              onChange={e => {
                setFormData({...formData, name: e.target.value});
                if (e.target.value) setError(null);
              }}
              readOnly={mode === 'retest' && !!selectedRecord}
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-indigo-300/80 mb-2">{t('userInfo.gender')}</label>
            <div className="grid grid-cols-2 gap-3">
              {(['male', 'female'] as const).map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setFormData({...formData, gender: g})}
                  className={`py-3.5 rounded-xl border font-bold transition-all ${formData.gender === g ? 'bg-indigo-600/90 border-indigo-400/50 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:bg-slate-700/50'}`}
                >
                  {g === 'male' ? <><i className="fas fa-mars mr-1 opacity-70"></i> {t('userInfo.male')}</> : <><i className="fas fa-venus mr-1 opacity-70"></i> {t('userInfo.female')}</>}
                </button>
              ))}
            </div>
          </div>

          {/* 신규 모드에서만 생년월일 입력 */}
          {mode === 'new' && (
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-indigo-300/80 mb-2 flex justify-between items-center">
                <span>{t('userInfo.birthAndAge')}</span>
                {(birth.year && birth.month) && (
                   <span className="text-white font-mono bg-indigo-600 px-2 py-0.5 rounded text-[11px] shadow-lg animate-pulse-once">{formData.age} {t('userInfo.yearsOld')}</span>
                )}
              </label>
              <div className="flex gap-3">
                 <div className="relative flex-1">
                   <input 
                     type="text" 
                     maxLength={4}
                     className={`w-full px-4 py-3.5 bg-slate-800/60 rounded-xl border ${error?.includes('birth') ? 'border-rose-500/50' : 'border-slate-700/50'} text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono`}
                     placeholder={t('userInfo.birthYearMonth').split('/')[0].trim()}
                     value={birth.year}
                     onChange={e => handleBirthChange('year', e.target.value)}
                   />
                   <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">{t('userInfo.birthYearMonth').split('/')[0].trim()}</span>
                 </div>
                 <div className="relative w-1/3">
                   <input 
                     type="text" 
                     maxLength={2}
                     className={`w-full px-4 py-3.5 bg-slate-800/60 rounded-xl border ${error?.includes('birth') ? 'border-rose-500/50' : 'border-slate-700/50'} text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono`}
                     placeholder={t('userInfo.birthYearMonth').split('/')[1].trim()}
                     value={birth.month}
                     onChange={e => handleBirthChange('month', e.target.value)}
                   />
                   <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">{t('userInfo.birthYearMonth').split('/')[1].trim()}</span>
                 </div>
              </div>
            </div>
          )}

          {/* 재측정 모드: 만나이 표시 */}
          {mode === 'retest' && selectedRecord && (
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 px-4 py-3 flex items-center justify-between">
              <span className="text-indigo-300/80 text-xs font-bold uppercase tracking-widest">{t('userInfo.age')}</span>
              <span className="text-white font-mono bg-indigo-600 px-3 py-1 rounded-lg text-sm font-bold shadow-lg">{formData.age} {t('userInfo.yearsOld')}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-indigo-300/80 mb-1">
              {t('userInfo.phone')} <span className="text-slate-500 font-normal ml-1">{t('userInfo.phoneOptional')}</span>
            </label>
            <p className="text-[10px] text-indigo-400/90 mb-3 bg-indigo-500/10 py-1.5 px-2 rounded-lg border border-indigo-500/20 inline-block font-medium">
              <i className="fas fa-gift mr-1.5 mt-0.5 text-amber-400"></i> {t('userInfo.agreeNotice')}
            </p>
            <input 
              type="tel" 
              className="w-full px-4 py-3.5 bg-slate-800/60 rounded-xl border border-slate-700/50 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all shadow-inner font-mono"
              placeholder={t('userInfo.phonePlaceholder')}
              value={formData.phone || ''}
              onChange={e => {
                const formatted = formatPhone(e.target.value);
                setFormData({...formData, phone: formatted});
              }}
              maxLength={13}
            />
            
            {formData.phone && formData.phone.replace(/[^0-9]/g, '').length >= 10 && (
              <div className="mt-4 p-4 bg-slate-800/80 rounded-xl border border-indigo-500/20 backdrop-blur-sm space-y-3 shadow-inner">
                <p className="text-[11px] font-bold text-indigo-300/90 tracking-wide flex items-center">
                  <i className="fas fa-satellite-dish mr-2 animate-pulse text-indigo-400"></i> {t('userInfo.deliveryMethod')}
                </p>
                <div className="flex gap-2">
                  {([
                    { value: 'sms' as const, label: t('userInfo.deliverySms'), icon: 'fa-sms' },
                    { value: 'none' as const, label: t('userInfo.deliveryNone'), icon: 'fa-times' },
                  ]).map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData({...formData, resultDelivery: option.value})}
                      className={`flex-1 py-3 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5 ${
                        formData.resultDelivery === option.value
                          ? option.value === 'sms'
                            ? 'bg-blue-500/90 text-blue-50 border border-blue-400/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                            : 'bg-slate-600/90 text-slate-100 border border-slate-500/50'
                          : 'bg-slate-900/50 border border-slate-700/50 text-slate-400 hover:bg-slate-700/50'
                      }`}
                    >
                      <i className={`fas ${option.icon} text-lg`}></i>
                      <span className="text-[10px] opacity-90">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={privacyConsent}
                onChange={e => { setPrivacyConsent(e.target.checked); if (e.target.checked && error?.includes('privacy')) setError(null); }}
                className="mt-0.5 w-5 h-5 rounded border-2 border-indigo-500/50 bg-slate-900/50 text-indigo-500 focus:ring-indigo-500/50 focus:ring-offset-0 cursor-pointer shrink-0"
              />
              <span className="text-sm text-slate-300 leading-relaxed">
                {t('userInfo.agreeRequire')}
              </span>
            </label>
            <button
              type="button"
              onClick={() => setShowPrivacyDetail(!showPrivacyDetail)}
              className="mt-2 ml-8 text-[11px] text-indigo-400/80 hover:text-indigo-300 transition-colors flex items-center gap-1"
            >
              <i className={`fas fa-chevron-${showPrivacyDetail ? 'up' : 'down'} text-[8px]`}></i>
              {t('userInfo.viewPrivacyDetail')}
            </button>
            {showPrivacyDetail && (
              <div className="mt-3 ml-8 p-4 bg-slate-900/60 rounded-xl border border-slate-700/30 text-[11px] text-slate-400 leading-relaxed space-y-2 max-h-60 overflow-y-auto">
                <p className="font-bold text-slate-300 text-xs mb-2">{t('userInfo.privacyTitle')}</p>
                <table className="w-full text-left border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-700/30">
                      <td className="py-1.5 pr-3 font-bold text-indigo-300/80 whitespace-nowrap align-top">{t('userInfo.privacyItems')}</td>
                      <td className="py-1.5">{t('userInfo.privacyItemsDetail')}</td>
                    </tr>
                    <tr className="border-b border-slate-700/30">
                      <td className="py-1.5 pr-3 font-bold text-indigo-300/80 whitespace-nowrap align-top">{t('userInfo.privacyPurpose')}</td>
                      <td className="py-1.5">{t('userInfo.privacyPurposeDetail')}</td>
                    </tr>
                    <tr className="border-b border-slate-700/30">
                      <td className="py-1.5 pr-3 font-bold text-indigo-300/80 whitespace-nowrap align-top">{t('userInfo.privacyRetention')}</td>
                      <td className="py-1.5 whitespace-pre-line">{t('userInfo.privacyRetentionDetail')}</td>
                    </tr>
                    <tr className="border-b border-slate-700/30">
                      <td className="py-1.5 pr-3 font-bold text-indigo-300/80 whitespace-nowrap align-top">{t('userInfo.privacyThirdParty')}</td>
                      <td className="py-1.5">{t('userInfo.privacyThirdPartyDetail')}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pr-3 font-bold text-indigo-300/80 whitespace-nowrap align-top">{t('userInfo.privacyRights')}</td>
                      <td className="py-1.5">{t('userInfo.privacyRightsDetail')}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-[10px] text-slate-500 mt-2 pt-2 border-t border-slate-700/30">
                  {t('userInfo.wellnessNotice')}
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3 text-rose-300 text-sm font-bold">
              ⚠️ {error}
            </div>
          )}

          <button 
            id="user-info-submit-btn"
            type="submit"
            disabled={mode === 'retest' && !selectedRecord}
            className={`relative overflow-hidden w-full group text-white font-bold py-4 rounded-xl transition-all duration-300 border mt-6 ${
              mode === 'retest' && !selectedRecord 
                ? 'bg-slate-600 border-slate-500/30 opacity-50 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-400/30'
            }`}
            style={{ boxShadow: mode === 'retest' && !selectedRecord ? 'none' : '0 10px 20px -5px rgba(99,102,241,0.4)' }}
          >
            <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-[150%] skew-x-[-20deg] group-hover:translate-x-[250%] transition-transform duration-1000 ease-out"></div>
            <span className="relative z-10 flex items-center justify-center gap-2 tracking-widest text-sm">
              <i className="fas fa-fingerprint opacity-70"></i>
              {mode === 'retest' 
                ? (selectedRecord ? t('common.startAssessment') : t('userInfo.selectMemberAlert'))
                : t('common.startAssessment')
              }
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default UserInfoForm;

