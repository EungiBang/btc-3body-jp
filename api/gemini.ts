import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function — Gemini API Proxy
 * 
 * 클라이언트에서 직접 Gemini API를 호출하면 API 키가 JS 번들에 노출됩니다.
 * 이 프록시를 통해 API 키를 서버 측에서만 관리합니다.
 * 
 * POST /api/gemini
 * Body: { model, contents, config }
 */

export const config = {
  maxDuration: 120, // Gemini 분석은 최대 90초 소요
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 헤더 - 허용된 도메인만 접근 가능
  const allowedOrigins = [
    'https://btc-3body-outdoor-lite.vercel.app',
    'https://uscodmap-wellness.vercel.app',
    'http://localhost:3001',
    'http://localhost:3000',
  ];
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }


  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server API key not configured' });
  }

  try {
    const { model, contents, config: genConfig } = req.body;

    if (!model || !contents) {
      return res.status(400).json({ error: 'Missing required fields: model, contents' });
    }

    // Gemini REST API 직접 호출
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const requestBody: any = {
      contents: Array.isArray(contents) ? contents : [contents],
    };

    // generationConfig 구성
    if (genConfig) {
      requestBody.generationConfig = {};
      if (genConfig.responseMimeType) {
        requestBody.generationConfig.responseMimeType = genConfig.responseMimeType;
      }
      if (genConfig.responseSchema) {
        requestBody.generationConfig.responseSchema = genConfig.responseSchema;
      }
      // TTS용 설정
      if (genConfig.responseModalities) {
        requestBody.generationConfig.responseModalities = genConfig.responseModalities;
      }
      if (genConfig.speechConfig) {
        requestBody.generationConfig.speechConfig = genConfig.speechConfig;
      }
    }

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Gemini Proxy] API Error:', data);
      return res.status(response.status).json(data);
    }

    // 응답에서 text 또는 audio 데이터 추출
    const candidate = data.candidates?.[0];
    const part = candidate?.content?.parts?.[0];
    const text = part?.text || null;
    const inlineData = part?.inlineData || null;

    return res.status(200).json({
      text,
      inlineData,
      candidates: data.candidates, // 필요시 raw 데이터도 전달
    });
  } catch (error: any) {
    console.error('[Gemini Proxy] Server Error:', error);
    return res.status(500).json({ error: error.message || 'Internal proxy error' });
  }
}
