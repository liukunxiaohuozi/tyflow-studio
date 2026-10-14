/** Never allow credentials to turn this notifier into an arbitrary HTTP client. */
export function validateWeComWebhook(value: string): string {
  try {
    const url = new URL(value);
    const keys = [...url.searchParams.keys()];
    if (
      value !== value.trim() ||
      /[\u0000-\u0020]/.test(value) ||
      url.protocol !== "https:" ||
      url.hostname !== "qyapi.weixin.qq.com" ||
      url.port ||
      url.username ||
      url.password ||
      url.hash ||
      url.pathname !== "/cgi-bin/webhook/send" ||
      keys.length !== 1 ||
      keys[0] !== "key" ||
      !/^[a-zA-Z0-9_-]{1,200}$/.test(url.searchParams.get("key") ?? "")
    )
      throw new Error();
    return url.href;
  } catch {
    throw new Error(
      "请填写有效的企业微信群机器人 HTTPS Webhook，地址须为 qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…",
    );
  }
}
