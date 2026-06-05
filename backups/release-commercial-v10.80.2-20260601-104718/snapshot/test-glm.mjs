import { callGLM } from './src/lib/glm-client';

const start = Date.now();
try {
  const result = await callGLM('你是助手', 'AI是什么，用一句话介绍', 'outline', 1, 15000);
  console.log('SUCCESS - Time:', Date.now() - start, 'ms');
  console.log('Result:', result.substring(0, 300));
} catch(e) {
  console.error('FAILED after', Date.now() - start, 'ms:', e.message);
}