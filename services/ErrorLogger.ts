import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface ErrorLog {
  id?: string;
  message: string;
  stackTrace?: string;
  type: 'api' | 'crash' | 'unknown';
  severity: 'high' | 'medium' | 'low';
  source: string; // e.g., 'geminiService', 'ttsService', 'window.onerror'
  deviceInfo?: any;
  appVersion?: string;
  timestamp?: any;
  status: 'new' | 'viewed' | 'resolved';
}

class ErrorLoggerService {
  private async getDeviceInfo() {
    try {
      const storedDevice = localStorage.getItem('currentDevice');
      if (storedDevice) {
        return JSON.parse(storedDevice);
      }
      return {
        hardwareId: localStorage.getItem('webDeviceId') || 'unknown'
      };
    } catch (e) {
      return { error: 'Failed to read device info' };
    }
  }

  async logError(errorData: Omit<ErrorLog, 'status' | 'timestamp'>) {
    try {
      const deviceInfo = await this.getDeviceInfo();
      const appVersion = localStorage.getItem('lastAppVersion') || '1.0.0';

      const errorPayload: ErrorLog = {
        ...errorData,
        deviceInfo,
        appVersion,
        status: 'new',
        timestamp: serverTimestamp(),
      };

      await addDoc(collection(db, 'error_logs'), errorPayload);
      console.warn('Error successfully reported to central server.', errorPayload);
    } catch (e) {
      // Fallback: If error logging itself fails, just log to console to prevent infinite loops
      console.error('Failed to send error log to central server:', e);
    }
  }

  // Helper methods for specific error types
  async logApiError(source: string, message: string, errorObj?: any) {
    await this.logError({
      type: 'api',
      severity: 'high',
      source,
      message: message,
      stackTrace: errorObj instanceof Error ? errorObj.stack : JSON.stringify(errorObj),
    });
  }

  async logCrash(source: string, message: string, errorObj?: any) {
    await this.logError({
      type: 'crash',
      severity: 'high',
      source,
      message,
      stackTrace: errorObj instanceof Error ? errorObj.stack : String(errorObj),
    });
  }
}

export const ErrorLogger = new ErrorLoggerService();
