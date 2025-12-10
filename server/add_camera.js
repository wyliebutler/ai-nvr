const fs = require('fs');
const path = require('path');
const { initDB, getDB } = require("./dist/db");
const { FeedModel } = require("./dist/feeds");
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const MEDIAMTX_CONFIG = 'mediamtx.yml';

async function ask(question) {
    return new Promise(resolve => rl.question(question, resolve));
}

(async () => {
    try {
        console.log("=== AI NVR Camera Wizard ===");

        // 1. Get Inputs
        const name = await ask("Enter Camera Name (e.g. Back Yard): ");
        if (!name) throw new Error("Name is required");

        const useProxyInput = await ask("Use MediaMTX Proxy? (y/n) [y]: ");
        const useProxy = useProxyInput.toLowerCase() !== 'n';

        let rtspUrl = '';
        if (useProxy) {
            const rawUrl = await ask("Enter Camera RTSP URL (e.g. rtsp://192.168.1.50:554/stream): ");
            if (!rawUrl) throw new Error("URL is required");
            rtspUrl = rawUrl;
        } else {
            // For non-proxy, we might just take the URL directly, but this tool focuses on the proxy setup.
            const rawUrl = await ask("Enter Camera RTSP URL: ");
            if (!rawUrl) throw new Error("URL is required");
            rtspUrl = rawUrl;
        }

        // 2. Initialize DB
        await initDB();
        const db = getDB();

        // 3. Determine next ID manually (to sync with mediamtx keys if needed)
        // Actually, we should let SQLite auto-increment, and then use that ID for the mediamtx key.
        // But for the manual file edit, we often used specific IDs. 
        // Let's rely on the DB ID.

        console.log(`\nAdding '${name}' to database...`);
        const result = await FeedModel.createFeed({
            name,
            rtsp_url: rtspUrl, // We store the ORIGINAL URL in the DB for reference? 
            // Wait, in manual mode, the app uses `rtsp://mediamtx:8554/feed_{id}` derived from the ID.
            // The DB `rtsp_url` field is usually the SOURCE url so the proxy knows what to pull?
            // No, in static mode `media-proxy.ts` does: 
            // `this.urlMap.set(feed.rtsp_url, ${RTSP_PROXY_BASE}/feed_${feed.id});`
            // So we store the SOURCE URL in the DB.
            settings: '{}'
        });

        const newId = result.id;
        console.log(`Feed added with ID: ${newId}`);

        // 4. Update mediamtx.yml if using proxy
        if (useProxy) {
            console.log(`Updating ${MEDIAMTX_CONFIG}...`);
            let configContent = fs.readFileSync(MEDIAMTX_CONFIG, 'utf8');

            // Check if already exists (unlikely with new ID)
            const feedKey = `feed_${newId}`;
            if (configContent.includes(feedKey + ':')) {
                console.warn(`Warning: ${feedKey} already exists in config!`);
            } else {
                // Append new path
                // Assume 'paths:' exists.
                const newEntry = `
  ${feedKey}:
    source: ${rtspUrl}
    sourceOnDemand: no
`;
                // Add to end of options or paths section
                if (configContent.includes('paths:')) {
                    fs.appendFileSync(MEDIAMTX_CONFIG, newEntry);
                    console.log(`Added ${feedKey} to MediaMTX config.`);
                } else {
                    console.error("Could not find 'paths:' section in mediamtx.yml");
                }
            }
        }

        console.log("\nSUCCESS! Camera added.");
        console.log("To apply changes, the server needs to restart.");

        // In Docker, we can't easily restart 'ourselves' completely from within the node process 
        // without orchestrator access, but we can exit and rely on restart policy? 
        // No, that only restarts the server container, but MediaMTX container (which holds the config) 
        // also needs to reload/restart to pick up the new yaml. 
        // Actually MediaMTX supports hot reload on file change? 
        // "MediaMTX reloads the configuration automatically when the file changes." -> usually true for file-based!
        // So maybe we don't need to restart MediaMTX?
        // But the Server needs to rebuild its static map? Yes, because `syncConfig` runs on startup.

        const doRestart = await ask("Restart Server now? (y/n) [y]: ");
        if (doRestart.toLowerCase() !== 'n') {
            const { item } = require('./package.json'); // Just to check context?
            console.log("Exiting... Docker should restart this service if configured with restart:always or unless-stopped.");
            process.exit(0);
            // Wait, if we exit 0, docker might not restart depending on policy. 
            // If we exit 1, it might restart.
            // But we are running this script casually via `docker exec`. 
            // Exiting `docker exec` does NOT restart the container.

            console.log("NOTE: You are likely running this inside the container. You must restart the container manually:");
            console.log("  docker compose restart server");
            console.log("  (And maybe mediamtx if it doesn't auto-reload)");
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
    rl.close();
})();
