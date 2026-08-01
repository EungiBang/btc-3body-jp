// 텍스트를 음성(TTS)으로 합성하여 재생하는 서비스 파일
import { GoogleGenAI, Modality } from "@google/genai";
import i18n from '../i18n';
import { ErrorLogger } from './ErrorLogger';
import { getActiveApiKey } from './geminiService';

const isWebMode = (): boolean => typeof window !== 'undefined' && !window.electronAPI;

let currentAudioSource: AudioBufferSourceNode | null = null;
let currentHtmlAudio: HTMLAudioElement | null = null;
let audioContext: AudioContext | null = null;
const audioCache: Record<string, string> = {};
let quotaExceededUntil = 0;
let isPendingRequest = false;
let currentSpeechId = 0;

export const initAudio = async () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
};

export const preloadTTS = async (texts: string[]) => {
  const apiKey = getActiveApiKey();
  if (!apiKey && !isWebMode()) return;
  if (Date.now() < quotaExceededUntil) return;

  // 일본 지점 서비스이므로 일본어 음성으로 고정합니다.
  const isEnglish = false;
  const isJapanese = true;

  for (const text of texts) {
    if (audioCache[text]) continue;
    
    try {
      let ttsPrompt = `Please read the following text in a natural, warm, and healing voice of a Japanese female in her 30s. Make it sound as natural and human-like as possible, with a warm and gentle tone:\n\n${text}`;
      if (isEnglish) {
        ttsPrompt = `Please read the following text in a natural, warm, and healing voice of a female in her 30s. Make it sound as natural and human-like as possible, with a warm and gentle tone:\n\n${text}`;
      } else if (isJapanese) {
        ttsPrompt = `Please read the following Japanese text in a natural, warm, and healing voice of a Japanese female in her 30s. Make it sound as natural and human-like as possible, with a warm and gentle tone, speaking fluent Japanese:\n\n${text}`;
      }
      
      const ttsParams = {
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: ttsPrompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { 
            voiceConfig: { 
              prebuiltVoiceConfig: { 
                voiceName: 'Aoede' 
              } 
            } 
          },
        },
      };

      let base64Audio: string | undefined;
      if (isWebMode()) {
        let endpoint = '/api/gemini';
        if (isEnglish) {
          endpoint = '/api/gemini-us';
        } else if (isJapanese) {
          endpoint = '/api/gemini-jp';
        }
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ttsParams) });
        if (res.ok) { const data = await res.json(); base64Audio = data.inlineData?.data; }
      } else {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent(ttsParams);
        base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      }
      if (base64Audio) { audioCache[text] = base64Audio; }
      await new Promise(r => setTimeout(r, 2000));
    } catch (error: any) {
      const errorStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
      if (errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED')) {
        quotaExceededUntil = Date.now() + 5 * 60 * 1000;
        break;
      }
    }
  }
};

/**
 * 모든 TTS 재생 채널(AudioSource + HtmlAudio + SpeechSynthesis)을 즉시 중지합니다.
 */
export const stopSpeaking = () => {
  currentSpeechId++;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  if (currentHtmlAudio) {
    try {
      currentHtmlAudio.pause();
      currentHtmlAudio.currentTime = 0;
      currentHtmlAudio = null;
    } catch (e) {}
  }
  if (currentAudioSource) {
    try {
      currentAudioSource.stop();
      currentAudioSource.disconnect();
      currentAudioSource = null;
    } catch (e) {}
  }
};

// 로컬 브라우저 SpeechSynthesis 재생 헬퍼 함수
const playNativeSpeech = (speechText: string) => {
  if ('speechSynthesis' in window) {
    const currentLang = 'ja';
    const speakLang = 'ja-JP';
    
    console.log(`[TTS] Playing native ${speakLang} SpeechSynthesis for text: "${speechText}"`);
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = speakLang;
    
    const voices = window.speechSynthesis.getVoices();
    const targetVoice = voices.find(v => v.lang.startsWith(currentLang) && v.name.toLowerCase().includes('google')) ||
                        voices.find(v => v.lang.startsWith(currentLang) && v.name.toLowerCase().includes('female')) ||
                        voices.find(v => v.lang.startsWith(currentLang));
    if (targetVoice) utterance.voice = targetVoice;
    
    window.speechSynthesis.speak(utterance);
  }
};

export const speak = async (text: string) => {
  stopSpeaking();
  const thisSpeechId = currentSpeechId;
  const speechText = text.trim();

  // 1. 이미 캐시에 음성이 존재한다면, 로컬 재생 없이 즉시 프리미엄 음성만 재생
  if (audioCache[speechText]) {
    playBase64Audio(audioCache[speechText]);
    return;
  }

  // 2. 프리미엄 TTS 시도가 가능한 조건인 경우
  const isPremiumAvailable = Date.now() >= quotaExceededUntil && (isWebMode() || getActiveApiKey()) && !isPendingRequest;

  if (isPremiumAvailable) {
    try {
      const success = await fetchAndPlayText(speechText, thisSpeechId);
      if (success && currentSpeechId === thisSpeechId) {
        return;
      }
    } catch (error) {
      console.error("Premium TTS Error, falling back to native:", error);
    }
  }

  // 3. 프리미엄이 불가능하거나 실패한 경우 폴백으로 로컬 브라우저 음성 1회 재생
  if (currentSpeechId === thisSpeechId) {
    playNativeSpeech(speechText);
  }
};

const fetchAndPlayText = async (text: string, speechId: number): Promise<boolean> => {
  const apiKey = getActiveApiKey();
  if (!apiKey && !isWebMode()) return false;
  
  // 일본 지점 서비스이므로 일본어 음성으로 고정합니다.
  const isEnglish = false;
  const isJapanese = true;

  isPendingRequest = true;
  try {
    let ttsPrompt = `Please read the following text in a natural, warm, and healing voice of a Japanese female in her 30s. Make it sound as natural and human-like as possible, with a warm and gentle tone:\n\n${text}`;
    if (isEnglish) {
      ttsPrompt = `Please read the following text in a natural, warm, and healing voice of a female in her 30s. Make it sound as natural and human-like as possible, with a warm and gentle tone:\n\n${text}`;
    } else if (isJapanese) {
      ttsPrompt = `Please read the following Japanese text in a natural, warm, and healing voice of a Japanese female in her 30s. Make it sound as natural and human-like as possible, with a warm and gentle tone, speaking fluent Japanese:\n\n${text}`;
    }
    
    const ttsParams = {
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: ttsPrompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { 
          voiceConfig: { 
            prebuiltVoiceConfig: { 
              voiceName: 'Aoede' 
            } 
          } 
        },
      },
    };

    let base64Audio: string | undefined;
    if (isWebMode()) {
      let endpoint = '/api/gemini';
      if (isEnglish) {
        endpoint = '/api/gemini-us';
      } else if (isJapanese) {
        endpoint = '/api/gemini-jp';
      }
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ttsParams) });
      if (res.ok) { const data = await res.json(); base64Audio = data.inlineData?.data; }
    } else {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent(ttsParams);
      base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    }

    if (base64Audio) {
      audioCache[text] = base64Audio;
      if (currentSpeechId !== speechId) return false;
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      playBase64Audio(base64Audio);
      return true;
    }
  } catch (error: any) {
    const errorStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
    if (errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED')) {
      console.warn(`[TTS] quota exceeded - rate limit applied`);
      quotaExceededUntil = Date.now() + 5 * 60 * 1000;
    } else {
      console.error("TTS Fetch Error:", error);
      ErrorLogger.logApiError('ttsService.fetchAndPlayText', 'TTS Fetch Error', error);
    }
  } finally {
    isPendingRequest = false;
  }
  return false;
};

const playBase64Audio = async (base64Data: string) => {
  try {
    if (currentAudioSource) {
      currentAudioSource.stop();
      currentAudioSource.disconnect();
      currentAudioSource = null;
    }

    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    // Decode base64 to binary string
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Convert 16-bit PCM to Float32Array
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    const audioBuffer = audioContext.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);

    currentAudioSource = audioContext.createBufferSource();
    currentAudioSource.buffer = audioBuffer;
    currentAudioSource.connect(audioContext.destination);
    currentAudioSource.start();
  } catch (e) {
    console.error("Audio playback failed:", e);
  }
};

 
