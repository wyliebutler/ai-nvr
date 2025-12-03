export interface Feed {
    id: number;
    name: string;
    rtsp_url: string;
    settings?: string;
    created_at?: string;
}

export interface User {
    id: number;
    username: string;
    role: 'admin' | 'viewer';
}

export interface Recording {
    filename: string;
    url: string;
    timestamp: string;
}
