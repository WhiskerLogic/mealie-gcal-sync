# Mealie <-> Google Calendar Sync

Bidirectional sync between a self-hosted [Mealie](https://mealie.io/) instance and a Google Calendar. Meal plans in Mealie appear as calendar events, and meals added directly to Google Calendar (e.g. by a partner) get imported back into Mealie — including automatic recipe scraping from URLs.

## How It Works

`sync_master.js` is the main script. It runs as a systemd oneshot service and does the following over a rolling 14-day window:

1. **Mealie → GCal**: Creates or updates Google Calendar events for each Mealie meal plan entry. Each event links back to the recipe on your public Mealie instance.
2. **Orphan Cleanup**: Removes GCal events that were previously synced from Mealie but whose meal plan entries no longer exist.
3. **GCal → Mealie**: Imports new events added directly to GCal (not originating from Mealie) into Mealie's meal planner. If the event description contains a recipe URL, Mealie will scrape it automatically.

## Prerequisites

- **Node.js** (tested with the version on your server)
- **Mealie** running locally on port `9925`
- **Google Cloud service account** with Calendar API enabled — place `credentials.json` in the project root
- **Mealie API key** stored in `/usr/local/bin/common_keys.txt` as `MEALIE_API_KEY=your_key_here`

## Setup

```bash
# Clone the repo to /opt/mealie_integration
sudo git clone <repo-url> /opt/mealie_integration
cd /opt/mealie_integration

# Install dependencies
npm install

# Add your Google service account credentials
cp /path/to/your/credentials.json .

# Install and enable the systemd service
sudo cp mealie-sync.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable mealie-sync
```

Or use the included deployment script, which handles pulling, installing, and restarting the service:

```bash
sudo bash git_pull_install.sh
```

## Running

```bash
# Run manually
node sync_master.js

# Or trigger via systemd
sudo systemctl start mealie-sync

# Check logs
journalctl -u mealie-sync -f
```

## Utility Scripts

These are one-off maintenance scripts — run them manually as needed.

| Script | What it does |
|---|---|
| `import_to_mealie.js` | Bulk one-way import of all GCal events into Mealie (historical backfill) |
| `cleanup_mealie.js` | **Destructive** — wipes all meal plans and recipes from Mealie |
| `delete_duplicates.js` | Removes recipes with names ending in `(1)` (scraping duplicates) |
| `clean_unnamed.js` | Deletes "Unnamed Meal" events from Google Calendar |
| `nuke_google_junk.js` | Also deletes "Unnamed Meal" junk events from GCal |
| `fix_links.js` | Migrates old `/recipe/` URL paths to `/g/home/r/` in GCal event descriptions |

## Configuration

All scripts read config from the same places:

- **Mealie API key**: `/usr/local/bin/common_keys.txt` (line matching `MEALIE_API_KEY=...`)
- **Mealie URL**: `http://127.0.0.1:9925` (hardcoded, assumes local access)
- **Mealie public URL**: `https://mealie.wooller.com` (used in GCal event links)
- **Google credentials**: `credentials.json` in the project root
- **Calendar ID**: Hardcoded in each script

## Files

```
sync_master.js          ← Main sync script (run by systemd)
daily_sync.js           ← Older/simpler bidirectional sync (superseded)
import_to_mealie.js     ← One-time bulk GCal → Mealie import
cleanup_mealie.js       ← Nuclear option: wipe Mealie clean
delete_duplicates.js    ← Remove duplicate recipes
clean_unnamed.js        ← Remove "Unnamed Meal" from GCal
nuke_google_junk.js     ← Remove "Unnamed Meal" from GCal (alternate)
fix_links.js            ← Fix old recipe URL paths in GCal
git_pull_install.sh     ← Deploy script (pull + restart service)
mealie-sync.service     ← Systemd service unit
meals.json              ← Sample meal data
index.js.bak            ← Old backup file
```
