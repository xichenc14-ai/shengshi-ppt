/**
 * src/lib/ppt-param-adapter.ts
 *
 * Compatibility shim for outline/route.ts imports
 *
 * outline/route.ts 调用：
 *   import { normalizeUserInput, parseMarkdownOutline, generateMinimalOutline } from '@/lib/ppt-param-adapter';
 *
 * 实现：直接 re-export from adapters/ppt-param-adapter
 * 使用相对路径，不重复复杂逻辑
 */

export * from './adapters/ppt-param-adapter';
