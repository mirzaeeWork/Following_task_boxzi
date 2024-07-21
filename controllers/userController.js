import User from '../models/User.js';
import mongoose from 'mongoose';
import { UserResponseMessages } from '../utils/constants.js';
import { getSuccessResponse } from '../utils/HandleResponse.js';

/**
 * This function handles the creation of a new user.
 * It extracts the username from the request body, validates its length,
 * creates a new user in the database, and sends a success response with the user's details.
 * If an error occurs, it forwards the error to the error handling middleware.
 */
export const createUser = async (req, res, next) => {
    try {
        const { username } = req.body;

        if (username.length < 3)  throw new Error(UserResponseMessages.ERROR_USER_NAME);

        const existUser=await User.findOne({username})
        if(existUser) throw new Error(UserResponseMessages.ERROR_EXIST_USER);

        const user = await User.create({ username });

        res.status(201).json(getSuccessResponse(201, UserResponseMessages.CREATED, user));
    } catch (err) {
        next(err);
    }
};

/**
 * This function retrieves details of all users.
 * It performs an aggregation on the User collection to join follower and following details
 * and then projects the required fields. The aggregated data is sent back in a success response.
 * If an error occurs, it forwards the error to the error handling middleware.
 */
export const getAllUsers = async (req, res, next) => {
    try {
        const users = await User.aggregate([
            {
                $lookup: {
                    from: 'users',
                    let: { followerIds: '$followers.followId' },
                    pipeline: [
                        { $match: { $expr: { $in: ['$_id', '$$followerIds'] } } },
                        { $project: { _id: 1, username: 1 } }
                    ],
                    as: 'followersDetails'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    let: { followingIds: '$followings.followingId' },
                    pipeline: [
                        { $match: { $expr: { $in: ['$_id', '$$followingIds'] } } },
                        { $project: { _id: 1, username: 1 } }
                    ],
                    as: 'followingsDetails'
                }
            },
            {
                $project: {
                    _id: 1,
                    username: 1,
                    followersDetails: 1,
                    followingsDetails: 1
                }
            }
        ]);

        res.status(200).json(getSuccessResponse(200, UserResponseMessages.ALL_USER, users));
    } catch (err) {
        next(err);
    }
};

/**
 * This function handles the following of a user by another user.
 * It validates the userId and followId, ensures they are not the same,
 * updates the followings of the user initiating the follow, 
 * updates the followers of the user being followed, 
 * and sends a success response. 
 * If any error occurs, it forwards the error to the error handling middleware.
 */
export const followUser = async (req, res, next) => {
    try {
        const { userId, followId } = req.body;

        if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(followId)) {
            throw new Error(UserResponseMessages.ERROR_VALID_ID);
        }

        if (userId === followId) {
            throw new Error(UserResponseMessages.ERROR_IDS_SAME);
        }

        const userUpdateResult = await User.findOneAndUpdate(
            { _id: userId, 'followings.followingId': { $ne: followId } },
            {
                $push: {
                    followings: { followingId: followId, date: new Date() }
                }
            },
            { new: true }
        );

        if (!userUpdateResult) {
            throw new Error(UserResponseMessages.ERROR_UPDATE_FOLLOWING);
        }

        const followUserUpdateResult = await User.findOneAndUpdate(
            { _id: followId, 'followers.followId': { $ne: userId } },
            {
                $push: {
                    followers: { followId: userId, date: new Date() }
                }
            },
            { new: true }
        );

        if (!followUserUpdateResult) {
            throw new Error(UserResponseMessages.ERROR_UPDATE_FOLLOWERS);
        }

        res.status(200).json(getSuccessResponse(200, UserResponseMessages.UPDATE_FOLLOW));
    } catch (err) {
        next(err);
    }
};

/**
 * This function handles the unfollowing of a user by another user.
 * It validates the userId and unfollowId, ensures they are not the same,
 * updates the followings of the user initiating the unfollow by removing the unfollowId,
 * updates the followers of the user being unfollowed by removing the userId,
 * and sends a success response.
 * If any error occurs, it forwards the error to the error handling middleware.
 */
export const unfollowUser = async (req, res, next) => {
    try {
        const { userId, unfollowId } = req.body;

        if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(unfollowId)) {
            throw new Error(UserResponseMessages.ERROR_VALID_ID);
        }

        if (userId === unfollowId) {
            throw new Error(UserResponseMessages.ERROR_IDS_SAME);
        }

        const userUpdateResult = await User.findOneAndUpdate(
            { _id: userId, 'followings.followingId': unfollowId },
            {
                $pull: { followings: { followingId: unfollowId } },
            },
            { new: true }
        );

        if (!userUpdateResult) {
            throw new Error(UserResponseMessages.ERROR_UPDATE_UNFOLLOWING);
        }

        const unfollowUserUpdateResult = await User.findOneAndUpdate(
            { _id: unfollowId, 'followers.followId': userId },
            { $pull: { followers: { followId: userId } } },
            { new: true }
        );

        if (!unfollowUserUpdateResult) {
            throw new Error(UserResponseMessages.ERROR_UPDATE_UNFOLLOWERS);
        }

        res.status(200).json(getSuccessResponse(200, UserResponseMessages.UPDATE_UNFOLLOW));
    } catch (err) {
        next(err);
    }
};

/**
 * This function retrieves the daily follower counts for a specific user.
 * It validates the userId, performs an aggregation on the User collection to calculate
 * the number of followers per day, and sends the result in a success response.
 * If any error occurs, it forwards the error to the error handling middleware.
 */
export const getFollowersCountDaily = async (req, res, next) => {
    try {
        const { userId } = req.params;

        if (!mongoose.isValidObjectId(userId)) {
            throw new Error(UserResponseMessages.ERROR_VALID_ID);
        }

        const dailyCounts = await User.aggregate([
            { $match: { _id: mongoose.Types.ObjectId.createFromHexString(userId) } },
            { $unwind: '$followers' },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$followers.date' } }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.date': 1 } },
            {
                $project: {
                    date: '$_id.date',
                    count: 1,
                    _id: 0
                }
            }
        ]);

        res.status(200).json(getSuccessResponse(200, UserResponseMessages.SHOW_FOLLOWERS, dailyCounts));
    } catch (err) {
        next(err);
    }
};

/**
 * This function retrieves the common followers between two users.
 * It validates the user IDs, checks they are not the same,
 * fetches the followers of both users, determines the common followers,
 * retrieves the details of these common followers, and sends the result in a success response.
 * If any error occurs, it forwards the error to the error handling middleware.
 */
export const getCommonFollowers = async (req, res, next) => {
    try {
        const { userId1, userId2 } = req.params;

        if (!mongoose.isValidObjectId(userId1) || !mongoose.isValidObjectId(userId2)) {
            throw new Error(UserResponseMessages.ERROR_VALID_ID);
        }

        if (userId1 === userId2) {
            throw new Error(UserResponseMessages.ERROR_IDS_SAME);
        }

        const user1 = await User.findById(userId1, 'followers');
        const user2 = await User.findById(userId2, 'followers');
        
        if (!user1 || !user2) {
            throw new Error(UserResponseMessages.NOT_FOUND);
        }

        const followers1 = user1.followers.map(f => f.followId.toString());
        const followers2 = user2.followers.map(f => f.followId.toString());

        const commonFollowers = followers1.filter(f => followers2.includes(f));

        const commonFollowersDetails = await User.find({
            _id: { $in: commonFollowers }
        }, 'username');

        res.status(200).json(getSuccessResponse(200, UserResponseMessages.COMMON_FOLLOWERS, commonFollowersDetails));
    } catch (err) {
        next(err);
    }
};
