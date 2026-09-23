import { themeColor } from "../src/renderer/theme";
function contrast(hex: string) {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return (
    1.05 /
    (rgb.reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0) + 0.05)
  );
}
test.each([
  "#1677ff",
  "#5B4BDB",
  "#008A70",
  "#D66B16",
  "#E7326C",
  "#FFFFFF",
  "#FFFF00",
  "#000000",
])("primary %s always supports white text", (color) => {
  expect(contrast(themeColor(color))).toBeGreaterThanOrEqual(4.5);
});
test("invalid CSS input cannot enter theme color", () =>
  expect(themeColor("url(evil)")).toBe("#1264cc"));
