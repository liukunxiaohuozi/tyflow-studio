$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech

$output = Join-Path $PSScriptRoot '..\artifacts\narration'
New-Item -ItemType Directory -Path $output -Force | Out-Null

$cues = @(
  @{ scene='title'; zh='欢迎使用 TingYun Studio。下面详细演示一项前端任务如何从需求识别开始，经过评估、计划、开发、测试和验收，最终形成可追溯的质量闭环。'; en='Welcome to TingYun Studio. This detailed walkthrough shows how a frontend task moves from requirement recognition through assessment, planning, development, testing, and acceptance into a traceable quality loop.' },
  @{ scene='config'; zh='流程从项目配置开始。开发者身份用于 Git 提交，默认项目决定新任务的初始归属。每个项目还需要绑定代码仓库、本地目录、认证方式、默认分支策略、启动脚本和开发页面地址。'; en='The workflow begins with project setup. The developer identity is used for Git commits, while the default project assigns new tasks. Each project also defines its repository, local directory, authentication, branch strategy, start command, and development URL.' },
  @{ scene='recognition'; zh='录入任务时，系统支持三类来源：OpenDesign 导出的 ZIP 或 HTML、直接输入的文字需求，以及 Bug 修复。还可以关联禅道需求、任务或 Bug，并补充截图和附件。系统会识别设计页面与资源，把标题、说明、项目、附件和任务类型组织成统一需求输入。'; en='Task intake supports three sources: OpenDesign ZIP or HTML exports, written requirements, and bug fixes. A ZenTao requirement, task, or bug can be linked, with screenshots and attachments. The system recognizes design pages and assets, then normalizes the title, description, project, evidence, and task type into one requirement input.' },
  @{ scene='assessment'; zh='点击开始评估后，TingYun 只读检查所选项目和分支。它读取需求、设计交付物、仓库结构、远程分支状态和项目规范，同时检查工作区是否有未提交修改、分支是否落后或分叉。评估阶段不会创建分支，也不会修改代码。'; en='When assessment starts, TingYun inspects the selected project and branch in read-only mode. It reads the requirement, design package, repository structure, remote branch state, and project standards, while checking for uncommitted changes, stale branches, or divergence. Assessment does not create branches or modify code.' },
  @{ scene='plan'; zh='评估产出不是一句结论，而是一套可审核的执行方案，包括实现摘要、分步骤开发计划、风险和阻塞项，以及与验收标准对应的测试用例。用户可以预览计划和用例，提出范围、实现方式、遗漏场景或回滚要求，系统会重新生成后再确认。'; en='Assessment produces more than a conclusion. It creates a reviewable execution package with an implementation summary, step-by-step plan, risks, blockers, and test cases mapped to acceptance criteria. The user can review the plan and cases, request scope, implementation, coverage, or rollback changes, and regenerate them before approval.' },
  @{ scene='snapshot'; zh='确认开发时，系统锁定本次执行快照。快照保存原始需求、项目配置、目标分支、基线提交、设计与附件哈希、已确认计划和测试用例。后续即使需求或设计发生变化，也不会悄悄改变正在执行的范围。'; en='When development is confirmed, the system freezes an execution snapshot. It records the original requirement, project configuration, target branch, base commit, design and attachment hashes, approved plan, and test cases. Later requirement or design changes cannot silently alter the active execution scope.' },
  @{ scene='development'; zh='开发阶段按照确认后的步骤执行。系统准备新分支或已有分支，调用 Codex 修改代码，并持续记录每个阶段的开始时间、结束时间、日志和代码提交。若代码范围偏离计划，后续差异审查会把计划外文件标记出来。'; en='Development follows the approved steps. The system prepares a new or existing branch, invokes Codex to modify the code, and records stage timestamps, logs, and commits. If the changed scope drifts from the plan, the later diff review flags unplanned files.' },
  @{ scene='testing'; zh='开发完成后自动调用测试 Skill。测试不是只看命令是否返回零，而是执行评估阶段生成的用例，并结合项目硬检查、单元测试、集成测试和页面交互验证。每项检查都记录名称、状态和详细结果，失败项会保留原始日志。'; en='After development, the testing skill runs automatically. Testing does not rely only on a zero exit code. It executes the assessment test cases together with project hard checks, unit tests, integration tests, and page interaction validation. Every check records its name, state, and details, while failures retain their original logs.' },
  @{ scene='evidence'; zh='测试可信度由证据链证明。记录中包含测试执行器身份、是否复用结果、本次代码快照、计划哈希、测试用例结果，以及差异审查。差异审查会列出改动文件、计划外文件、未覆盖文件和高风险变更，只有必要门禁全部通过，任务才进入验收。'; en='A test evidence chain establishes trust. The record includes the test executor identity, whether results were reused, the exact source snapshot, plan hash, individual test case outcomes, and a diff review. The review lists changed, unplanned, uncovered, and high-risk files. The task advances to acceptance only when required gates pass.' },
  @{ scene='failure'; zh='如果测试失败，任务不会被伪装成完成。失败阶段、日志和已有代码都会保留。开发者可以补充复现条件、权限、控制台信息、截图或附件，然后从失败阶段修复并重测，直到证据重新通过。'; en='If testing fails, the task is never presented as complete. The failed stage, logs, and existing code remain available. The developer can add reproduction conditions, permissions, console output, screenshots, or attachments, then repair and retest from the failed stage until the evidence passes.' },
  @{ scene='acceptance'; zh='自动化通过不等于业务验收。Studio 使用项目配置的启动脚本运行应用，并打开开发页面。验收人员在真实页面检查交互和业务结果，确认测试覆盖之外的体验问题，只有点击验收后才能进入提交与推送。'; en='Automation passing is not the same as business acceptance. Studio runs the configured start command and opens the development page. The reviewer checks real interactions and business outcomes, including experience issues beyond automated coverage. Commit and push are enabled only after explicit acceptance.' },
  @{ scene='delivery'; zh='验收后，系统提交并推送到目标远程分支，同时保存交付提交号、分支、远程仓库、推送时间、历次执行、测试结果和需求快照。这样可以从最终代码反查需求、计划、测试证据和人工验收记录。'; en='After acceptance, the system commits and pushes to the target remote branch. It stores the delivery commit, branch, remote, push time, execution history, test results, and requirement snapshot. The final code can therefore be traced back to its requirement, plan, test evidence, and manual acceptance.' },
  @{ scene='bug'; zh='Bug 修复使用更短的路径，但证据要求不降低。系统从复现信息和附件定位问题，完成修复后执行必要检查，再启动项目进行人工验证。修复代码、检查结果、失败重试和验收结论仍保存在同一闭环记录中。'; en='Bug fixes use a shorter path without lowering the evidence standard. The system diagnoses the issue from reproduction details and attachments, runs required checks after the repair, and launches the project for manual verification. Code changes, check results, retries, and acceptance remain in one closed-loop record.' },
  @{ scene='end'; zh='这就是 TingYun Studio 的研发质量闭环：需求可识别，计划可审核，范围可锁定，开发可追踪，测试有证据，失败可重试，结果需验收，交付可追溯。'; en='This is the TingYun Studio quality loop: requirements are recognized, plans reviewed, scope frozen, development traced, tests evidenced, failures retried, results accepted, and delivery auditable.' }
)

function Get-WavDuration([string]$Path) {
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  $offset = 12
  $byteRate = 0
  $dataSize = 0
  while ($offset + 8 -le $bytes.Length) {
    $id = [Text.Encoding]::ASCII.GetString($bytes, $offset, 4)
    $size = [BitConverter]::ToInt32($bytes, $offset + 4)
    if ($id -eq 'fmt ') { $byteRate = [BitConverter]::ToInt32($bytes, $offset + 16) }
    if ($id -eq 'data') { $dataSize = $size; break }
    $offset += 8 + $size + ($size % 2)
  }
  if ($byteRate -le 0 -or $dataSize -le 0) { throw "Invalid WAV structure: $Path" }
  return $dataSize / $byteRate
}

$timeline = @()
$index = 0
foreach ($cue in $cues) {
  foreach ($lang in @('zh','en')) {
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    if ($lang -eq 'zh') { $synth.SelectVoice('Microsoft Huihui Desktop'); $synth.Rate = 0 }
    else { $synth.SelectVoice('Microsoft Zira Desktop'); $synth.Rate = 0 }
    $name = '{0:D2}-{1}.wav' -f $index, $lang
    $file = Join-Path $output $name
    $synth.SetOutputToWaveFile($file)
    $synth.Speak($cue[$lang])
    $synth.Dispose()
    $timeline += [ordered]@{
      scene = $cue.scene
      lang = $lang
      text = $cue[$lang]
      zh = $cue.zh
      en = $cue.en
      file = $name
      duration = [Math]::Round((Get-WavDuration $file), 3)
    }
    $index++
  }
}
$timeline | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $output 'timeline.json') -Encoding UTF8
Write-Output ($timeline | ConvertTo-Json -Depth 4 -Compress)
