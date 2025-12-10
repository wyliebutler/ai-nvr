import axios from 'axios';
import { Feed } from './feeds';

// MediaMTX API URL (internal docker network)
const MEDIAMTX_API = 'http://mediamtx:9997/v3';
const RTSP_PROXY_BASE = 'rtsp://mediamtx:8554';

export class MediaProxyService {
    private static instance: MediaProxyService;
    private urlMap: Map<string, string> = new Map();

    private constructor() { }

    public static getInstance(): MediaProxyService {
        if (!MediaProxyService.instance) {
            MediaProxyService.instance = new MediaProxyService();
        }
        return MediaProxyService.instance;
    }

    // Hardcoded absolute path for Docker environment
    private configPath = '/app/server/mediamtx.yml';

    public getProxyUrl(feed: Feed): string {
        // Return the proxied URL assuming static config exists
        const proxyUrl = `${RTSP_PROXY_BASE}/feed_${feed.id}`;
        this.urlMap.set(feed.rtsp_url, proxyUrl);
        return proxyUrl;
    }

    public getProxyUrlByOriginal(originalUrl: string): string | null {
        return this.urlMap.get(originalUrl) || null;
    }

    public async syncConfig(feeds: Feed[]) {
        console.log('MediaMTX proxy sync: Starting auto-heal check...');

        // 1. Populate internal map
        this.urlMap.clear();
        for (const feed of feeds) {
            const proxyUrl = `${RTSP_PROXY_BASE}/feed_${feed.id}`;
            this.urlMap.set(feed.rtsp_url, proxyUrl);
        }

        // 2. Auto-heal: Ensure all feeds exist in mediamtx.yml
        const fs = require('fs');

        if (!fs.existsSync(this.configPath)) {
            console.error(`MediaMTX config NOT FOUND at ${this.configPath}. Cannot sync.`);
            return;
        }

        try {
            const configContent = fs.readFileSync(this.configPath, 'utf8');
            let appendedCount = 0;

            for (const feed of feeds) {
                const feedKey = `feed_${feed.id}`;
                if (!configContent.includes(`${feedKey}:`)) {
                    console.log(`[Auto-Heal] Missing config for ${feedKey}. Adding now...`);
                    this.registerFeedInConfig(feed);
                    appendedCount++;
                }
            }

            if (appendedCount > 0) {
                console.log(`[Auto-Heal] Added ${appendedCount} missing feeds to config.`);
            } else {
                console.log('[Auto-Heal] All feeds present in config.');
            }

        } catch (error) {
            console.error('Failed to read/heal mediamtx.yml:', error);
        }
    }

    public registerFeedInConfig(feed: Feed) {
        const fs = require('fs');

        try {
            // Read fresh content in case of race conditions (though Node is single threaded)
            if (!fs.existsSync(this.configPath)) return;

            const configContent = fs.readFileSync(this.configPath, 'utf8');
            const feedKey = `feed_${feed.id}`;

            if (configContent.includes(`${feedKey}:`)) {
                // Double check to avoid duplicates
                return;
            }

            const newEntry = `
  ${feedKey}:
    source: ${feed.rtsp_url}
    sourceOnDemand: no
`;

            fs.appendFileSync(this.configPath, newEntry);
            console.log(`Successfully added ${feedKey} to mediamtx.yml`);

        } catch (error) {
            console.error('Failed to update mediamtx.yml:', error);
        }
    }
}
