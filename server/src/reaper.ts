import { exec } from 'child_process';
import util from 'util';
import { DetectorManager } from './detector';
import { RecorderManager } from './recorder';
import { logger } from './utils/logger';

const execAsync = util.promisify(exec);
const reaperLogger = logger.child({ module: 'reaper' });

export class ZombieReaper {
    private static instance: ZombieReaper;
    private isRunning: boolean = false;

    private constructor() {
        // Run immediately on start, then every 5 minutes
        this.reap();
        setInterval(() => this.reap(), 5 * 60 * 1000);
    }

    public static getInstance(): ZombieReaper {
        if (!ZombieReaper.instance) {
            ZombieReaper.instance = new ZombieReaper();
        }
        return ZombieReaper.instance;
    }

    public async reap() {
        if (this.isRunning) return;
        this.isRunning = true;

        try {
            // Get all ffmpeg PIDs running on the system
            // ps -eo pid,comm on Linux shows PID and command name
            // We use 'pgrep -f ffmpeg' or similar, but let's stick to ps for better compat in some docker containers
            // Actually 'ps -eo pid,args' gives full command which is safer to identify our ffmpegs
            const { stdout } = await execAsync('ps -eo pid,args');
            const lines = stdout.split('\n');

            const osPids: number[] = [];
            for (const line of lines) {
                if (line.includes('ffmpeg') && !line.includes('defunct')) {
                    const parts = line.trim().split(/\s+/);
                    const pid = parseInt(parts[0], 10);
                    if (!isNaN(pid)) {
                        osPids.push(pid);
                    }
                }
            }

            // Get Allowlist
            const detectorPids = DetectorManager.getInstance().getActivePids();
            const recorderPids = RecorderManager.getInstance().getActivePids();
            const allowedPids = new Set([...detectorPids, ...recorderPids]);

            // Find Zombies
            const zombies = osPids.filter(pid => !allowedPids.has(pid));

            if (zombies.length > 0) {
                reaperLogger.warn(`Found ${zombies.length} zombie ffmpeg processes. Terminating...`);
                for (const pid of zombies) {
                    try {
                        // Current process PID check (don't kill self if we were ffmpeg... unlikely but safe)
                        if (pid === process.pid) continue;

                        reaperLogger.info({ pid }, `Killing zombie process`);
                        process.kill(pid, 'SIGKILL');
                    } catch (e: any) {
                        if (e.code !== 'ESRCH') {
                            reaperLogger.error({ pid, err: e }, 'Failed to kill zombie');
                        }
                    }
                }
            } else {
                reaperLogger.debug('No zombies found. System clean.');
            }

        } catch (error) {
            // If ps fails (e.g. windows dev env), just log it
            if (process.platform === 'win32') {
                reaperLogger.debug('Skipping zombie reap on Windows (ps command differs)');
            } else {
                reaperLogger.error({ err: error }, 'Reaper failed to scan processes');
            }
        } finally {
            this.isRunning = false;
        }
    }
}
