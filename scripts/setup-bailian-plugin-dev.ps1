param(
  [string]$ApiKey = "PLEASE_SET_BAILIAN_API_KEY",
  [string]$TokenKey = "",
  [string]$ChannelName = "Local Ali Bailian",
  [string]$TokenName = "rw-proxy bailian plugin dev",
  [string]$Group = "default",
  [string[]]$Models = @("glm-5", "qwen3.5-plus-2026-02-15")
)

$ErrorActionPreference = "Stop"

function Escape-SqliteLiteral {
  param([string]$Value)
  return $Value.Replace("'", "''")
}

function New-RandomTokenKey {
  param([int]$Length = 32)

  $chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".ToCharArray()
  $builder = New-Object System.Text.StringBuilder
  for ($i = 0; $i -lt $Length; $i++) {
    [void]$builder.Append($chars[(Get-Random -Minimum 0 -Maximum $chars.Length)])
  }
  return $builder.ToString()
}

if ([string]::IsNullOrWhiteSpace($TokenKey)) {
  $TokenKey = New-RandomTokenKey
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$dbPath = Join-Path $repoRoot "data\one-api.db"

if (-not (Test-Path $dbPath)) {
  throw "Database file not found: $dbPath"
}

$sqliteCandidates = @(
  (Get-Command sqlite3 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
  "E:\adb\platform-tools\sqlite3.exe"
) | Where-Object { $_ -and (Test-Path $_) }

if (-not $sqliteCandidates) {
  throw "sqlite3 executable not found. Install sqlite3 or place it at E:\adb\platform-tools\sqlite3.exe"
}

$sqlite = $sqliteCandidates[0]

$escapedApiKey = Escape-SqliteLiteral $ApiKey
$escapedChannelName = Escape-SqliteLiteral $ChannelName
$escapedTokenName = Escape-SqliteLiteral $TokenName
$escapedGroup = Escape-SqliteLiteral $Group
$escapedTokenKey = Escape-SqliteLiteral $TokenKey
$modelCsv = ($Models | ForEach-Object { $_.Trim() } | Where-Object { $_ } ) -join ","
$escapedModelCsv = Escape-SqliteLiteral $modelCsv

$abilityRows = @()
foreach ($model in ($Models | ForEach-Object { $_.Trim() } | Where-Object { $_ })) {
  $escapedModel = Escape-SqliteLiteral $model
  $abilityRows += "('$escapedGroup','$escapedModel',9001,1,0,0,NULL)"
}

$abilitySql = $abilityRows -join ",`n"

$sql = @"
DELETE FROM abilities WHERE channel_id = 9001 OR [group] = '$escapedGroup';
DELETE FROM channels WHERE id = 9001 OR name = '$escapedChannelName' OR [group] = '$escapedGroup';
DELETE FROM tokens WHERE id = 9001 OR name = '$escapedTokenName' OR [group] = '$escapedGroup';

DELETE FROM abilities WHERE channel_id IN (SELECT id FROM channels WHERE name = 'Local Mock OpenAI');
DELETE FROM channels WHERE name = 'Local Mock OpenAI';
DELETE FROM tokens WHERE name = 'rw-proxy front test';

INSERT INTO channels (
  id, type, key, status, name, created_time, base_url, models, [group], priority, auto_ban
) VALUES (
  9001, 17, '$escapedApiKey', 1, '$escapedChannelName', strftime('%s','now'),
  'https://dashscope.aliyuncs.com', '$escapedModelCsv', '$escapedGroup', 0, 0
);

INSERT INTO abilities ([group], model, channel_id, enabled, priority, weight, tag) VALUES
$abilitySql;

INSERT INTO tokens (
  id, user_id, key, status, name, created_time, accessed_time, expired_time,
  remain_quota, unlimited_quota, model_limits_enabled, model_limits, allow_ips,
  used_quota, [group], cross_group_retry
) VALUES (
  9001, 1, '$escapedTokenKey', 1, '$escapedTokenName', strftime('%s','now'), strftime('%s','now'),
  -1, 1000000, 1, 0, '', '', 0, '$escapedGroup', 0
);

SELECT id, name, [group], key FROM tokens WHERE id = 9001;
SELECT id, name, type, base_url, models, [group] FROM channels WHERE id = 9001;
"@

& $sqlite $dbPath $sql

Write-Host ""
Write-Host "Plugin token:" -ForegroundColor Cyan
Write-Host "sk-$TokenKey" -ForegroundColor Green
Write-Host ""
Write-Host "Group:" -ForegroundColor Cyan
Write-Host $Group -ForegroundColor Green
Write-Host ""
Write-Host "Models:" -ForegroundColor Cyan
Write-Host ($Models -join ", ") -ForegroundColor Green
Write-Host ""
if ($ApiKey -eq "PLEASE_SET_BAILIAN_API_KEY") {
  Write-Warning "Bailian upstream API key is still a placeholder. Models will list correctly, but real chat calls will fail until you rerun this script with -ApiKey <your-bailian-key>."
}
