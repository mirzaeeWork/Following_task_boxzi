import express from 'express';
import { createUser, followUser, getAllUsers, getCommonFollowers, getFollowersCountDaily, unfollowUser } from '../controllers/userController.js';

const router = express.Router();

router.post('/create', createUser);
router.post('/follow', followUser);
router.post('/unfollow', unfollowUser);
router.get('/all',getAllUsers);
router.get('/:userId/followers/daily', getFollowersCountDaily);
router.get('/mutual-followers/:userId1/:userId2', getCommonFollowers);

export default router;
