# AI NVR System

A self-hosted Network Video Recorder (NVR) with AI-powered motion detection, email notifications, and local recording management.

## Features

- **Live Streaming**: View RTSP streams from your IP cameras.
- **Motion Detection**: AI-based motion detection with adjustable sensitivity (Low, Medium, High, Very Low).
- **Notifications**: Email alerts with snapshots when motion is detected.
- **Recording**: Continuous or event-based recording with automatic cleanup (24-hour retention).
- **Activity Log**: Paginated log of all system events (motion, errors, system status).
- **User Management**: Role-based access control (Admin/Viewer).

## Tech Stack

- **Frontend**: React, Vite, TailwindCSS
- **Backend**: Node.js, Express, SQLite
- **Video Processing**: FFmpeg
- **Deployment**: Docker & Docker Compose

## Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)

## Setup

### Using Docker (Recommended)

1.  Clone the repository:
    ```bash
- **Password**: `admin123`

> [!IMPORTANT]
> Please change this password immediately after logging in.

### Local Development

1.  **Server**:
    ```bash
    cd server
    npm install
    npm run dev
    ```
2.  **Client**:
    ```bash
    cd client
    npm install
    npm run dev
    ```

## Configuration

- **Motion Sensitivity**: Adjust in the Settings page.
- **Email Settings**: Configure SMTP details in the Settings page.
- **Log Retention**: Logs and recordings are automatically cleaned up after 24 hours.

## License

[MIT](LICENSE)
