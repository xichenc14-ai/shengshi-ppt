// useGammaGeneration.ts — Gamma 生成 + 轮询 Hook
// 提取自 page.tsx，统一管理直通模式和省心模式的生成逻辑

import { useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';

interface GammaPollOptions {
  inputText: string;
  themeId?: string;
  numCards: number;
  imageSource: string;
  tone: string;
  textMode: string;
  userId: string;
  pages: number;
  // 省心模式额外参数
  gammaPayload?: Record<string, any>;
}

interface GenerationResult {
  title: string;
  dlUrl: string;
  gammaUrl: string;
  actualPages: number;
  slides: any[];
}

interface UseGammaGenerationReturn {
  generate: (options: GammaPollOptions) => Promise<GenerationResult>;
  loading: boolean;
  error: string;
  progress: number;
  step: number;
  stepText: string;
  clearError: () => void;
}

export function useGammaGeneration(): UseGammaGenerationReturn {
  const { updateCredits, openPayment } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(0);
  const [stepText, setStepText] = useState('');

  const clearError = useCallback(() => setError(''), []);

  const generate = useCallback(async (options: GammaPollOptions): Promise<GenerationResult> => {
    const { inputText, themeId, numCards, imageSource, tone, textMode, userId, pages, gammaPayload } = options;

    setLoading(true);
    setError('');
    setStep(0);
    setProgress(10);
    setStepText('正在准备...');

    try {
      // Step 0: 扣积分
      setStep(1);
      setProgress(20);
      setStepText('正在扣除积分...');

      const deductRes = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deduct', userId, mode: textMode || 'generate', numPages: pages }),
      });
      const deductData = await deductRes.json();
      if (!deductRes.ok || deductData.error) {
        if (deductData.error === '积分不足') {
          setLoading(false);
          openPayment({
            id: 'basic',
            name: '积分不足，请充值',
            price: '¥9.9/月',
            billing: 'monthly',
            reason: '积分不足，无法生成PPT',
            neededCredits: deductData.needed,
            currentCredits: deductData.balance,
          });
          throw new Error('积分不足');
        }
        throw new Error(deductData.error || '积分扣除失败');
      }
      updateCredits(deductData.balance);

      // Step 1: 创建 Gamma 生成任务
      setStep(2);
      setProgress(30);
      setStepText('AI 正在渲染 PPT 页面...');

      let gRes: Response;
      if (gammaPayload) {
        // 省心模式：传完整 payload
        gRes = await fetch('/api/gamma', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gammaPayload),
        });
      } else {
        // 直通模式
        gRes = await fetch('/api/gamma-direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inputText,
            themeId,
            numCards,
            imageSource,
            tone,
            textMode,
            exportAs: 'pptx',
          }),
        });
      }

      if (!gRes.ok) {
        const d = await gRes.json();
        throw new Error(d.error || 'PPT 生成失败');
      }
      const gd = await gRes.json();

      if (!gd.generationId) {
        throw new Error('创建生成任务失败');
      }

      // Step 2: 轮询状态
      setStep(3);
      setProgress(50);
      setStepText('正在等待 AI 渲染 PPT...');

      const startTime = Date.now();
      const pollInterval = 3000; // 🚨 优化：缩短轮询间隔，快速响应
      let finalExportUrl = '';
      let finalGammaUrl = '';

      while (Date.now() - startTime < 180000) {
        await new Promise(r => setTimeout(r, pollInterval));

        const statusRes = await fetch(`/api/gamma?id=${gd.generationId}`);
        if (!statusRes.ok) continue;

        const statusData = await statusRes.json();

        if (statusData.status === 'completed') {
          finalExportUrl = statusData.exportUrl || '';
          finalGammaUrl = statusData.gammaUrl || '';
          setProgress(90);
          setStepText('PPT 生成完成，准备下载...');
          break;
        }

        if (statusData.status === 'failed') {
          throw new Error(statusData.error || '生成失败');
        }

        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setStepText(`AI 渲染中... ${elapsed}秒`);
        // 进度模拟：50% → 85%
        setProgress(50 + Math.min(35, Math.floor(elapsed / 5)));
      }

      if (!finalExportUrl) {
        throw new Error('生成超时（3分钟），请重试');
      }

      const title = inputText.split('\n')[0].replace(/^#\s*/, '').trim();
      setProgress(100);

      return {
        title: title || 'PPT',
        dlUrl: finalExportUrl,
        gammaUrl: finalGammaUrl,
        actualPages: pages,
        slides: [],
      };
    } catch (e: any) {
      const msg = e.message || '生成失败';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [updateCredits, openPayment]);

  return { generate, loading, error, progress, step, stepText, clearError };
}
