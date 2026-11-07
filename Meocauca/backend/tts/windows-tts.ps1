# Offline Windows text-to-speech worker for Cat Fishing Live.
# Reads one JSON request per line on stdin: {"id":"..","text":"..","voice":"..","rate":1.0,"out":"C:\\path\\file.wav"}
# Writes one JSON line per request on stdout: {"id":"..","ok":true} or {"id":"..","ok":false,"error":".."}
# A request {"cmd":"voices"} answers {"voices":[{"name":"..","lang":".."}]}.
# Uses the Windows OneCore voices (e.g. "Microsoft An" – Vietnamese; install it in
# Settings > Time & Language > Speech > Add voices).

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media, ContentType = WindowsRuntime]

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  })[0]

function Await($op, [Type]$resultType) {
  $task = $asTaskGeneric.MakeGenericMethod($resultType).Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
  return $task.Result
}

function Reply($obj) {
  [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress -Depth 4))
  [Console]::Out.Flush()
}

$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  if ($line.Trim() -eq '') { continue }
  $req = $null
  try {
    $req = $line | ConvertFrom-Json
    if ($req.cmd -eq 'voices') {
      $list = @([Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | ForEach-Object { @{ name = $_.DisplayName; lang = $_.Language } })
      Reply @{ voices = $list }
      continue
    }
    $all = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices
    $voice = $null
    if ($req.voice) { $voice = $all | Where-Object { $_.DisplayName -eq $req.voice } | Select-Object -First 1 }
    if (-not $voice) { $voice = $all | Where-Object { $_.Language -like 'vi*' } | Select-Object -First 1 }
    if (-not $voice) { throw 'Chua cai giong tieng Viet cho Windows (Settings > Time & Language > Speech > Add voices > Tieng Viet)' }
    $synth.Voice = $voice
    if ($req.rate) { $synth.Options.SpeakingRate = [double]$req.rate }
    $stream = Await ($synth.SynthesizeTextToStreamAsync([string]$req.text)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
    $in = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream)
    $out = [System.IO.File]::Create([string]$req.out)
    try { $in.CopyTo($out) } finally { $out.Dispose(); $in.Dispose(); $stream.Dispose() }
    Reply @{ id = $req.id; ok = $true }
  } catch {
    $id = $null
    if ($req) { $id = $req.id }
    Reply @{ id = $id; ok = $false; error = $_.Exception.Message }
  }
}
