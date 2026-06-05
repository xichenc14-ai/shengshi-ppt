export const GAMMA_PRIMARY_EXPORT_FORMAT = 'pptx' as const;

export function getGammaAdditionalExportUnsupportedMessage(format: 'pdf' | 'pptx'): string {
  return `Gamma 公共 API 当前不支持对已生成文稿再次导出 ${format.toUpperCase()}。请在创建任务时直接使用 exportAs=${format}，或前往 Gamma 原稿手动导出。`;
}
