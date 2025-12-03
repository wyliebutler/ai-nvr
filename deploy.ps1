# Deploy to ai-nvr server

$ErrorActionPreference = "Stop"

Write-Host "Preparing deployment..."
# Create temp dir to organize files and exclude node_modules
if (Test-Path .deploy_tmp) { Remove-Item .deploy_tmp -Recurse -Force }
New-Item -Type Directory -Path .deploy_tmp | Out-Null
New-Item -Type Directory -Path .deploy_tmp/client | Out-Null
New-Item -Type Directory -Path .deploy_tmp/server | Out-Null

# Copy shared
Copy-Item -Path shared -Destination .deploy_tmp -Recurse

# Copy server (excluding node_modules)
Copy-Item -Path server/* -Destination .deploy_tmp/server -Recurse
if (Test-Path .deploy_tmp/server/node_modules) {
    Remove-Item .deploy_tmp/server/node_modules -Recurse -Force
}

# Copy client (excluding node_modules)
# Copy-Item -Exclude is shallow, so we copy everything then delete node_modules
Copy-Item -Path client/* -Destination .deploy_tmp/client -Recurse
if (Test-Path .deploy_tmp/client/node_modules) {
    Remove-Item .deploy_tmp/client/node_modules -Recurse -Force
}

Write-Host "Archiving files..."
if (Test-Path deploy.tar.gz) { Remove-Item deploy.tar.gz -Force }
tar -czf deploy.tar.gz -C .deploy_tmp .

# Cleanup temp
Remove-Item .deploy_tmp -Recurse -Force

Write-Host "Copying archive to server..."
scp -F ssh_config deploy.tar.gz ai-nvr:docker/ai-nvr/

Write-Host "Extracting and rebuilding on server..."
# -o for overwrite
ssh -F ssh_config ai-nvr "cd docker/ai-nvr && rm -rf client server/src && tar -xzf deploy.tar.gz && rm deploy.tar.gz && docker compose down && docker system prune -f && docker compose build --no-cache server client && docker compose up -d server client"

# Cleanup local archive
Remove-Item deploy.tar.gz -Force

Write-Host "Deployment complete!"
