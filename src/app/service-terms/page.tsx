const sections = [
  ['服务方式', '省心PPT提供在线AI大纲、排版和文件下载服务。下载加速、生成记录和产物交付能力以当前产品页面为准；历史入口或临时下载链接不构成长期保管承诺，用户应在生成完成后及时下载并自行备份。'],
  ['会员与积分', '套餐价格、有效期、积分额度、支持页数与功能范围以购买页面和订单确认内容为准。当前会员按约定期限开通，不默认进行未经用户确认的自动续费扣款。'],
  ['服务交付', '任务提交成功不等同于最终文件已经生成。平台会展示处理状态；若生成失败，将根据实际情况执行积分返还、重新生成、人工核验或售后处理。'],
  ['支付与售后', '支付成功后权益通常自动到账。出现重复扣款、已付款未到账、无法交付或其他订单异常时，请通过售后页面提交订单号和问题说明。退款与处理结果以订单核验、支付渠道状态及适用规则为准。'],
  ['维护与变更', '平台可为安全、合规、供应商变化或产品升级进行维护与调整。涉及价格、核心权益或重要条款的重大变化，会通过页面公告或其他合理方式提示。'],
  ['支持渠道', '服务咨询、订单异常和侵权投诉可发送至 602473182@qq.com。请勿通过邮件发送密码、短信验证码、支付密钥或完整敏感资料。'],
];

export default function ServiceTermsPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">服务条款</h1>
      <p className="text-sm text-gray-500 mb-8">更新日期：2026-07-14</p>
      <div className="space-y-7 text-sm leading-7 text-gray-700">
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
