import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MINIMAX_TEXT_MODEL,
  FALLBACK_MINIMAX_TEXT_MODEL,
  resolveMiniMaxTextModel,
} from '@/lib/minimax-client';

describe('resolveMiniMaxTextModel', () => {
  it('defaults to MiniMax-M3', () => {
    expect(resolveMiniMaxTextModel()).toBe(DEFAULT_MINIMAX_TEXT_MODEL);
    expect(resolveMiniMaxTextModel('')).toBe(DEFAULT_MINIMAX_TEXT_MODEL);
  });

  it('keeps MiniMax M3 variants when explicitly requested', () => {
    expect(resolveMiniMaxTextModel('MiniMax-M3')).toBe('MiniMax-M3');
    expect(resolveMiniMaxTextModel('MiniMax-M3.1')).toBe('MiniMax-M3.1');
    expect(resolveMiniMaxTextModel('minimax-m3-preview')).toBe('minimax-m3-preview');
  });

  it('keeps MiniMax-M2.7 and vision fallback models when explicitly requested', () => {
    expect(FALLBACK_MINIMAX_TEXT_MODEL).toBe('MiniMax-M2.7');
    expect(resolveMiniMaxTextModel(FALLBACK_MINIMAX_TEXT_MODEL)).toBe('MiniMax-M2.7');
    expect(resolveMiniMaxTextModel('MiniMax-VL-01')).toBe('MiniMax-VL-01');
  });
});
