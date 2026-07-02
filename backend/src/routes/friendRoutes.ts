import { Router } from 'express';
import {
  sendFriendRequest,
  respondToRequest,
  getFriends,
  getPendingRequests,
  searchUsers
} from '../controllers/friendController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Apply auth middleware to all friends-related routes
router.use(authenticateToken);

router.post('/request', sendFriendRequest);
router.post('/respond', respondToRequest);
router.get('/', getFriends);
router.get('/pending', getPendingRequests);
router.get('/search', searchUsers);

export default router;
