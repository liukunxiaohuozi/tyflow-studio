// Real browser + authenticated MCP, disposable local fixture only. No user pages or credentials.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const assert = require("node:assert/strict");
const {randomUUID} = require("node:crypto");
const esbuild = require("esbuild");
const {execFileSync}=require("node:child_process");

async function main() {
  const root=path.resolve(__dirname,"..");
  const output=path.join(root,".codex_tmp/browser-flow");
  const evidence=path.join(root,"test-results/browser-flow-real");
  fs.mkdirSync(output,{recursive:true});fs.mkdirSync(evidence,{recursive:true});
  esbuild.buildSync({entryPoints:[path.join(root,"src/main/providers/browser.ts")],bundle:true,platform:"node",format:"cjs",external:["playwright-core"],outfile:path.join(output,"browser.cjs")});
  const {PlaywrightBrowserProvider}=require(path.join(output,"browser.cjs"));
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"studio-browser-real-"));
  execFileSync("git",["init","--initial-branch=main"],{cwd:temporary,windowsHide:true,stdio:"ignore"});
  fs.writeFileSync(path.join(temporary,"fixture.txt"),"Disposable browser handshake fixture");
  let saves=0;
  const html=`<!DOCTYPE html><meta charset="utf-8"><title>Studio browser fixture</title><style>body{font:16px sans-serif;padding:24px}label,button{display:block;margin:12px 0}</style><section id="login"><label>Fixture password<input type="password"></label><button id="signin">Sign in</button></section><section id="app" hidden><h1>Fixture settings</h1><label>Setting value<input id="setting"></label><button id="save">Save</button><p role="status" id="result">Not saved</p><button>Delete application</button></section><script>signin.onclick=()=>{document.cookie='fixture_session=fixture-cookie-not-for-agent; path=/';login.remove();app.hidden=false;history.pushState({},'', '/deep/settings')};save.onclick=async()=>{const response=await fetch('/api/save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({appId:'123',value:setting.value})});const body=await response.json();result.textContent=body.success?'Fixture saved: '+body.value:'Failure'};</script>`;
  const server=http.createServer(async(req,res)=>{
    if(req.url==="/"){res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});res.end(html);return;}
    if(req.url==="/api/save"&&req.method==="POST"){let b="";for await(const chunk of req)b+=chunk;saves++;res.writeHead(200,{"Content-Type":"application/json"});res.end(JSON.stringify({success:true,value:JSON.parse(b).value}));return;}
    res.writeHead(404,{"Content-Type":"text/html"});res.end("<title>Error</title>Cannot GET /deep/settings");
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const url=`http://127.0.0.1:${server.address().port}/deep/settings`;
  const plan={summary:"Local fixture",requirements:[{id:"R1",text:"Fixture save",priority:"P1",source:"manual"}],planSteps:[{id:"P1",title:"Fixture",covers:["R1"],expectedFiles:["fixture.txt"]}],steps:["Fixture"],risks:[],blockers:[],testCases:[{id:"T1",title:"Chrome page save",priority:"P1",covers:["R1"],verifies:["P1"],steps:["Save fixture data"],expected:"Fixture saved: controlled"}]};
  const task={id:randomUUID(),projectId:"fixture",title:"Fixture",status:"waiting-test",checks:[],logs:[],assets:[],snapshot:{project:{id:"fixture",name:"Fixture",directory:temporary},plan,baseCommit:"0".repeat(40)}};
  const manager=new PlaywrightBrowserProvider(()=>({agent:{command:process.execPath},projects:[]}),true);
  const confirmation={browser:"chrome",nonProduction:true,sourceConfirmed:true,allowWrites:false,scope:"Only local fixture application 123; in-memory data discarded when the fixture closes",allowedOrigins:[]};
  let lease;
  const results={passed:false,mode:"real Chrome with disposable HTTP fixture and production MCP server",businessTaskTouched:false};
  try {
    const initial=await manager.action(task,"open",{browser:"chrome",url,nonProduction:true},"fixture-source-v1");
    assert.equal(initial.browsers[0].httpStatus,404);
    await assert.rejects(()=>manager.action(task,"confirm",confirmation,"fixture-source-v1"),/错误页/);
    await assert.rejects(()=>manager.ready(task,"fixture-source-v1"),/尚未准备好/);
    await manager.action(task,"home",{browser:"chrome"},"fixture-source-v1");
    await assert.rejects(()=>manager.action(task,"confirm",confirmation,"fixture-source-v1"),/密码登录/);
    // Simulate only a human's login in our own public fixture, not an actual user account.
    const page=manager.sessions.get(task.id).entries.get("chrome").handle.page;
    await page.getByLabel("Fixture password").fill("public-fixture-value");
    await page.getByRole("button",{name:"Sign in",exact:true}).click();
    const ready=await manager.action(task,"confirm",confirmation,"fixture-source-v1");
    assert.equal(ready.ready,true);
    await assert.rejects(()=>manager.ready(task,"changed-source"),/代码已变化/);
    const controller=new AbortController();
    lease=await manager.lease(task,"fixture-source-v1",controller.signal);
    const endpoint=JSON.parse(lease.args.find(a=>a.startsWith("mcp_servers.studio_browser.url=")).split("=").slice(1).join("="));
    let id=0;
    const rpc=async(method,params={})=>{const response=await fetch(endpoint,{method:"POST",headers:{Authorization:`Bearer ${lease.env.STUDIO_BROWSER_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:++id,method,params})});return {status:response.status,body:await response.json()};};
    const tool=async(name,args={})=>{const value=await rpc("tools/call",{name,arguments:args});assert.equal(value.status,200);const result=value.body.result;if(result.isError)throw new Error(result.content[0].text);return JSON.parse(result.content[0].text);};
    assert.equal((await rpc("initialize",{protocolVersion:"2025-03-26"})).body.result.protocolVersion,"2025-03-26");
    const snapshot=await tool("browser_snapshot");
    assert(JSON.stringify(snapshot).includes("Fixture settings"));
    assert(!JSON.stringify(snapshot).includes("fixture-cookie-not-for-agent"));
    const denied=await rpc("tools/call",{name:"browser_fill",arguments:{role:"textbox",name:"Setting value",text:"controlled"}});
    assert.equal(denied.body.result.isError,true);assert.equal(saves,0);
    lease.release();
    assert.equal((await rpc("tools/list")).status,403);
    await manager.action(task,"confirm",{...confirmation,allowWrites:true},"fixture-source-v1");
    lease=await manager.lease(task,"fixture-source-v1",controller.signal);
    await tool("browser_fill",{role:"textbox",name:"Setting value",text:"controlled"});
    await tool("browser_click",{role:"button",name:"Save"});
    const assertion=await tool("browser_assert",{caseId:"T1",selector:"#result",assertion:"text",expected:"Fixture saved: controlled"});
    assert.equal(assertion.passed,true);assert.equal(saves,1);
    const request=await tool("browser_assert_request",{caseId:"T1",path:"/api/save",method:"POST",status:200,body:{appId:"123",value:"controlled"}});
    assert.equal(request.passed,true);
    if(process.env.STUDIO_VERIFY_REAL_CODEX==="1"){
      esbuild.buildSync({stdin:{contents:'export {CodexAgentProvider} from "./src/main/providers/agent"; export {EvidenceStore} from "./src/main/evidence";',resolveDir:root,loader:"ts"},bundle:true,platform:"node",format:"cjs",outfile:path.join(output,"agent.cjs")});
      const {CodexAgentProvider,EvidenceStore}=require(path.join(output,"agent.cjs"));
      const lines=[];
      const agent=new CodexAgentProvider(()=>({agent:{command:"codex"},execution:{agentTimeoutMs:120000,agentIdleTimeoutMs:60000}}),new EvidenceStore(path.join(temporary,"studio-evidence"),v=>v),v=>v);
      const started=Date.now();
      const response=await agent.invoke({taskId:task.id,directory:temporary,projectName:"Disposable browser handshake fixture",stage:"test",prompt:"Use the supplied studio_browser MCP browser_snapshot tool exactly once for Chrome. Confirm the snapshot contains Fixture settings. Do not edit files, run shell commands, access credentials, click controls, or navigate. Return observed true only after the actual tool succeeds. This is a connectivity test, not a business acceptance."+lease.prompt,schema:{type:"object",properties:{observed:{type:"boolean"}},required:["observed"],additionalProperties:false},signal:new AbortController().signal,tools:lease,log:(line)=>lines.push(line),activity:()=>{}});
      const called=lines.some(line=>line.includes('"mcp_tool_call"')&&line.includes("studio_browser")&&line.includes("browser_snapshot"));
      assert.equal(response.observed,true);assert.equal(called,true);
      fs.writeFileSync(path.join(evidence,"real-codex-result.json"),JSON.stringify({passed:true,actualMcpToolCalled:called,elapsedMs:Date.now()-started,businessTaskTouched:false,mode:"production Codex provider and real CLI against disposable browser fixture"},null,2));
      results.realCodexVerified=true;
    }
    const check={name:"T1",state:"passed",detail:"fixture",evidence:[{kind:"dom",summary:"actual assertion",...assertion.evidence},{kind:"log",summary:"actual request assertion",...request.evidence}]};
    manager.validateCheck(task,check);
    const approvedExpected=plan.testCases[0].expected;
    plan.testCases[0].expected="A different approved revision";
    assert.throws(()=>manager.validateCheck(task,check),/真实通过断言/);
    plan.testCases[0].expected=approvedExpected;
    const bytes=fs.readFileSync(path.join(temporary,assertion.evidence.path));
    fs.writeFileSync(path.join(temporary,assertion.evidence.path),"tampered");
    assert.throws(()=>manager.validateCheck(task,check),/真实通过断言/);
    fs.writeFileSync(path.join(temporary,assertion.evidence.path),bytes);
    manager.validateCheck(task,check);
    const deletion=await rpc("tools/call",{name:"browser_click",arguments:{role:"button",name:"Delete application"}});
    assert.equal(deletion.body.result.isError,true);
    const outside=await rpc("tools/call",{name:"browser_navigate",arguments:{url:"http://production.invalid"}});
    assert.equal(outside.body.result.isError,true);
    const screen=await tool("browser_screenshot");
    fs.copyFileSync(path.join(temporary,screen.path),path.join(evidence,"saved-fixture.png"));
    const failed=await tool("browser_assert",{caseId:"T1",selector:"#result",assertion:"text",expected:"incorrect oracle"});
    assert.equal(failed.passed,false);
    assert.throws(()=>manager.validateCheck(task,check),/真实浏览器断言失败/);
    controller.abort();
    assert.equal((await rpc("tools/list")).status,403);
    Object.assign(results,{deepLink404RecoveredThroughHome:true,manualLoginBeforeTools:true,sourceDriftBlocked:true,writeConsentRequired:true,realSaveAndRequestVerified:true,assertionEvidenceBound:true,tamperedEvidenceRejected:true,failedAssertionCannotBeOverridden:true,outsideOriginAndDeletionDenied:true,pauseRevokesTools:true,cookiesNotExposed:true,browserVersion:ready.browsers[0].version});
    if(process.env.STUDIO_VERIFY_FIREFOX==="1"){
      const opened=await manager.action(task,"open",{browser:"firefox",url,nonProduction:true},"fixture-source-v1");
      assert.equal(opened.browsers[1].phase,"login");
      await manager.action(task,"home",{browser:"firefox"},"fixture-source-v1");
      const firefox=manager.sessions.get(task.id).entries.get("firefox").handle.page;
      await firefox.getByLabel("Fixture password").fill("public-fixture-value");
      await firefox.getByRole("button",{name:"Sign in",exact:true}).click();
      await manager.action(task,"confirm",{...confirmation,browser:"firefox",allowWrites:true},"fixture-source-v1");
      plan.testCases[0].title="Chrome and Firefox page save";
      lease=await manager.lease(task,"fixture-source-v1",new AbortController().signal);
      const chromeProof=await tool("browser_assert",{browser:"chrome",caseId:"T1",selector:"#result",assertion:"text",expected:"Fixture saved: controlled"});
      const matrixCheck={...check,evidence:[{kind:"dom",summary:"Chrome assertion in approved browser matrix",...chromeProof.evidence}]};
      assert.throws(()=>manager.validateCheck(task,matrixCheck),/firefox/);
      await tool("browser_fill",{browser:"firefox",role:"textbox",name:"Setting value",text:"controlled"});
      await tool("browser_click",{browser:"firefox",role:"button",name:"Save"});
      const firefoxProof=await tool("browser_assert",{browser:"firefox",caseId:"T1",selector:"#result",assertion:"text",expected:"Fixture saved: controlled"});
      assert.equal(firefoxProof.passed,true);
      matrixCheck.evidence.push({kind:"dom",summary:"Firefox assertion in approved browser matrix",...firefoxProof.evidence});
      manager.validateCheck(task,matrixCheck);
      results.firefoxVerified=true;
      results.chromeCannotSubstituteFirefox=true;
    } else results.firefoxVerified=false;
    results.passed=true;
  } catch(error){results.passed=false;results.error=error.message;fs.writeFileSync(path.join(evidence,`failure-${Date.now()}.json`),JSON.stringify(results,null,2));throw error;}
  finally{
    lease?.release();manager.close();
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    fs.writeFileSync(path.join(evidence,"result.json"),JSON.stringify(results,null,2));
    if(fs.existsSync(path.join(temporary,"test-results")))fs.cpSync(path.join(temporary,"test-results"),path.join(evidence,"artifacts",randomUUID()),{recursive:true});
    // Owned fixture only; retain result artifacts, never user worktrees.
    await fs.promises.rm(temporary,{recursive:true,force:true,maxRetries:10,retryDelay:200});
  }
  console.log("Real browser preparation/MCP verification passed");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
