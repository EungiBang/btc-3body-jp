// Vercel Serverless 환경에서 Gemini API 호출을 대행하는 Proxy API 핸들러 (미국 서비스 전용)
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST method is allowed.' });
  }

  const apiKey = process.env.GEMINI_API_KEY_US;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY_US is not configured on the server.' });
  }

  try {
    const { model, contents, config } = req.body;

    if (!model || !contents) {
      return res.status(400).json({ error: 'Missing required parameters: model and contents.' });
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model,
      contents,
      config,
    });

    return res.status(200).json({
      text: response.text,
    });
  } catch (error: any) {
    console.error('Gemini proxy error:', error);
    return res.status(500).json({ error: error.message || 'Internal error during Gemini API call.' });
  }
}
