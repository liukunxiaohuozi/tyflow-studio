const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const outDir = path.resolve('artifacts/demo-frames');
fs.mkdirSync(outDir, { recursive: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function clickText(win, label) {
  const ok = await win.webContents.executeJavaScript(`(() => {
    const nodes = [...document.querySelectorAll('button')];
    const target = nodes.find((node) => node.innerText.trim() === ${JSON.stringify(label)})
      || nodes.find((node) => node.innerText.includes(${JSON.stringify(label)}));
    if (!target) return false;
    target.click();
    return true;
  })()`);
  if (!ok) throw new Error(`Button not found: ${label}`);
  await wait(500);
}

async function shot(win, name) {
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(outDir, name), image.toPNG());
  console.log(`Captured ${name}`);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 720, show: false });
  await win.loadURL('http://127.0.0.1:5178/');
  await wait(3000);
  await clickText(win, '开发配置');
  await wait(1800);
  await shot(win, '01-project-config.png');
  await win.webContents.executeJavaScript('window.scrollTo({ top: 520, behavior: "instant" })');
  await wait(300);
  await shot(win, '01b-project-config-detail.png');
  await win.webContents.executeJavaScript('window.scrollTo({ top: 0, behavior: "instant" })');
  await clickText(win, '演示示例');
  await shot(win, '02-demo-intake.png');
  await clickText(win, '开始评估');
  await wait(1800);
  await shot(win, '03-plan-ready.png');
  await clickText(win, '确认并开始开发');
  await wait(6800);
  await shot(win, '04-review-modal.png');
  try { await clickText(win, '返回演示流程'); } catch {}
  await shot(win, '05-run-review.png');
  try { await clickText(win, '验收并提交代码'); } catch {}
  await wait(500);
  await shot(win, '06-accepted.png');
  app.quit();
});

setTimeout(() => { console.error('Capture timed out'); app.exit(2); }, 25000);
