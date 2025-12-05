// Use relative path so nginx proxies to the backend
const API_URL = '/api';

export const api = {
    async get(endpoint: string, token?: string, options: { suppressAuthError?: boolean } = {}) {
        const headers: any = { 'Content-Type': 'application/json' };
        const authToken = token || localStorage.getItem('token');
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

        const res = await fetch(`${API_URL}${endpoint}`, { headers });
        if (res.status === 401) {
            if (!options.suppressAuthError) {
                window.dispatchEvent(new Event('auth:unauthorized'));
            }
            throw new Error('Unauthorized');
        }
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async post(endpoint: string, body: any, token?: string, options: { suppressAuthError?: boolean } = {}) {
        const headers: any = { 'Content-Type': 'application/json' };
        const authToken = token || localStorage.getItem('token');
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        if (res.status === 401) {
            if (!options.suppressAuthError) {
                window.dispatchEvent(new Event('auth:unauthorized'));
            }
            throw new Error('Unauthorized');
        }
        if (!res.ok) {
            const error = await res.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || 'Request failed');
        }
        return res.json();
    },

    async put(endpoint: string, body: any, token?: string, options: { suppressAuthError?: boolean } = {}) {
        const headers: any = { 'Content-Type': 'application/json' };
        const authToken = token || localStorage.getItem('token');
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(body),
        });
        if (res.status === 401) {
            if (!options.suppressAuthError) {
                window.dispatchEvent(new Event('auth:unauthorized'));
            }
            throw new Error('Unauthorized');
        }
        if (!res.ok) {
            const error = await res.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || 'Request failed');
        }
        return res.json();
    },

    async delete(endpoint: string, token?: string, options: { suppressAuthError?: boolean } = {}) {
        const headers: any = { 'Content-Type': 'application/json' };
        const authToken = token || localStorage.getItem('token');
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'DELETE',
            headers,
        });
        if (res.status === 401) {
            if (!options.suppressAuthError) {
                window.dispatchEvent(new Event('auth:unauthorized'));
            }
            throw new Error('Unauthorized');
        }
        if (!res.ok) {
            const error = await res.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || 'Request failed');
        }
        return res.json();
    }
};
