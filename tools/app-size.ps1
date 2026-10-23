# Writes app-size.json: how much the app (FILES in sw.js) and each add-on (ADDONS in sw.js) download.
# The About page shows these as the expected download size. Run before each release:
#   powershell -ExecutionPolicy Bypass -File tools/app-size.ps1
$root = Split-Path $PSScriptRoot -Parent
$sw = [IO.File]::ReadAllText((Join-Path $root 'sw.js'))
$version = [regex]::Match($sw, "VERSION = '([^']+)'").Groups[1].Value
function List($block) { [regex]::Matches($block, "'([^']+)'") | ForEach-Object { $_.Groups[1].Value } }
function Size($files) {
  $bytes = 0
  foreach ($f in $files) {
    $p = Join-Path $root ($(if ($f -eq './') { 'index.html' } else { $f }))
    $b = [IO.File]::ReadAllBytes($p)
    # text files are served with LF line ends whatever the local checkout uses
    if ($p -match '\.(html|js|css|json|csv|svg|webmanifest|md|txt)$') { $b = @($b | Where-Object { $_ -ne 13 }) }
    $bytes += $b.Length
  }
  @{ bytes = $bytes; files = @($files).Count }
}
$files = List ([regex]::Match($sw, 'const FILES = \[([\s\S]*?)\];').Groups[1].Value)
$addons = [ordered]@{}
foreach ($m in [regex]::Matches([regex]::Match($sw, 'const ADDONS = \{([\s\S]*?)\};').Groups[1].Value, "'cvdph-addon-([^']+)': \[([^\]]*)\]")) {
  $addons[$m.Groups[1].Value] = Size (List $m.Groups[2].Value)
}
$out = [ordered]@{ version = $version; app = (Size $files); addons = $addons }
$json = $out | ConvertTo-Json -Depth 4 -Compress
[IO.File]::WriteAllText((Join-Path $root 'app-size.json'), $json + "`n", (New-Object System.Text.UTF8Encoding $false))
$json
