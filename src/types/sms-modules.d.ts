// Type declarations for optional SMS SDK dependencies
declare module 'tencentcloud-sdk-nodejs-sms' {
  export const sms: {
    v20210111: {
      Client: new (config: { credential: { secretId: string; secretKey: string }; region: string }) => {
        SendSms(params: Record<string, unknown>): Promise<{ SendStatusSet: Array<{ Code: string; Message?: string; SerialNo?: string }> }>;
      };
    };
  };
}

declare module '@alicloud/dysmsapi20170525' {
  export class Client {
    sendSms(request: SendSmsRequest): Promise<{ body: { code: string; message?: string; bizId?: string } }>;
  }
  export class SendSmsRequest {
    constructor(params: { phoneNumbers: string; signName: string; templateCode: string; templateParam: string });
  }
  export default Client;
}

declare module '@alicloud/openapi-client' {
  export class Config {
    constructor(params: { accessKeyId: string; accessKeySecret: string; endpoint?: string });
  }
}
