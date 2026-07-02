import { Router } from 'express';
import { upload, uploadPhoto, getFeed, getMyPhotos } from '../controllers/photoController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Require JWT authorization for all photo endpoints
router.use(authenticateToken);

// Post routing with Multer middleware single file parsing
router.post('/upload', upload.single('photo'), uploadPhoto);

// Get routes
router.get('/feed', getFeed);
router.get('/me', getMyPhotos);

export default router;
