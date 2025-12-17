#!/bin/bash
set -e

# Configuration
APP_DIR="/srv/ai-nvr"
BACKUP_DIR="/srv/backups/ai-nvr"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/backup-$TIMESTAMP.tar.gz"

# Ensure backup dir exists
mkdir -p "$BACKUP_DIR"

echo "Starting backup of AI-NVR..."
echo "Source: $APP_DIR"
echo "Destination: $BACKUP_FILE"

# Create backup
# Exclude recordings logs, and node_modules (though node_modules usually inside container, might be in mounted src)
tar -czf "$BACKUP_FILE" \
    --exclude='recordings' \
    --exclude='server/logs' \
    --exclude='server/node_modules' \
    --exclude='client/node_modules' \
    -C /srv \
    ai-nvr

echo "Backup complete!"
ls -lh "$BACKUP_FILE"
