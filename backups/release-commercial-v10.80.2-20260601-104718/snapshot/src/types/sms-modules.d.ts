// Type declarations for optional SMS SDK dependencies

// 腾讯云短信 SDK
declare module 'tencentcloud-sdk-nodejs-sms' {
  export const sms: {
    v20210111: {
      Client: new (config: { credential: { secretId: string; secretKey: string }; region: string }) => {
        SendSms(params: Record<string, unknown>): Promise<{ SendStatusSet: Array<{ Code: string; Message?: string; SerialNo?: string }> }>;
      };
    };
  };
}

// 阿里云短信认证 SDK（dypnsapi - 号码认证服务）
declare module '@alicloud/dypnsapi20170525' {
  export class Client {
    sendSmsVerifyCode(request: SendSmsVerifyCodeRequest): Promise<{ body: { Code: string; Message?: string; RequestId?: string; VerifyCode?: string } }>;
    checkSmsVerifyCode(request: CheckSmsVerifyCodeRequest): Promise<{ body: { Code: string; Message?: string; RequestId?: string; Result?: boolean } }>;
  }
  export class SendSmsVerifyCodeRequest {
    constructor(params: { phoneNumber: string; code?: string; verifyCodeLength?: number; expireTime?: number; signName?: string; templateCode?: string });
  }
  export class CheckSmsVerifyCodeRequest {
    constructor(params: { phoneNumber: string; verifyCode: string });
  }
  export default Client;
}

// 阿里云传统短信 SDK（备用）
declare module '@alicloud/dysmsapi20170525' {
  export class Client {
    sendSms(request: SendSmsRequest): Promise<{ body: { code: string; message?: string; bizId?: string } }>;
  }
  export class SendSmsRequest {
    constructor(params: { phoneNumbers: string; signName: string; templateCode: string; templateParam: string });
  }
  export default Client;
}

// 阿里云 OpenAPI Client
declare module '@alicloud/openapi-client' {
  export class Config {
    constructor(params: { accessKeyId: string; accessKeySecret: string; endpoint?: string });
  }
}
