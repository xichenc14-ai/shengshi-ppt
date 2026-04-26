import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const tests = [];
  
  // Test 1: GLM API reachability
  try {
    const glmStart = Date.now();
    const glmRes = await fetch('https://mydamoxing.cn/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'glm-5', messages: [{role:'user',content:'hi'}], max_tokens: 5 }),
    });
    tests.push({ 
      name: 'GLM', 
      status: glmRes.status, 
      time: Date.now() - glmStart,
      error: glmRes.ok ? null : await glmRes.text().catch(() => 'unknown')
    });
  } catch (e: any) {
    tests.push({ name: 'GLM', status: 'failed', error: e.message });
  }

  // Test 2: Kimi API reachability
  try {
    const kimiStart = Date.now();
    const kimiRes = await fetch('https://ai.1seey.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'kimi-k2.5', messages: [{role:'user',content:'hi'}], max_tokens: 5 }),
    });
    tests.push({ 
      name: 'Kimi', 
      status: kimiRes.status, 
      time: Date.now() - kimiStart,
      error: kimiRes.ok ? null : await kimiRes.text().catch(() => 'unknown')
    });
  } catch (e: any) {
    tests.push({ name: 'Kimi', status: 'failed', error: e.message });
  }

  // Test 3: MiniMax API reachability
  try {
    const mmStart = Date.now();
    const mmRes = await fetch('https://api.minimaxi.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'MiniMax-M2.7', messages: [{role:'user',content:'hi'}], max_tokens: 5 }),
    });
    tests.push({ 
      name: 'MiniMax', 
      status: mmRes.status, 
      time: Date.now() - mmStart,
      error: mmRes.ok ? null : await mmRes.text().catch(() => 'unknown')
    });
  } catch (e: any) {
    tests.push({ name: 'MiniMax', status: 'failed', error: e.message });
  }

  return NextResponse.json({ 
    runtime: 'edge',
    region: process.env.VERCEL_REGION || 'unknown',
    tests,
    timestamp: new Date().toISOString()
  });
}