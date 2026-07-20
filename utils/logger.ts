/**
 * BTC 3-Body AI 통합 로거
 * 콘솔 + 화면(Toast) 이중 출력 지원
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  tag: string;
  message: string;
  data?: any;
}

// 최근 로그를 순환 버퍼에 보관 (최대 200건)
const LOG_BUFFER_SIZE = 200;
const logBuffer: LogEntry[] = [];

const getTimestamp = () => {
  const d = new Date();
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}.${d.getMilliseconds().toString().padStart(3,'0')}`;
};

const pushLog = (entry: LogEntry) => {
  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_SIZE) logBuffer.shift();
};

/** 화면 Toast 이벤트 발행 (AssessmentFlow에서 수신) */
const emitToast = (message: string, type: 'success' | 'error' | 'info') => {
  window.dispatchEvent(new CustomEvent('logger:toast', { detail: { message, type } }));
};

export const logger = {
  debug(tag: string, message: string, data?: any) {
    const entry: LogEntry = { timestamp: getTimestamp(), level: 'DEBUG', tag, message, data };
    pushLog(entry);
    console.debug(`%c[${entry.timestamp}] [${tag}] ${message}`, 'color: #888', data !== undefined ? data : '');
  },

  info(tag: string, message: string, data?: any) {
    const entry: LogEntry = { timestamp: getTimestamp(), level: 'INFO', tag, message, data };
    pushLog(entry);
    console.log(`%c[${entry.timestamp}] ✅ [${tag}] ${message}`, 'color: #22c55e; font-weight: bold', data !== undefined ? data : '');
  },

  warn(tag: string, message: string, data?: any) {
    const entry: LogEntry = { timestamp: getTimestamp(), level: 'WARN', tag, message, data };
    pushLog(entry);
    console.warn(`[${entry.timestamp}] ⚠️ [${tag}] ${message}`, data !== undefined ? data : '');
  },

  error(tag: string, message: string, error?: any, showOnScreen = false) {
    const errorDetail = error instanceof Error ? `${error.message}\n${error.stack?.substring(0, 300)}` : String(error ?? '');
    const entry: LogEntry = { timestamp: getTimestamp(), level: 'ERROR', tag, message, data: errorDetail };
    pushLog(entry);
    console.error(`[${entry.timestamp}] ❌ [${tag}] ${message}`, error);
    
    if (showOnScreen) {
      emitToast(`[${tag}] ${message}${errorDetail ? ': ' + errorDetail.substring(0, 100) : ''}`, 'error');
    }
  },

  /** API 호출 시작/끝 마커 */
  apiStart(tag: string, endpoint: string, payload?: any) {
    console.groupCollapsed(`%c[API ▶] [${tag}] ${endpoint}`, 'color: #3b82f6; font-weight: bold');
    if (payload) console.log('Payload:', payload);
    console.groupEnd();
    this.debug(tag, `API 호출 시작: ${endpoint}`);
  },

  apiEnd(tag: string, endpoint: string, success: boolean, data?: any) {
    const icon = success ? '✅' : '❌';
    console.log(`%c[API ${icon}] [${tag}] ${endpoint} → ${success ? 'SUCCESS' : 'FAILED'}`, `color: ${success ? '#22c55e' : '#ef4444'}; font-weight: bold`, data !== undefined ? data : '');
    if (success) {
      this.info(tag, `API 완료: ${endpoint}`);
    } else {
      this.error(tag, `API 실패: ${endpoint}`, data);
    }
  },

  /** 상태 변화 추적 */
  stateChange(tag: string, stateName: string, from: any, to: any) {
    console.log(`%c[STATE] [${tag}] ${stateName}: ${String(from)} → ${String(to)}`, 'color: #a855f7; font-weight: bold');
    this.debug(tag, `상태 변경: ${stateName} ${String(from)} → ${String(to)}`);
  },

  /** 최근 로그 버퍼 반환 (디버그 패널용) */
  getRecentLogs(): LogEntry[] {
    return [...logBuffer];
  },

  /** 에러 로그만 반환 */
  getErrorLogs(): LogEntry[] {
    return logBuffer.filter(l => l.level === 'ERROR');
  }
};

export default logger;
