export function themeColor(hex: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#1264cc";
  let rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const luminance = () =>
    rgb
      .map((v) => v / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  while (1.05 / (luminance() + 0.05) < 4.5)
    rgb = rgb.map((v) => Math.floor(v * 0.96));
  return `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
export function applyTheme(hex: string) {
  const safe = themeColor(hex);
  document.documentElement.style.setProperty("--primary", safe);
  document.documentElement.style.setProperty("--soft", `${safe}0c`);
  document.documentElement.style.setProperty("--tint", `${safe}18`);
}
