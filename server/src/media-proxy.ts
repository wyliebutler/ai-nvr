import axios from 'axios';
import { Feed } from './feeds';
import yaml from 'js-yaml';

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

        // 2. Auto-heal: Ensure all feeds exist in mediamtx.yml AND remove ghosts
        const fs = require('fs');

        if (!fs.existsSync(this.configPath)) {
            console.error(`MediaMTX config NOT FOUND at ${this.configPath}. Cannot sync.`);
            return;
        }

        try {
            const configContent = fs.readFileSync(this.configPath, 'utf8');
            const config: any = yaml.load(configContent) || {};
            let changeCount = 0;
            let modified = false;

            // Ensure valid structure
            if (!config.paths) config.paths = {};
            // Ensure api is boolean true (avoid string 'yes' issue)
            config.api = true;

            const validFeedKeys = new Set(feeds.map(f => `feed_${f.id}`));

            // A. Add missing feeds
            for (const feed of feeds) {
                const feedKey = `feed_${feed.id}`;
                if (!config.paths[feedKey]) {
                    console.log(`[Auto-Heal] Missing config for ${feedKey}. Adding now...`);
                    config.paths[feedKey] = {
                        source: feed.rtsp_url,
                        sourceOnDemand: false
                    };
                    changeCount++;
                    modified = true;
                } else if (config.paths[feedKey].source !== feed.rtsp_url || config.paths[feedKey].sourceOnDemand !== false) {
                    // Update stale URL or fix sourceOnDemand type
                    console.log(`[Auto-Heal] Stale config for ${feedKey}. Updating...`);
                    config.paths[feedKey].source = feed.rtsp_url;
                    config.paths[feedKey].sourceOnDemand = false;
                    changeCount++;
                    modified = true;
                }
            }

            // B. Remove ghost feeds (only those following the feed_XYZ pattern)
            for (const key of Object.keys(config.paths)) {
                if (key.startsWith('feed_') && !validFeedKeys.has(key)) {
                    console.log(`[Auto-Heal] Found ghost feed ${key}. Removing...`);
                    delete config.paths[key];
                    changeCount++;
                    modified = true;
                }
            }

            if (modified) {
                const newYaml = yaml.dump(config, { indent: 2 });
                fs.writeFileSync(this.configPath, newYaml, 'utf8');
                console.log(`[Auto-Heal] Applied ${changeCount} changes to config and saved.`);

                // Trigger reload
                this.restartMediaMtxContainer().catch(err => {
                    console.error(`[Docker] Failed to restart MediaMTX container:`, err.message);
                });
            } else {
                console.log('[Auto-Heal] Config is in sync.');
            }

        } catch (error) {
            console.error('Failed to read/heal mediamtx.yml:', error);
        }
    }

    public registerFeedInConfig(feed: Feed) {
        this.updateConfig((config) => {
            const feedKey = `feed_${feed.id}`;
            if (config.paths && config.paths[feedKey]) {
                return false; // Already exists, no change (use updateFeedInConfig for updates)
            }
            if (!config.paths) config.paths = {};

            config.paths[feedKey] = {
                source: feed.rtsp_url,
                sourceOnDemand: false
            };
            console.log(`Successfully added ${feedKey} to mediamtx.yml`);
            return true;
        });
    }

    public updateFeedInConfig(feed: Feed) {
        this.updateConfig((config) => {
            const feedKey = `feed_${feed.id}`;
            if (!config.paths) config.paths = {};

            // Always overwrite to ensure latest URL
            config.paths[feedKey] = {
                source: feed.rtsp_url,
                sourceOnDemand: false
            };
            console.log(`Successfully updated ${feedKey} in mediamtx.yml`);
            return true;
        });
    }

    public removeFeedFromConfig(feedId: number) {
        this.updateConfig((config) => {
            const feedKey = `feed_${feedId}`;
            if (config.paths && config.paths[feedKey]) {
                delete config.paths[feedKey];
                console.log(`Successfully removed ${feedKey} from mediamtx.yml`);
                return true;
            }
            return false;
        });
    }

    private updateConfig(modifier: (config: any) => boolean) {
        const fs = require('fs');
        try {
            if (!fs.existsSync(this.configPath)) return;

            const configContent = fs.readFileSync(this.configPath, 'utf8');
            const config: any = yaml.load(configContent) || {};

            const modified = modifier(config);

            if (modified) {
                const newYaml = yaml.dump(config, { indent: 2 });
                fs.writeFileSync(this.configPath, newYaml, 'utf8');

                this.restartMediaMtxContainer().catch(err => {
                    console.error(`[Docker] Failed to restart MediaMTX container:`, err.message);
                });
            }
        } catch (error) {
            console.error('Failed to update mediamtx.yml:', error);
        }
    }

    private async restartMediaMtxContainer() {
        const http = require('http');
        console.log('[Docker] Attempting to restart MediaMTX container...');

        // 1. Find the container ID
        const listOpts = {
            socketPath: '/var/run/docker.sock',
            path: '/containers/json?filters={"label":["com.docker.compose.service=mediamtx"]}',
            method: 'GET'
        };

        return new Promise<void>((resolve, reject) => {
            const req = http.request(listOpts, (res: any) => {
                let data = '';
                res.on('data', (chunk: any) => data += chunk);
                res.on('end', () => {
                    try {
                        const containers = JSON.parse(data);
                        if (!containers || containers.length === 0) {
                            console.warn('[Docker] MediaMTX container not found via socket (check filters).');
                            return resolve();
                        }

                        const containerId = containers[0].Id;
                        console.log(`[Docker] Found MediaMTX container: ${containerId.substring(0, 12)}. Restarting...`);

                        // 2. Restart it
                        const restartOpts = {
                            socketPath: '/var/run/docker.sock',
                            path: `/containers/${containerId}/restart`,
                            method: 'POST'
                        };

                        const restartReq = http.request(restartOpts, (rRes: any) => {
                            if (rRes.statusCode === 204) {
                                console.log('[Docker] MediaMTX restart triggered successfully.');
                            } else {
                                console.error(`[Docker] Restart failed with status: ${rRes.statusCode}`);
                            }
                            resolve();
                        });
                        restartReq.on('error', (e: any) => reject(e));
                        restartReq.end();

                    } catch (e) {
                        reject(e);
                    }
                });
            });
            req.on('error', (e: any) => reject(e));
            req.end();
        });
    }
}
