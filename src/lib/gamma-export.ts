export const GAMMA_PRIMARY_EXPORT_FORMAT = 'pptx' as const;

export function getGammaAdditionalExportUnsupportedMessage(format: 'pdf' | 'pptx'): string {
  return `当前公共导出接口不支持对已生成文稿再次导出 ${format.toUpperCase()}。请在创建任务时直接使用 exportAs=${format}。`;
}
