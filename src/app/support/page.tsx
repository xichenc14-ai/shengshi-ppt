export default function SupportPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">售后与支持</h1>
      <p className="text-sm text-gray-500 mb-8">更新日期：2026-07-14</p>
      <div className="space-y-6 text-sm leading-7 text-gray-700">
        <section>
          <h2 className="mb-2 text-base font-semibold text-gray-900">联系我们</h2>
          <p>支持邮箱：602473182@qq.com。建议在邮件中提供订单号、问题发生时间、页面提示和请求 ID；请求 ID 可在错误响应或客服排查信息中找到。</p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-semibold text-gray-900">订单与退款</h2>
          <p>重复扣款、付款未到账、权益未开通或服务无法交付时，可提交售后核验。平台会结合订单记录、支付渠道状态、权益使用情况和适用规则处理；审核通过后由原支付渠道退回。</p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-semibold text-gray-900">生成失败</h2>
          <p>请先保留页面请求 ID 并重试一次。若仍失败，请提交请求 ID、发生时间和主题概要。不要发送附件原文、密码、验证码或支付密钥。</p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-semibold text-gray-900">侵权投诉</h2>
          <p>请说明权利基础、相关页面或生成内容、联系人及可验证材料。平台核验后会根据适用规则采取限制、删除相关记录或其他必要措施。</p>
        </section>
      </div>
    </main>
  );
}
