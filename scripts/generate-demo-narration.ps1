$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech

$output = Join-Path $PSScriptRoot '..\artifacts\narration'
New-Item -ItemType Directory -Path $output -Force | Out-Null

$cues = @(
  @{ scene='title'; zh='欢迎使用 TingYun Studio。下面演示项目配置，以及 Bug 修复和需求开发的完整质量闭环。'; en='Welcome to TingYun Studio. This walkthrough covers project setup and the complete quality loop for bug fixes and feature development.' },
  @{ scene='config'; zh='开始任务前，先进入开发配置，填写开发者身份，并选择默认项目。'; en='Before starting a task, open Development Settings, enter the developer identity, and select the default project.' },
  @{ scene='detail'; zh='每个项目需要配置项目标识、代码仓库、本地目录、认证方式、分支策略、启动脚本和开发页面地址。'; en='Each project defines its identifier, repository, local directory, authentication, branch strategy, start command, and development URL.' },
  @{ scene='selector'; zh='配置保存后，点击演示示例，在弹窗中选择 Bug 修复或需求开发。'; en='After saving the configuration, select Demo Example and choose either Bug Fix or Feature Development.' },
  @{ scene='bug'; zh='Bug 修复从问题复现开始。补充现象、截图和期望结果后，系统在所选分支定位问题并完成修复。'; en='A bug fix starts with reproduction details. Add symptoms, screenshots, and the expected result, then the system locates and repairs the issue on the selected branch.' },
  @{ scene='bugclose'; zh='修复完成后执行必要检查，启动项目进行人工验收，并把日志、测试结果和代码快照保存在同一条记录中。'; en='After the repair, required checks run before manual acceptance. Logs, test results, and the source snapshot remain in one traceable record.' },
  @{ scene='feature'; zh='需求开发先录入文字需求或导入 OpenDesign 设计，再生成开发计划、风险和测试用例，确认范围后开始开发。'; en='Feature development begins with a written request or an OpenDesign package. The system generates the plan, risks, and test cases before implementation starts.' },
  @{ scene='accept'; zh='开发和自动化测试通过后，打开真实页面进行人工验收。确认后提交并推送代码，形成完整交付闭环。'; en='After development and automated tests pass, review the real page manually. Acceptance commits and pushes the code, completing the delivery loop.' },
  @{ scene='end'; zh='TingYun Studio，让计划可预览、过程可追溯、结果可验收。'; en='TingYun Studio makes plans visible, execution traceable, and results ready for acceptance.' }
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
    if ($lang -eq 'zh') { $synth.SelectVoice('Microsoft Huihui Desktop'); $synth.Rate = -1 }
    else { $synth.SelectVoice('Microsoft Zira Desktop'); $synth.Rate = -1 }
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
