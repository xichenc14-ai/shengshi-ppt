const sections = [
  ['账号使用', '用户应提供真实、可用的账号信息并妥善保管登录凭证。不得出借账号实施攻击、批量注册、绕过额度、盗用支付信息或其他损害平台及第三方权益的行为。'],
  ['合法使用', '不得提交或生成违法违规、侵权、欺诈、恶意代码、隐私窃取或其他不当内容。用户应确认对上传资料拥有处理权限，并在发布、演示或商用前自行审核事实、版权与合规性。'],
  ['AI生成内容', 'AI生成内容可能存在错误、遗漏或不适用情形，不构成法律、医疗、投资等专业意见。用户应结合原始资料和实际场景复核，不得将自动生成结果作为无需审核的最终依据。'],
  ['服务限制', '服务按页面公示的套餐、积分、页数与功能规则提供。因模型、排版服务、网络或维护导致的短暂波动，平台会采取重试、降级、补偿或退款处理，但不承诺服务永不中断。'],
  ['知识产权', '用户保留其合法上传资料的权利。平台自身程序、界面、品牌与文档受法律保护。生成结果中涉及第三方素材、商标或人物的，用户仍需自行确认授权范围。'],
  ['违规处理', '对违反协议、危害安全或损害他人权益的账号，平台可采取限制请求、暂停服务、停止账号或配合主管机关调查等措施。'],
];

export default function TermsPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">用户协议</h1>
      <p className="text-sm text-gray-500 mb-8">更新日期：2026-07-14</p>
      <div className="space-y-7 text-sm leading-7 text-gray-700">
        <p>注册、登录或使用省心PPT即表示您已阅读并同意本协议及相关公示规则。</p>
        {sections.map(([title, content]) => (
          <section key={title}>
            <h2 className="mb-2 text-base font-semibold text-gray-900">{title}</h2>
            <p>{content}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
