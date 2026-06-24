import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MINIMAX_TEXT_MODEL,
  resolveMiniMaxTextModel,
} from '@/lib/minimax-client';

describe('resolveMiniMaxTextModel', () => {
  it('defaults to MiniMax-M2.7', () => {
    expect(resolveMiniMaxTextModel()).toBe(DEFAULT_MINIMAX_TEXT_MODEL);
    expect(resolveMiniMaxTextModel('')).toBe(DEFAULT_MINIMAX_TEXT_MODEL);
  });

  it('prevents MiniMax M3 variants from being used', () => {
    expect(resolveMiniMaxTextModel('MiniMax-M3')).toBe(DEFAULT_MINIMAX_TEXT_MODEL);
    expect(resolveMiniMaxTextModel('MiniMax-M3.1')).toBe(DEFAULT_MINIMAX_TEXT_MODEL);
    expect(resolveMiniMaxTextModel('minimax-m3-preview')).toBe(DEFAULT_MINIMAX_TEXT_MODEL);
  });

  it('keeps MiniMax-M2.7 and other explicitly requested non-M3 models', () => {
    expect(resolveMiniMaxTextModel('MiniMax-M2.7')).toBe('MiniMax-M2.7');
    expect(resolveMiniMaxTextModel('MiniMax-VL-01')).toBe('MiniMax-VL-01');
  });
});
