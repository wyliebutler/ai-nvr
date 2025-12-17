import { DetectorManager } from '../detector';
import { FeedModel } from '../feeds';
import { SettingsModel } from '../settings';
import { MediaProxyService } from '../media-proxy';
import nodemailer from 'nodemailer';
import ffmpeg from 'fluent-ffmpeg';

jest.mock('../feeds');
jest.mock('../settings');
jest.mock('nodemailer');
jest.mock('fluent-ffmpeg', () => {
    return jest.fn().mockReturnValue({
        input: jest.fn().mockReturnThis(),
        inputOptions: jest.fn().mockReturnThis(),
        outputOptions: jest.fn().mockReturnThis(),
        output: jest.fn().mockReturnThis(),
        on: jest.fn().mockReturnThis(),
        run: jest.fn(),
        kill: jest.fn(),
        ffmpegProc: { pid: 12345 }
    });
});
jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn(),
        fatal: jest.fn(),
    }
}));

describe('DetectorManager Smoke Test', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        (FeedModel.getAllFeeds as jest.Mock).mockResolvedValue([]);
        (SettingsModel.getAllSettings as jest.Mock).mockResolvedValue({});
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('loads the module successfully', () => {
        expect(DetectorManager).toBeDefined();
    });

    it('initializes successfully', async () => {
        const mockProxy = {
            getProxyUrl: jest.fn(),
            syncConfig: jest.fn(),
        } as unknown as MediaProxyService;

        const detector = new DetectorManager(mockProxy);
        expect(detector).toBeDefined();
    });

    it('resolves correct URL for FILE', () => {
        const mockProxy = {
            getProxyUrl: jest.fn(),
            getProxyUrlByOriginal: jest.fn(),
            syncConfig: jest.fn(),
            registerFeedInConfig: jest.fn(),
            updateFeedInConfig: jest.fn(),
            removeFeedFromConfig: jest.fn(),
        } as unknown as MediaProxyService;

        const detector = new DetectorManager(mockProxy);
        const feed = { id: 2, rtsp_url: 'file:///path/to/video.mp4' };

        const url = (detector as any).resolveUrl(feed);
        expect(url).toBe('/path/to/video.mp4');
        expect(mockProxy.getProxyUrl).not.toHaveBeenCalled();
    });

    it('resolves correct URL for RTSP', () => {
        const mockProxy = {
            getProxyUrl: jest.fn().mockReturnValue('rtsp://proxied'),
            getProxyUrlByOriginal: jest.fn(),
            syncConfig: jest.fn(),
            registerFeedInConfig: jest.fn(),
            updateFeedInConfig: jest.fn(),
            removeFeedFromConfig: jest.fn(),
        } as unknown as MediaProxyService;

        const detector = new DetectorManager(mockProxy);
        const feed = { id: 1, rtsp_url: 'rtsp://cam1' };

        const url = (detector as any).resolveUrl(feed);
        expect(url).toBe('rtsp://proxied');
        expect(mockProxy.getProxyUrl).toHaveBeenCalledWith(feed);
    });

    it('starts detection for a feed', async () => {
        const mockFeed = { id: 1, name: 'Test Cam', rtsp_url: 'rtsp://test' };
        (FeedModel.getAllFeeds as jest.Mock).mockResolvedValue([mockFeed]);

        const mockProxy = {
            getProxyUrl: jest.fn().mockReturnValue('rtsp://proxy'),
            getProxyUrlByOriginal: jest.fn(),
            syncConfig: jest.fn(),
            registerFeedInConfig: jest.fn(),
            updateFeedInConfig: jest.fn(),
            removeFeedFromConfig: jest.fn(),
        } as unknown as MediaProxyService;

        const detector = new DetectorManager(mockProxy);

        // We can call syncDetectors directly if it was public, or force cast it
        await (detector as any).syncDetectors();

        // Expect ffmpeg to have been called with the proxied URL
        expect(ffmpeg).toHaveBeenCalledWith('rtsp://proxy');
    });
});
