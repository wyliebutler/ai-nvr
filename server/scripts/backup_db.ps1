$source = "data/nvr.sqlite"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$destination = "data/backup/nvr_$timestamp.sqlite"

# Create backup directory if it doesn't exist
if (-not (Test-Path "data/backup")) {
    New-Item -ItemType Directory -Force -Path "data/backup" | Out-Null
}

if (Test-Path $source) {
    Copy-Item $source $destination
    Write-Host "Backup created: $destination"
} else {
    Write-Host "Error: Database file not found at $source"
}
