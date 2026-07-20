import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './',
      server: {
        port: 3001,
        host: '0.0.0.0',
      },
      plugins: [
        react(), 
        tailwindcss(),
        {
          name: 'local-gemini-proxy',
          configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
              const url = req.url || '';
              const isUS = url === '/api/gemini-us';
              const isKR = url === '/api/gemini';
              const isJP = url === '/api/gemini-jp';
              
              if ((isUS || isKR || isJP) && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => { body += chunk.toString(); });
                req.on('end', async () => {
                  try {
                    const parsedBody = JSON.parse(body);
                    let apiKey = env.GEMINI_API_KEY;
                    if (isUS) {
                      apiKey = env.GEMINI_API_KEY_US || env.GEMINI_API_KEY;
                    } else if (isJP) {
                      apiKey = env.GEMINI_API_KEY_JP || env.GEMINI_API_KEY;
                    }
                    if (!apiKey) {
                      res.statusCode = 500;
                      let errEnvName = 'Local GEMINI_API_KEY';
                      if (isUS) errEnvName = 'Local GEMINI_API_KEY_US';
                      else if (isJP) errEnvName = 'Local GEMINI_API_KEY_JP';
                      res.end(JSON.stringify({ error: `${errEnvName} is not set in .env` }));
                      return;
                    }
                    
                    const { model, contents, config: genConfig } = parsedBody;
                    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                    
                    const requestBody: any = {
                      contents: Array.isArray(contents) ? contents : [contents],
                    };
                    if (genConfig) {
                      requestBody.generationConfig = {};
                      if (genConfig.responseMimeType) requestBody.generationConfig.responseMimeType = genConfig.responseMimeType;
                      if (genConfig.responseSchema) requestBody.generationConfig.responseSchema = genConfig.responseSchema;
                    }

                    const response = await fetch(geminiUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(requestBody)
                    });
                    
                    const data = await response.json();
                    if (!response.ok) {
                      res.statusCode = response.status;
                      res.end(JSON.stringify(data));
                      return;
                    }

                    const candidate = data.candidates?.[0];
                    const part = candidate?.content?.parts?.[0];
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                      text: part?.text || null,
                      inlineData: part?.inlineData || null,
                    }));
                  } catch (e: any) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: e.message }));
                  }
                });
              } else {
                next();
              }
            });
          }
        }
      ],
      define: {
        // 클라이언트 빌드 시에는 환경 변수가 빈 문자열로 교체되므로 소스코드에 키가 노출되지 않음
        'process.env.API_KEY': JSON.stringify(''),
        'process.env.GEMINI_API_KEY': JSON.stringify(''),
        'process.env.GEMINI_API_KEY_US': JSON.stringify(''),
        'process.env.GEMINI_API_KEY_JP': JSON.stringify('')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          '@shared': path.resolve(__dirname, './shared'),
          'react': path.resolve(__dirname, 'node_modules/react'),
          'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
        }
      },
      optimizeDeps: {
        include: [
          'firebase/app',
          'firebase/firestore',
          'firebase/auth'
        ]
      }
    };
});
