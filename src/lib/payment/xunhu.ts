import { createHash, randomBytes } from 'crypto';

export type XunhuPayloadValue = string | number | boolean | null | undefined;
export type XunhuPayload = Record<string, XunhuPayloadValue>;

export interface XunhuConfig {
  appid: string;
  secret: string;
  gateway: string;
}

export interface XunhuCreateOrderInput {
  orderNo: string;
  amountFen: number;
  title: string;
  notifyUrl: string;
  returnUrl?: string;
  callbackUrl?: string;
  attach?: string;
}

export interface XunhuCreateOrderResult {
  openOrderId: string;
  payUrl?: string;
  qrCodeUrl?: string;
  raw: Record<string, unknown>;
}

export interface XunhuQueryOrderResult {
  status?: string;
  totalFee?: string;
  transactionId?: string;
  paidDate?: string;
  openOrderId?: string;
  raw: Record<string, unknown>;
}

export interface XunhuNotifyPayload {
  trade_order_id?: string;
  total_fee?: string;
  transaction_id?: string;
  open_order_id?: string;
  order_title?: string;
  status?: string;
  attach?: string;
  appid?: string;
  time?: string;
  nonce_str?: string;
  hash?: string;
  [key: string]: string | undefined;
}

export function getXunhuConfig(): XunhuConfig | null {
  const appid = process.env.XUNHU_PAY_APPID || '';
  const secret = process.env.XUNHU_PAY_SECRET || '';
  const gateway = process.env.XUNHU_PAY_GATEWAY || 'https://api.xunhupay.com';
  if (!appid || !secret) return null;
  return { appid, secret, gateway };
}

export function getXunhuEndpoint(gateway: string, action: 'do' | 'query' | 'refund' = 'do'): string {
  const trimmed = gateway.replace(/\/+$/, '');
  if (/\/payment\/(do|query|refund)\.html$/i.test(trimmed)) {
    return trimmed.replace(/\/payment\/(do|query|refund)\.html$/i, `/payment/${action}.html`);
  }
  return `${trimmed}/payment/${action}.html`;
}

export function createXunhuHash(payload: XunhuPayload, secret: string): string {
  const source = Object.keys(payload)
    .filter((key) => key !== 'hash')
    .filter((key) => payload[key] !== null && payload[key] !== undefined && payload[key] !== '')
    .sort()
    .map((key) => `${key}=${String(payload[key])}`)
    .join('&');

  return createHash('md5').update(source + secret, 'utf8').digest('hex');
}

export function verifyXunhuHash(payload: XunhuPayload, secret: string): boolean {
  const received = typeof payload.hash === 'string' ? payload.hash.toLowerCase() : '';
  if (!received) return false;
  return createXunhuHash(payload, secret) === received;
}

function toYuan(amountFen: number): string {
  return (amountFen / 100).toFixed(2);
}

function sanitizeTitle(title: string): string {
  return title
    .replace(/%/g, '')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .slice(0, 120);
}

function createNonce(): string {
  return randomBytes(16).toString('hex');
}

export function buildXunhuCreateOrderPayload(config: XunhuConfig, input: XunhuCreateOrderInput): XunhuPayload {
  const payload: XunhuPayload = {
    version: '1.1',
    appid: config.appid,
    trade_order_id: input.orderNo,
    total_fee: toYuan(input.amountFen),
    title: sanitizeTitle(input.title),
    time: Math.floor(Date.now() / 1000),
    notify_url: input.notifyUrl,
    return_url: input.returnUrl || process.env.PAYMENT_RETURN_URL || '',
    callback_url: input.callbackUrl || process.env.PAYMENT_CALLBACK_URL || '',
    plugins: process.env.XUNHU_PAY_PLUGINS || 'xinppt-next',
    attach: input.attach || '',
    nonce_str: createNonce(),
  };
  return { ...payload, hash: createXunhuHash(payload, config.secret) };
}

export async function createXunhuOrder(input: XunhuCreateOrderInput): Promise<XunhuCreateOrderResult> {
  const config = getXunhuConfig();
  if (!config) {
    throw new Error('虎皮椒支付未配置 XUNHU_PAY_APPID/XUNHU_PAY_SECRET');
  }

  const payload = buildXunhuCreateOrderPayload(config, input);
  const response = await fetch(getXunhuEndpoint(config.gateway, 'do'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const raw = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !raw) {
    throw new Error(`虎皮椒下单失败: HTTP ${response.status}`);
  }

  if (typeof raw.hash === 'string' && !verifyXunhuHash(raw as XunhuPayload, config.secret)) {
    throw new Error('虎皮椒下单响应验签失败');
  }

  const errcode = Number(raw.errcode);
  if (errcode !== 0) {
    throw new Error(String(raw.errmsg || '虎皮椒下单失败'));
  }

  return {
    openOrderId: String(raw.openid || raw.open_order_id || input.orderNo),
    payUrl: typeof raw.url === 'string' ? raw.url : undefined,
    qrCodeUrl: typeof raw.url_qrcode === 'string' ? raw.url_qrcode : undefined,
    raw,
  };
}

export async function queryXunhuOrder(orderNo: string): Promise<XunhuQueryOrderResult> {
  const config = getXunhuConfig();
  if (!config) {
    throw new Error('虎皮椒支付未配置 XUNHU_PAY_APPID/XUNHU_PAY_SECRET');
  }

  const payload: XunhuPayload = {
    appid: config.appid,
    out_trade_order: orderNo,
    time: Math.floor(Date.now() / 1000),
    nonce_str: createNonce(),
  };
  const signedPayload = { ...payload, hash: createXunhuHash(payload, config.secret) };

  const response = await fetch(getXunhuEndpoint(config.gateway, 'query'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signedPayload),
  });

  const raw = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !raw) {
    throw new Error(`虎皮椒查单失败: HTTP ${response.status}`);
  }

  if (typeof raw.hash === 'string' && !verifyXunhuHash(raw as XunhuPayload, config.secret)) {
    throw new Error('虎皮椒查单响应验签失败');
  }

  const errcode = Number(raw.errcode);
  if (errcode !== 0) {
    throw new Error(String(raw.errmsg || '虎皮椒查单失败'));
  }

  const data = raw.data && typeof raw.data === 'object' ? raw.data as Record<string, unknown> : raw;

  return {
    status: typeof data.status === 'string' ? data.status : undefined,
    totalFee: typeof data.total_fee === 'string' || typeof data.total_fee === 'number'
      ? String(data.total_fee)
      : (typeof data.total_amount === 'string' || typeof data.total_amount === 'number' ? String(data.total_amount) : undefined),
    transactionId: typeof data.transaction_id === 'string' ? data.transaction_id : undefined,
    paidDate: typeof data.paid_date === 'string' ? data.paid_date : undefined,
    openOrderId: typeof data.open_order_id === 'string' ? data.open_order_id : undefined,
    raw,
  };
}

export function isXunhuPaidResult(input: { status?: string; transactionId?: string; paidDate?: string }): boolean {
  return input.status === 'OD' || Boolean(input.transactionId && input.paidDate);
}

export function isXunhuPaidPayload(input: { status?: string; transaction_id?: string; paid_date?: string }): boolean {
  return input.status === 'OD' || Boolean(input.transaction_id && input.paid_date);
}

export function xunhuStatusToOrderStatus(status?: string): 'completed' | 'pending' | 'refunded' | 'refund_pending' | 'refund_failed' | 'failed' {
  if (status === 'OD') return 'completed';
  if (status === 'WP') return 'pending';
  if (status === 'CD') return 'failed';
  if (status === 'RD') return 'refund_pending';
  if (status === 'UD') return 'refund_failed';
  return 'failed';
}
