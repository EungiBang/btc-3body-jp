import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface VersionInfo {
  latestVersion: string;
  downloadUrl: string;
}

export const getLatestVersionInfo = async (): Promise<VersionInfo | null> => {
  try {
    const versionRef = doc(db, 'system', 'version');
    const versionSnap = await getDoc(versionRef);
    if (versionSnap.exists()) {
      return versionSnap.data() as VersionInfo;
    }
  } catch (error) {
    console.error('Failed to fetch latest version info:', error);
  }
  return null;
};
