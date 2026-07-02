import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import authRoutes from './routes/authRoutes';
import friendRoutes from './routes/friendRoutes';
import photoRoutes from './routes/photoRoutes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Automatic folder creation on startup to prevent Multer errors
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Enable CORS for all origins to ensure LAN device testing runs smoothly without policy blocks
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Serve static upload folder
app.use('/uploads', express.static(uploadDir));

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/photos', photoRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is healthy' });
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`Locket Clone server is running on port ${PORT}`);
});
