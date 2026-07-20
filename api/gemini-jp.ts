// Vercel Serverless 환경에서 Gemini API 호출을 대행하는 Proxy API 핸들러 (일본 서비스 전용)
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 120,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigins = [
    'https://btc-3body-outdoor-lite.vercel.app',
    'https://uscodmap-wellness.vercel.app',
    'http://localhost:3001',
    'http://localhost:3000',
  ];
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.includes('3body')) {
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

  const apiKey = process.env.GEMINI_API_KEY_JP || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server API key not configured' });
  }

  try {
    const { model, contents, config: genConfig } = req.body;

    if (!model || !contents) {
      return res.status(400).json({ error: 'Missing required fields: model, contents' });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const requestBody: any = {
      contents: Array.isArray(contents) ? contents : [contents],
    };

    if (genConfig) {
      requestBody.generationConfig = {};
      if (genConfig.responseMimeType) {
        requestBody.generationConfig.responseMimeType = genConfig.responseMimeType;
      }
      if (genConfig.responseSchema) {
        requestBody.generationConfig.responseSchema = genConfig.responseSchema;
      }
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
      console.error('[Gemini JP Proxy] API Error:', data);
      return res.status(response.status).json(data);
    }

    const candidate = data.candidates?.[0];
    const part = candidate?.content?.parts?.[0];
    const text = part?.text || null;
    const inlineData = part?.inlineData || null;

    return res.status(200).json({
      text,
      inlineData,
      candidates: data.candidates,
    });
  } catch (error: any) {
    console.error('[Gemini JP Proxy] Server Error:', error);
    return res.status(500).json({ error: error.message || 'Internal proxy error' });
  }
}
