let language = "zh-CN";
export function setLanguage(value: string) {
  language = value;
  document.documentElement.lang = value;
}
export function I18nT(zh: string, en: string): string {
  return language === "en-US" ? en : zh;
}
