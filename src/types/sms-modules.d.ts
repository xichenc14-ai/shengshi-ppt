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
