const ts = require("typescript");
const fs = require("node:fs");
const path = require("node:path");
const zh = {},
  en = {};
let count = 0;
function scan(dir) {
  for (const file of fs.readdirSync(dir)) {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) {
      scan(p);
      continue;
    }
    if (!/\.tsx?$/.test(p)) continue;
    const source = ts.createSourceFile(
      p,
      fs.readFileSync(p, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      p.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    function visit(node) {
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(source) === "I18nT"
      ) {
        const [a, b] = node.arguments;
        if (!a || !b || !ts.isStringLiteral(a) || !ts.isStringLiteral(b))
          throw new Error(
            "I18nT requires literal Chinese and English translations: " + p,
          );
        if (/[\u4e00-\u9fff]/.test(b.text))
          throw new Error("Untranslated English: " + b.text);
        zh[a.text] = a.text;
        en[a.text] = b.text;
        count++;
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
scan("src/renderer");
fs.mkdirSync("src/locales", { recursive: true });
for (const [locale, data] of [
  ["zh-CN", zh],
  ["en-US", en],
])
  fs.writeFileSync(
    path.join("src/locales", locale + ".json"),
    JSON.stringify(Object.fromEntries(Object.entries(data).sort()), null, 2) +
      "\n",
  );
console.log(
  `Scanned ${count} I18nT calls; ${Object.keys(zh).length} translated keys. zh-CN/en-US written; untranslated English: 0.`,
);
