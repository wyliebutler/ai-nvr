#!/bin/bash
set -e

# Configuration
APP_DIR="/srv/ai-nvr"
BACKUP_DIR="/srv/backups/ai-nvr"

if [ -z "$1" ]; then
    echo "Usage: ./restore.sh <backup-filename>"
    echo "Available backups:"
    ls -lh "$BACKUP_DIR"
    exit 1
fi

BACKUP_FILE="$1"

# Check if full path provided, else assume relative to BACKUP_DIR
if [[ ! "$BACKUP_FILE" = /* ]]; then
    BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file '$BACKUP_FILE' not found!"
    exit 1
fi

echo "WARNING: This will overwrite the current installation at $APP_DIR"
echo "Recordings will be preserved if they are in $APP_DIR/recordings"
read -p "Are you sure? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore cancelled."
    exit 1
fi

echo "Stopping services..."
cd "$APP_DIR" || exit 1
docker compose down

echo "Preserving recordings..."
# Move recordings to a temp location safely
mkdir -p /srv/temp_recordings
if [ -d "$APP_DIR/recordings" ]; then
    mv "$APP_DIR/recordings" /srv/temp_recordings/
fi

echo "Wiping current application..."
# Be careful here!
rm -rf "$APP_DIR"/*
# Restore hidden files too if any? Tar handles directory structure.
# Actually, tar extracts 'ai-nvr/...' because we did -C /srv ai-nvr
# So we should extract -C /srv

echo "Restoring from backup..."
tar -xzf "$BACKUP_FILE" -C /srv

echo "Restoring recordings..."
if [ -d "/srv/temp_recordings/recordings" ]; then
    mkdir -p "$APP_DIR/recordings"
    mv /srv/temp_recordings/recordings/* "$APP_DIR/recordings/"
    rmdir "/srv/temp_recordings/recordings"
fi
# Cleanup temp if empty
rmdir /srv/temp_recordings 2>/dev/null || true

echo "Rebuilding and starting services..."
cd "$APP_DIR"
docker compose up -d --build

echo "Restore complete!"
