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
        console.log('MediaMTX proxy configured for STATIC mode. Skipping API sync.');

        // Just populate the internal map so the rest of the app knows what to do
        this.urlMap.clear();
        for (const feed of feeds) {
            const proxyUrl = `${RTSP_PROXY_BASE}/feed_${feed.id}`;
            this.urlMap.set(feed.rtsp_url, proxyUrl);
        }
    }
}
