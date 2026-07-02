import express from 'express';
import { protectRoute } from '../middlewares/auth.middleware.js';
import { getConversationsForSidebar, getMessages, getUsersForSidebar, sendMessage } from '../controllers/massage.controller.js';
import { uploadAny } from '../middlewares/upload.middleware.js';
 
const router = express.Router();

router.get('/users', protectRoute, getUsersForSidebar );
router.get('/conversations', protectRoute, getConversationsForSidebar);
router.get('/:id', protectRoute, getMessages);
router.post('/send/:id', protectRoute, uploadAny, sendMessage);

export default router;