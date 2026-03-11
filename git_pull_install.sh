#!/bin/bash

# --- Load Shared Functions ---
if [ -f "/usr/local/bin/DW_common_functions.sh" ]; then
    source "/usr/local/bin/DW_common_functions.sh"
else
    echo "⚠️ /usr/local/bin/DW_common_functions.sh missing. Exiting."
    exit 1
fi

# Configuration
DEST_DIR="/opt/mealie_integration"
SERVICE_NAME="mealie-sync"

# Ensure the destination exists
if [ ! -d "$DEST_DIR" ]; then
    echo "Creating directory $DEST_DIR..."
    sudo mkdir -p "$DEST_DIR"
fi

cd "$DEST_DIR" || exit

# 1. Clean up and ensure permissions
# We set ownership to root so the systemd service has consistent access
sudo rm -f .git/index.lock
sudo chown -R root:root "$DEST_DIR"

# 2. Pull latest changes
echo "Pulling latest changes into $DEST_DIR..."
if ! sudo git pull origin main; then
    echo "Conflict detected! Forcing local repo to match GitHub..."
    sudo git fetch origin
    sudo git reset --hard origin/main
fi

# 3. Ensure all scripts in DEST_DIR are executable
sudo chmod +x "$DEST_DIR"/*.{sh,js} 2>/dev/null

# 4. Handle Service File sync
# If the repo contains the .service file, copy it to the system directory
if [ -f "$DEST_DIR/$SERVICE_NAME.service" ]; then
    echo "Syncing service file to systemd..."
    sudo cp "$DEST_DIR/$SERVICE_NAME.service" "/etc/systemd/system/"
    sudo chown root:root "/etc/systemd/system/$SERVICE_NAME.service"
    sudo chmod 644 "/etc/systemd/system/$SERVICE_NAME.service"
    sudo systemctl daemon-reload
fi

# 5. Restart the Service
echo "🔄 Running mealie-sync..."
sudo systemctl daemon-reload
# Restart triggers the script immediately
sudo systemctl restart "$SERVICE_NAME"

# Check if the restart command succeeded (exit code 0)
if [ $? -eq 0 ]; then
    echo "✅ $SERVICE_NAME triggered successfully."
else
    echo "❌ $SERVICE_NAME failed to trigger."
fi

log "✅ Mealie integration update complete (Run from $DEST_DIR)."
echo "✨ Sync finished."
