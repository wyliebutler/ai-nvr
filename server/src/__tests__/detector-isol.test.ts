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

describe('DetectorManager URL Resolution', () => {
    beforeEach(() => {
        (FeedModel.getAllFeeds as jest.Mock).mockResolvedValue([]);
        (SettingsModel.getAllSettings as jest.Mock).mockResolvedValue({});
    });

    it('resolves correct URL for RTSP', () => {
        const detector = DetectorManager.getInstance();
        const feed = { id: 1, rtsp_url: 'rtsp://cam1' };

        // Mock MediaProxy response using spyOn
        const mockFn = jest.fn().mockReturnValue('rtsp://proxied');
        jest.spyOn(MediaProxyService, 'getInstance').mockReturnValue({
            getProxyUrl: mockFn
        } as any);

        const url = (detector as any).resolveUrl(feed);
        expect(url).toBe('rtsp://proxied');
        expect(mockFn).toHaveBeenCalledWith(feed);
    });

    it('resolves correct URL for FILE', () => {
        const detector = DetectorManager.getInstance();
        const feed = { id: 2, rtsp_url: 'file:///path/to/video.mp4' };

        // Proxy should NOT be called
        const mockFn = jest.fn();
        jest.spyOn(MediaProxyService, 'getInstance').mockReturnValue({
            getProxyUrl: mockFn
        } as any);

        const url = (detector as any).resolveUrl(feed);
        expect(url).toBe('/path/to/video.mp4');
        expect(mockFn).not.toHaveBeenCalled();
    });
});
