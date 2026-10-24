$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$env:UV_CACHE_DIR = Join-Path $root ".uv-cache"
$pythonDir = Join-Path $root ".tools\python"
$env:UV_PYTHON_INSTALL_DIR = $pythonDir
$venvDir = Join-Path $root ".tools\piper-env"
$voiceDir = Join-Path $root "data\voices"
$uv = Get-Command uv -ErrorAction SilentlyContinue
if (-not $uv) { throw "uv est requis pour installer le moteur vocal Python. Installez uv, puis relancez npm run setup:voice." }

New-Item -ItemType Directory -Force -Path $pythonDir, $voiceDir | Out-Null
& $uv.Source python install 3.12 --install-dir $pythonDir --no-registry
if ($LASTEXITCODE -ne 0) { throw "Installation du runtime Python échouée." }
& $uv.Source venv --python 3.12 --python-preference only-managed --allow-existing $venvDir
if ($LASTEXITCODE -ne 0) { throw "Création de l'environnement Piper échouée." }
$python = Join-Path $venvDir "Scripts\python.exe"
& $uv.Source pip install --python $python "piper-tts==1.4.1"
if ($LASTEXITCODE -ne 0) { throw "Installation de Piper échouée." }

$baseUrl = "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/fr/fr_FR"
$voices = @(
  @{ Name = "siwis"; ModelBytes = 63201294; ConfigBytes = 4875 },
  @{ Name = "upmc"; ModelBytes = 76733615; ConfigBytes = 4996 },
  @{ Name = "tom"; ModelBytes = 63511038; ConfigBytes = 4959 },
  @{ Name = "mls"; ModelBytes = 76733750; ConfigBytes = 7036 }
)
foreach ($voiceInfo in $voices) {
  $voice = $voiceInfo.Name
  $name = "fr_FR-$voice-medium"
  foreach ($extension in @("onnx", "onnx.json")) {
    $destination = Join-Path $voiceDir "$name.$extension"
    $expectedBytes = if ($extension -eq "onnx") { $voiceInfo.ModelBytes } else { $voiceInfo.ConfigBytes }
    if ((Test-Path -LiteralPath $destination) -and (Get-Item -LiteralPath $destination).Length -ne $expectedBytes) {
      Remove-Item -LiteralPath $destination -Force
    }
    if (-not (Test-Path -LiteralPath $destination)) {
      $url = "$baseUrl/$voice/medium/$name.$extension`?download=true"
      $temporary = "$destination.download"
      if ((Test-Path -LiteralPath $temporary) -and (Get-Item -LiteralPath $temporary).Length -gt $expectedBytes) {
        Remove-Item -LiteralPath $temporary -Force
      }
      & curl.exe --fail --location --retry 5 --retry-all-errors --connect-timeout 20 --max-time 900 --continue-at - --output $temporary $url
      if ($LASTEXITCODE -ne 0) { throw "Téléchargement de $name.$extension échoué." }
      if ((Get-Item -LiteralPath $temporary).Length -ne $expectedBytes) { throw "Fichier incomplet pour $name.$extension ; relancez npm run setup:voice pour reprendre le téléchargement." }
      Move-Item -LiteralPath $temporary -Destination $destination -Force
    }
  }
}

Write-Host "Piper et les voix françaises SIWIS/UPMC/TOM/MLS sont prêts dans $root"
