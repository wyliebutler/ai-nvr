# AI NVR Code Review: Feed Logic & Architecture

**Date:** 2025-12-10
**Focus:** Feed Management, MediaMTX Integration, and Scalability
**Status:** Critical Issues Identified

## 1. System Overview
The current system operates in a **"Static/Manual" mode**.
- **Source of Truth:** `mediamtx.yml` (Manual Configuration).
- **Secondary State:** SQLite Database (UI display & settings).
- **Integration:** The Node.js Server reads the DB to show feeds in the UI, but it *assumes* the MediaMTX proxy is configured to match via `feed_{id}` keys.

## 2. Identified Issues

### 🔴 Critical: The "Add Camera" Wizard is Broken by Design
The `add_camera.js` script was designed to automate adding feeds, but it fails due to **Docker Container Isolation**.
- **The Problem:** The script runs inside the `server` container. It attempts to edit `mediamtx.yml`.
- **The Reality:** `mediamtx.yml` is mounted *only* to the `mediamtx` container, not the `server` container.
- **Result:** The script configures the Database correctly, but writes the YAML config to a temporary, invisible location inside the `server` container. The `mediamtx` container (and the actual video proxy) never sees this change.
- **Why it seemed to work once:** We likely added the feed manually or edited the file on the host during debugging.

### 🔴 Critical: Deployment Overwrites Configuration
The `deploy.ps1` script copies the *local* `mediamtx.yml` from your development machine to the server every time you deploy.
- **The Problem:** If you (or a script) modify the configuration on the *server* (e.g., adding a new camera), the next deployment from your local machine will **overwrite** the server's file with your local (older) copy.
- **Result:** New cameras disappear or break after every deployment.

### ⚠️ High Risk: ID Collisions & "Ghost" Feeds
The user reported: *"A newly added feed messes another feed."*
- **Mechanism:** The `add_camera.js` script simply appends to the YAML file:
  ```yaml
  feed_13:
    source: ...
  ```
- **The Conflict:** If `feed_13` already exists in the file (e.g., manually added previously), appending a duplicate key is invalid YAML or undefined behavior. MediaMTX likely loads one and ignores the other, or crashes.
- **Sequence Drift:** The Database `AUTOINCREMENT` ID might generate an ID (e.g., `7`) that you have already manually used for a specific camera in the YAML. The script will then create a *second* `feed_7` entry, hijacking the existing stream.

### ⚠️ Medium Risk: No Validation Sync
There is no mechanism ensuring the Database and `mediamtx.yml` stay in sync.
- You can have a feed in the DB (Green "Active" in UI) that doesn't exist in the Proxy (White Screen).
- You can have a feed in the Proxy that doesn't exist in the DB (Invisible in UI).

## 3. Data Flow Diagram (Current vs. Broken)

```mermaid
graph TD
    User[User] -->|Run Script| Server[Server Container]
    Server -->|Write ID to| DB[(SQLite)]
    Server --x|Attempts to Write| Config[mediamtx.yml]
    
    subgraph Host System
        RealConfig[mediamtx.yml (Host)]
    end
    
    subgraph MediaMTX Container
        Proxy[MediaMTX Service]
        RealConfig -->|Mounted Read/Write| Proxy
    end
    
    Server --x|Cannot Access| RealConfig
```

## 4. Recommendations & Fixes

### A. Immediate Fix (The "Patch")
1. **Mount Config:** Update `docker-compose.yml` to mount `./mediamtx.yml:/app/server/mediamtx.yml`. This allows the server script to actually edit the file the proxy uses.
2. **Prevent Overwrites:** Stop `deploy.ps1` from overwriting `config` files if they exist, or move "Data" (Config/DB) to a persistent volume that isn't part of the code deployment.

### B. Strategic Fix (The "Correct Way")
Switch to **Dynamic API-based Configuration**.
- Instead of editing a text file, the Server should use the MediaMTX API (`POST /v3/config/paths/add`).
- **Benefit:** No file editing, no restarts required, immediate feedback if an ID exists.
- **Blocker:** We previously faced Authentication issues with the API. We should solve those (likely just correct `apiUser/apiPassword` formatting) rather than relying on brittle text file editing.

## 5. Proposed Action Plan
1. **Discuss:** Confirm if you want to fix the "File" approach or retry the "API" approach.
2. **Resolve Bug:** Remove any duplicate/conflicting IDs from the manual config.
3. **Implement:** Update `docker-compose.yml` to share the config file properly.
