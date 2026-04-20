/**
 * 省心PPT 版本管理模块
 * 所有版本相关配置统一在此维护
 */

// 🚨 当前版本号（每次发版必须更新）
export const VERSION = 'v10.0.1';
export const VERSION_DATE = '2026-04-21';
export const VERSION_NOTES = 'SMS降级机制·调试接口安全·公告栏重构·版本管理规范化';

// 版本历史（用于公告栏，按时间倒序）
export const VERSION_HISTORY: { version: string; date: string; notes: string; severity: 'major' | 'minor' | 'patch' }[] = [
  {
    version: 'v10.0.1',
    date: '2026-04-21',
    notes: 'SMS降级机制·调试接口安全·公告栏重构·版本管理规范化',
    severity: 'minor',
  },
  {
    version: 'v10.0.0',
    date: '2026-04-21',
    notes: '代码审查修复 · SSRF漏洞/调试接口/验证码明文/积分无认证/Key池等6大安全隐患根治',
    severity: 'major',
  },
  {
    version: 'v9.5.1',
    date: '2026-04-17',
    notes: '架构师审查修复 · Word解析/大纲生成/预览弹窗三大隐患根治',
    severity: 'patch',
  },
];

// 🚨 最新公告（商用上线后从此读取，也可以存 Supabase）
export const ANNOUNCEMENT: { title: string; content: string; link?: string; linkText?: string } | null = null;
// 示例公告：
// export const ANNOUNCEMENT = {
//   title: '🔥 v10.0.0 安全更新公告',
//   content: '本次更新修复了6个安全隐患，建议所有用户更新。',
//   link: '/account',
//   linkText: '查看详情',
// };