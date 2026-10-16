// Real Electron/IPC and disposable requirement sources; no personal data or real Agent call.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { crc32 } = require('node:zlib');
const { execFileSync } = require('node:child_process');
const { _electron, expect } = require('playwright/test');
const esbuild = require('esbuild');

function archive(entries) {
  const locals = [], central = []; let offset = 0;
  for (const [entry, content] of entries) {
    const name = Buffer.from(entry), body = Buffer.isBuffer(content) ? content : Buffer.from(content), checksum = crc32(body);
    const header = Buffer.alloc(30), record = Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20,4); header.writeUInt16LE(0x800,6); header.writeUInt32LE(checksum,14); header.writeUInt32LE(body.length,18); header.writeUInt32LE(body.length,22); header.writeUInt16LE(name.length,26);
    record.writeUInt32LE(0x02014b50); record.writeUInt16LE(20,4); record.writeUInt16LE(20,6); record.writeUInt16LE(0x800,8); record.writeUInt32LE(checksum,16); record.writeUInt32LE(body.length,20); record.writeUInt32LE(body.length,24); record.writeUInt16LE(name.length,28); record.writeUInt32LE(offset,42);
    locals.push(header,name,body); central.push(record,name); offset += header.length + name.length + body.length;
  }
  const records = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length,8); end.writeUInt16LE(entries.length,10); end.writeUInt32LE(records.length,12); end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,records,end]);
}

async function main() {
  const root = path.resolve(__dirname,'..'), fixture = fs.mkdtempSync(path.join(os.tmpdir(),'studio-requirement-ui-'));
  const data = path.join(fixture,'data'), repo = path.join(fixture,'repo'), executable = process.env.STUDIO_VERIFY_EXECUTABLE;
  const evidence = path.join(root,'test-results',executable ? 'requirement-import-packaged-ui' : 'requirement-import-ui');
  for (const directory of [data,repo,evidence,path.join(fixture,'tyflow/shared')]) fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(path.join(repo,'index.txt'),'fixture');
  const git = (...args) => execFileSync('git',args,{cwd:repo,windowsHide:true,encoding:'utf8'});
  git('init','--initial-branch=main'); git('config','user.name','Fixture'); git('config','user.email','fixture@example.invalid'); git('add','.'); git('commit','-m','fixture');
  fs.copyFileSync(path.join(root,'tests/fixtures/fake-codex.js'),path.join(fixture,'fake-codex.js'));
  fs.writeFileSync(path.join(fixture,'control.json'),'{}');
  fs.writeFileSync(path.join(fixture,'SKILL.md'),'Disposable fixture skill'); fs.writeFileSync(path.join(fixture,'tyflow/shared/WORKFLOW.md'),'Disposable assessment rules');
  const storeBundle = path.join(fixture,'store.cjs'); esbuild.buildSync({entryPoints:[path.join(root,'src/main/store.ts')],bundle:true,platform:'node',format:'cjs',outfile:storeBundle});
  const settings = require(storeBundle).initialSettings();
  settings.projects = [{id:'fixture',name:'Fixture',directory:repo,repository:'',auth:'system',username:'',startScript:'start',targetUrl:'http://localhost:8000',defaultBranchMode:'existing'}];
  settings.developer.defaultProject = 'fixture'; settings.agent = {command:path.join(fixture,'fake-codex.js'),tyflowDirectory:path.join(fixture,'tyflow'),testSkill:path.join(fixture,'SKILL.md')}; settings.notifications.enabled = false; settings.updates.checkOnLaunch = false;
  fs.writeFileSync(path.join(data,'state.json'),JSON.stringify({schemaVersion:1,settings,tasks:[]}));
  const zip = path.join(fixture,'需求资料.zip');
  fs.writeFileSync(zip,archive([['需求/产品.md','# Fixture requirement\n<script>window.unsafeExecuted = true</script>'],['需求/交互.txt','Fixed interaction rules'],['设计稿/详情.png',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNu0AAAAASUVORK5CYII=','base64')]]));
  const result = {passed:false,packaged:Boolean(executable),businessDataTouched:false}; let app;
  try {
    const env = {...process.env,STUDIO_UI_TEST:'1',STUDIO_TEST_DATA:data,CODEX_HOME:path.join(fixture,'codex-home')}; delete env.ELECTRON_RUN_AS_NODE; if(executable)env.STUDIO_SMOKE='1';
    app = await _electron.launch({executablePath:executable||path.join(root,'node_modules/electron/dist/electron.exe'),args:[...(executable?[]:[root]),'--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'],env,timeout:30000});
    const page = await app.firstWindow(); await page.getByRole('button',{name:'新建任务',exact:true}).waitFor();
    if(executable){await page.evaluate(async directory=>{const state=await window.studio.bootstrap(); await window.studio.saveSettings({...state.settings,projects:state.settings.projects.map(project=>({...project,directory}))});},repo);await page.reload();}
    await app.evaluate(({dialog},selected)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:selected});},[zip]);
    await page.getByRole('button',{name:'新建任务',exact:true}).click();
    await page.getByRole('button',{name:'选择需求资料',exact:true}).click();
    await expect(page.getByRole('combobox',{name:'执行方式',exact:true})).toHaveValue('standard');
    await expect(page.getByRole('checkbox',{name:/自动化测试介入/})).not.toBeChecked();
    await page.getByText('查看资料清单与预览',{exact:true}).click();
    await expect(page.getByRole('button',{name:'需求/产品.md',exact:true})).toBeVisible();
    const previewPromise = app.waitForEvent('window'); await page.getByRole('button',{name:'需求/产品.md',exact:true}).click();
    const preview = await previewPromise; await expect(preview.locator('pre')).toContainText('<script>window.unsafeExecuted = true</script>'); assert.equal(await preview.evaluate(()=>window.unsafeExecuted),undefined); await preview.close();
    await page.getByRole('button',{name:'保存草稿',exact:true}).click();
    await expect.poll(async()=> (await page.evaluate(()=>window.studio.bootstrap())).tasks.length).toBe(1);
    let task=(await page.evaluate(()=>window.studio.bootstrap())).tasks[0]; assert.equal(task.assets[0].documents.length,2); assert.equal(task.assets[0].images.length,1); assert.equal(task.description,'');
    await app.evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows()[0];window.restore();window.show();window.focus();});
    await page.screenshot({path:path.join(evidence,'imported-sources.png'),fullPage:true,timeout:10000});
    await page.getByRole('button',{name:'开始评估',exact:true}).click();
    await expect.poll(async()=> {const task=(await page.evaluate(()=>window.studio.bootstrap())).tasks[0]; if(task.status==='failed')throw Error(JSON.stringify({error:task.error,logs:task.logs.slice(-8)})); return task.status;},{timeout:30000}).toBe('ready');
    const call=fs.readFileSync(path.join(fixture,'calls.jsonl'),'utf8').trim().split('\n').map(JSON.parse).find(call=>call.stage==='analysis');
    for(const name of ['产品.md','交互.txt','详情.png'])assert.ok(call.prompt.includes(name));
    await page.getByRole('button',{name:'新建任务',exact:true}).click(); await page.getByRole('tab',{name:'OpenDesign 设计',exact:true}).click();
    await page.getByRole('button',{name:'选择设计文件',exact:true}).click();
    await expect(page.getByRole('tab',{name:'文字需求',exact:true})).toHaveAttribute('aria-selected','true');
    await expect(page.getByRole('combobox',{name:'执行方式',exact:true})).toHaveValue('standard');
    await expect(page.getByRole('button',{name:'开始评估',exact:true})).toBeEnabled();
    await page.getByRole('button',{name:'移除资料：需求资料.zip',exact:true}).click();
    await expect(page.getByRole('button',{name:'开始评估',exact:true})).toBeDisabled();
    Object.assign(result,{passed:true,documentAndImageZip:true,sourceInventoryPreserved:true,markdownPreviewEscaped:true,documentOnlyDraftSaved:true,assessmentReceivedAllSources:true,mistakenDesignUploadRoutedToText:true,removalInvalidatesReadiness:true,automationChoicePreserved:true});
  } catch(error){result.error=error.message;fs.writeFileSync(path.join(evidence,`failure-${Date.now()}.json`),JSON.stringify(result,null,2));throw error;}
  finally {await app?.close().catch(()=>{});fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(result,null,2)); await fs.promises.rm(fixture,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
  console.log('Requirement documents/design images UI passed');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
