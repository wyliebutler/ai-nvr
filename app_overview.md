# AI NVR Application Overview

## Introduction
This document provides a technical overview of the AI NVR (Network Video Recorder) application. It is designed to help developers understand the system architecture, key features, and codebase structure.

## Architecture
The application follows a client-server architecture, containerized using Docker.

### Tech Stack
*   **Frontend**: React, Vite, TailwindCSS
*   **Backend**: Node.js, Express
*   **Database**: SQLite
*   **Video Processing**: FFmpeg
*   **Authentication**: JWT, bcrypt
*   **Deployment**: Docker Compose

### Components

#### 1. Server (`/server`)
The backend handles video stream processing, motion detection, API requests, and data persistence.

*   **`src/index.ts`**: Entry point, initializes database, HTTP server, and WebSocket server.
*   **`src/detector.ts`**: Manages motion detection using FFmpeg. It analyzes video streams for scene changes and triggers notifications.
*   **`src/recorder.ts`**: Handles continuous video recording.
*   **`src/stream.ts`**: Manages WebSocket connections for live video streaming (MPEG-TS via JSMPEG).
*   **`src/auth.ts`**: Handles user authentication and role management (Admin/Viewer).
*   **`src/routes.ts`**: Defines REST API endpoints.
*   **`src/db.ts`**: SQLite database interface.

#### 2. Client (`/client`)
The frontend provides a responsive user interface for monitoring and configuration.

*   **`src/pages/Dashboard.tsx`**: Main view displaying live camera feeds and activity logs.
*   **`src/pages/SettingsPage.tsx`**: Configuration interface for cameras, email settings, and motion sensitivity.
*   **`src/pages/UsersPage.tsx`**: User management interface (Admin only).
*   **`src/context/AuthContext.tsx`**: Manages user session and role-based access control.
*   **`src/lib/api.ts`**: Wrapper for API requests.

## Key Features

### 1. Live Streaming
*   Real-time video streaming from RTSP sources.
*   Low-latency playback using WebSockets and JSMPEG.

### 2. Motion Detection
*   Analyzes video streams for significant scene changes.
*   **Sensitivity Control**: Adjustable sensitivity (Low, Medium, High) to reduce false alarms.
*   **Notifications**: Sends email alerts with snapshot attachments upon detection.

### 3. Recording
*   Continuous 24/7 recording of video feeds.
*   Automatic segmenting of video files.
*   Retention policy management (configurable hours).

### 4. User Management
*   **Role-Based Access Control (RBAC)**:
    *   **Admin**: Full system access (Settings, Users, Feeds).
    *   **Viewer**: Read-only access (Live View, Recordings).
*   Secure password hashing and JWT-based session management.

### 5. System Configuration
*   Web-based configuration for RTSP feeds.
*   SMTP settings for email notifications.
*   System-wide settings persistence using SQLite.

## Deployment
The system is deployed using `docker-compose`.
*   **`deploy.ps1`**: PowerShell script to build, package, and deploy the application to a remote server via SSH.
*   **Data Persistence**: Database and recordings are mounted as volumes to ensure data survives container restarts.

## Getting Started for Developers
1.  **Prerequisites**: Node.js, Docker, FFmpeg (optional for local dev).
2.  **Install Dependencies**: `npm install` in both `client` and `server` directories.
3.  **Run Locally**:
    *   Server: `npm run dev` in `/server` (Port 7000)
    *   Client: `npm run dev` in `/client` (Port 3000)
4.  **Build**: `docker compose build`

## Future Improvements
*   Object detection (Person/Vehicle) using TensorFlow.js or similar.
*   Cloud storage integration for off-site backups.
*   Mobile-responsive layout optimizations.
