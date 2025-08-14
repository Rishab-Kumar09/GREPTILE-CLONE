# PowerShell script to trigger migration after deployment
# Usage: .\scripts\trigger-migration.ps1

Write-Host "🚀 Triggering post-deployment migration..." -ForegroundColor Green

# Set your migration secret (or use environment variable)
$MIGRATION_SECRET = if ($env:MIGRATION_SECRET) { $env:MIGRATION_SECRET } else { "your-secret-key" }
$APP_URL = "https://master.d3dp89x98knsw0.amplifyapp.com"

# Trigger migration
Write-Host "📡 Sending migration request..." -ForegroundColor Yellow

try {
    $headers = @{
        "Authorization" = "Bearer $MIGRATION_SECRET"
        "Content-Type" = "application/json"
    }
    
    $response = Invoke-RestMethod -Uri "$APP_URL/api/migrate/trigger" -Method POST -Headers $headers
    
    Write-Host "✅ Migration triggered successfully!" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json)" -ForegroundColor Cyan
    
    # Wait and verify
    Write-Host "⏳ Waiting 10 seconds for migration to complete..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
    Write-Host "🔍 Verifying database health..." -ForegroundColor Yellow
    try {
        $healthResponse = Invoke-RestMethod -Uri "$APP_URL/api/health/db" -Method GET
        Write-Host "✅ Database is healthy! Migration completed successfully." -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️ Migration may still be in progress. Check again in a moment." -ForegroundColor Yellow
    }
}
catch {
    Write-Host "❌ Migration failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} 