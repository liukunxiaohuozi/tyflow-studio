const { app, BrowserWindow } = require('electron');
const path = require('path');

const output = path.resolve(process.argv[2] || 'artifacts/TingYun-Studio-闭环演示.webm');
const language = process.argv[3] || 'zh';
const voiceSet = process.argv[4] || 'narration-neural';
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  win.webContents.on('console-message', (_event, _level, message) => {
    console.log(message);
    if (message.startsWith('VIDEO_DONE')) app.quit();
  });
  await win.loadFile(path.resolve(__dirname, 'demo-video-v2.html'), {
    query: { out: output, lang: language, voiceSet },
  });
});
setTimeout(() => { console.error('Video render timed out'); app.exit(2); }, 420000);
