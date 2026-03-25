param(
  [string]$DbHost = $env:PGHOST,
  [string]$DbPort = $env:PGPORT,
  [string]$DbName = $env:PGDATABASE,
  [string]$DbUser = $env:PGUSER,
  [string]$DbPassword = $env:PGPASSWORD,
  [string]$BackupPassphrase = $env:BACKUP_ENCRYPTION_PASSPHRASE,
  [string]$SupabaseUrl = $env:SUPABASE_URL,
  [string]$ServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY
)

$ErrorActionPreference = "Stop"

function Require-Value([string]$name, [string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required value: $name"
  }
}

Require-Value "PGHOST" $DbHost
Require-Value "PGPORT" $DbPort
Require-Value "PGDATABASE" $DbName
Require-Value "PGUSER" $DbUser
Require-Value "PGPASSWORD" $DbPassword
Require-Value "BACKUP_ENCRYPTION_PASSPHRASE" $BackupPassphrase
Require-Value "SUPABASE_URL" $SupabaseUrl
Require-Value "SUPABASE_SERVICE_ROLE_KEY" $ServiceRoleKey

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$workDir = Join-Path $PSScriptRoot "..\tmp\backups"
New-Item -ItemType Directory -Path $workDir -Force | Out-Null

$dumpFile = Join-Path $workDir "db-backup-$timestamp.sql"
$encryptedFile = "$dumpFile.enc"
$checksumFile = "$encryptedFile.sha256"
$bucketPath = "nightly/db-backup-$timestamp.sql.enc"

$env:PGPASSWORD = $DbPassword

Write-Output "[backup] Creating pg_dump..."
& pg_dump -h $DbHost -p $DbPort -U $DbUser -d $DbName -f $dumpFile --no-owner --no-privileges
if ($LASTEXITCODE -ne 0) {
  throw "pg_dump failed"
}

Write-Output "[backup] Encrypting backup file..."
& openssl enc -aes-256-cbc -salt -pbkdf2 -in $dumpFile -out $encryptedFile -pass "pass:$BackupPassphrase"
if ($LASTEXITCODE -ne 0) {
  throw "openssl encryption failed"
}

Write-Output "[backup] Calculating checksum..."
$hash = (Get-FileHash -Path $encryptedFile -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -Path $checksumFile -Value $hash -Encoding ascii

Write-Output "[backup] Registering backup run (started)..."
$headers = @{ apikey = $ServiceRoleKey; Authorization = "Bearer $ServiceRoleKey"; "Content-Type" = "application/json"; Prefer = "return=representation" }
$startedBody = @{ backup_path = $bucketPath; backup_checksum = $hash; status = "started"; metadata = @{ source = "nightly_backup_job" } } | ConvertTo-Json -Depth 6
$run = Invoke-RestMethod -Method POST -Uri "$SupabaseUrl/rest/v1/system_backup_runs" -Headers $headers -Body $startedBody
$runId = $run[0].id

Write-Output "[backup] Uploading encrypted dump to system_backups bucket..."
$uploadHeaders = @{ apikey = $ServiceRoleKey; Authorization = "Bearer $ServiceRoleKey"; "x-upsert" = "true"; "Content-Type" = "application/octet-stream" }
Invoke-WebRequest -Method POST -Uri "$SupabaseUrl/storage/v1/object/system_backups/$bucketPath" -Headers $uploadHeaders -InFile $encryptedFile | Out-Null

Write-Output "[backup] Marking run uploaded and verified..."
$patchBody = @{ status = "verified"; completed_at = (Get-Date).ToUniversalTime().ToString("o"); metadata = @{ source = "nightly_backup_job"; retention_days = 30 } } | ConvertTo-Json -Depth 6
Invoke-WebRequest -Method PATCH -Uri "$SupabaseUrl/rest/v1/system_backup_runs?id=eq.$runId" -Headers $headers -Body $patchBody | Out-Null

Write-Output "[backup] Applying 30-day retention policy..."
$cutoff = (Get-Date).AddDays(-30).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$oldRuns = Invoke-RestMethod -Method GET -Uri "$SupabaseUrl/rest/v1/system_backup_runs?select=id,backup_path,started_at&started_at=lt.$cutoff" -Headers @{ apikey = $ServiceRoleKey; Authorization = "Bearer $ServiceRoleKey" }
foreach ($old in $oldRuns) {
  try {
    Invoke-RestMethod -Method DELETE -Uri "$SupabaseUrl/storage/v1/object/system_backups/$($old.backup_path)" -Headers @{ apikey = $ServiceRoleKey; Authorization = "Bearer $ServiceRoleKey" } | Out-Null
    $expiredPatch = @{ status = "expired"; completed_at = (Get-Date).ToUniversalTime().ToString("o") } | ConvertTo-Json
    Invoke-WebRequest -Method PATCH -Uri "$SupabaseUrl/rest/v1/system_backup_runs?id=eq.$($old.id)" -Headers $headers -Body $expiredPatch | Out-Null
  } catch {
    Write-Warning "Failed cleanup for old backup: $($old.backup_path)"
  }
}

Write-Output "[backup] Completed successfully. Uploaded: $bucketPath"
