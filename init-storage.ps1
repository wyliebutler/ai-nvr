$directories = @("data", "recordings")

foreach ($dir in $directories) {
    if (-not (Test-Path -Path $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
        Write-Host "Created directory: $dir"
    } else {
        Write-Host "Directory already exists: $dir"
    }
    
    if (-not (Test-Path -Path "$dir\.gitkeep")) {
        New-Item -ItemType File -Path "$dir\.gitkeep" | Out-Null
        Write-Host "Created .gitkeep in $dir"
    }
}
