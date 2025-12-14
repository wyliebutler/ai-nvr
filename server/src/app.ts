
import express from 'express';
import cors from 'cors';
import path from 'path';
import router from './routes'; // Default export
import { initDB } from './db';
import { AuthModel } from './auth';

// Initialize Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Database
// initDB() called in index.ts and tests

// Mount Routes
app.use('/api', router);

// Serve static files for VOD
const RECORDINGS_DIR = path.resolve(__dirname, '../recordings');
app.use('/recordings', express.static(RECORDINGS_DIR));

// Admin user creation moved to index.ts

export { app };
