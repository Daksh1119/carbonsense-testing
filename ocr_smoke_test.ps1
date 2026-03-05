# Run from repo root after server is up on :8000
# Usage:
#   .\ocr_smoke_test.ps1 -OrgId "ORG_UUID" -UserId "USER_UUID" -ImgPath ".\tests\receipt1.jpg" -ZipPath ".\tests\receipts.zip"

param(
  [Parameter(Mandatory=$true)][string]$OrgId,
  [Parameter(Mandatory=$true)][string]$UserId,
  [Parameter(Mandatory=$true)][string]$ImgPath,
  [Parameter(Mandatory=$true)][string]$ZipPath
)

$base = "http://127.0.0.1:8000"

function Print-Section($title) {
  Write-Host "`n==================== $title ====================" -ForegroundColor Cyan
}

function Assert-JsonField($json, $field) {
  if ($null -eq $json.$field) {
    Write-Host "❌ Missing field: $field" -ForegroundColor Red
  } else {
    Write-Host "✅ Field present: $field" -ForegroundColor Green
  }
}

# 1) Health
Print-Section "Health Check"
try {
  $h = Invoke-RestMethod -Uri "$base/health" -Method Get
  $h | ConvertTo-Json -Depth 10
} catch {
  Write-Host "❌ Health failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

# 2) Single OCR - happy path
Print-Section "Single OCR - valid image"
try {
  $resp = Invoke-RestMethod -Uri "$base/ocr/receipt" -Method Post -Form @{
    file = Get-Item $ImgPath
    organization_id = $OrgId
    uploaded_by = $UserId
    employee_user_id = $UserId
  }
  $resp | ConvertTo-Json -Depth 20
  Assert-JsonField $resp "success"
  Assert-JsonField $resp "organization_id"
  Assert-JsonField $resp "confidence"
  Assert-JsonField $resp "requires_review"
} catch {
  Write-Host "❌ Single OCR failed: $($_.Exception.Message)" -ForegroundColor Red
}

# 3) Single OCR - invalid filetype (expected fail)
Print-Section "Single OCR - invalid file type (expected 400)"
$tmpTxt = Join-Path $env:TEMP "not_receipt.txt"
"hello" | Set-Content $tmpTxt
try {
  Invoke-RestMethod -Uri "$base/ocr/receipt" -Method Post -Form @{
    file = Get-Item $tmpTxt
    organization_id = $OrgId
    uploaded_by = $UserId
  } | Out-Null
  Write-Host "❌ Expected failure but succeeded" -ForegroundColor Red
} catch {
  Write-Host "✅ Rejected invalid type as expected" -ForegroundColor Green
}

# 4) Bulk OCR - happy path
Print-Section "Bulk OCR - valid zip"
try {
  $b = Invoke-RestMethod -Uri "$base/ocr/receipts/bulk" -Method Post -Form @{
    zip_file = Get-Item $ZipPath
    organization_id = $OrgId
    uploaded_by = $UserId
  }
  $b | ConvertTo-Json -Depth 20
  Assert-JsonField $b "success"
  Assert-JsonField $b "total_files"
  Assert-JsonField $b "processed_count"
  Assert-JsonField $b "failed_count"
} catch {
  Write-Host "❌ Bulk OCR failed: $($_.Exception.Message)" -ForegroundColor Red
}

# 5) Analytics - valid range
Print-Section "Org Analytics - valid range"
$start = "2026-01-01"
$end   = "2026-12-31"
try {
  $a = Invoke-RestMethod -Uri "$base/ocr/analytics/organization?organization_id=$OrgId&start_date=$start&end_date=$end&user_id=$UserId" -Method Get
  $a | ConvertTo-Json -Depth 20
  Assert-JsonField $a "success"
  Assert-JsonField $a "total_receipts"
  Assert-JsonField $a "total_carbon_kg"
} catch {
  Write-Host "❌ Analytics failed: $($_.Exception.Message)" -ForegroundColor Red
}

# 6) Analytics - invalid range (expected 400)
Print-Section "Org Analytics - invalid range end<start (expected 400)"
try {
  Invoke-RestMethod -Uri "$base/ocr/analytics/organization?organization_id=$OrgId&start_date=2026-12-31&end_date=2026-01-01&user_id=$UserId" -Method Get | Out-Null
  Write-Host "❌ Expected failure but succeeded" -ForegroundColor Red
} catch {
  Write-Host "✅ Invalid range rejected as expected" -ForegroundColor Green
}

Write-Host "`nDone. Review ✅/❌ above." -ForegroundColor Yellow