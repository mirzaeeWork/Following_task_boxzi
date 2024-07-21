import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';
import userRouter from '../routes/user.js';
import { UserResponseMessages } from '../utils/constants.js';
import { expect } from 'chai';
import Sinon from 'sinon';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { getSuccessResponse } from '../utils/HandleResponse.js';

const app = express();
app.use(bodyParser.json());
app.use('/api/users', userRouter);

// Ensure the error handling middleware is in place
app.use((err, req, res, next) => {
    res.status(err.status || 400).json({
        message: err.message,
        stack: err.stack
    });
});

describe('Create User', () => {
    it('should return 400 if username is less than 3 characters', async () => {
        const res = await request(app)
            .post('/api/users/create')
            .send({ username: 'ab' });

        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal(UserResponseMessages.ERROR_USER_NAME);
    });

    it('should return 400 if username already exists', async () => {
        Sinon.stub(User, 'findOne').resolves({ username: 'existingUser' });

        const res = await request(app)
            .post('/api/users/create')
            .send({ username: 'existingUser' });

        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal(UserResponseMessages.ERROR_EXIST_USER);

        User.findOne.restore();
    });

    it('should return 201 and create user if username is valid and does not exist', async () => {
        const mockUser = { _id: 'mockId', username: 'validusername' };
        Sinon.stub(User, 'findOne').resolves(null);
        Sinon.stub(User, 'create').resolves(mockUser);

        const res = await request(app)
            .post('/api/users/create')
            .send({ username: 'validusername' });

        expect(res.status).to.equal(201);
        expect(res.body.message).to.equal(UserResponseMessages.CREATED);
        expect(res.body.user).to.deep.equal(mockUser);

        User.findOne.restore();
        User.create.restore();
    });
});

describe('Follow User Controller', () => {
    let user1, user2, user3;
    const validObjectId = new mongoose.Types.ObjectId().toString();

    before(() => {
        // Create mock users
        user1 = { _id: validObjectId, followings: [], followers: [] };
        user2 = { _id: new mongoose.Types.ObjectId().toString(), followings: [], followers: [] };
        user3 = { _id: new mongoose.Types.ObjectId().toString(), followings: [], followers: [] };
    });

    afterEach(() => {
        Sinon.restore(); // Clean up any stubs or mocks
    });

    it('should return 400 if userId or followId is not valid', async () => {
        Sinon.stub(User, 'findOneAndUpdate')
            .onFirstCall().resolves(user1)
            .onSecondCall().resolves(user2);

        const res = await request(app)
            .post('/api/users/follow')
            .send({ userId: 'invalidId', followId: user2._id });

        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal(UserResponseMessages.ERROR_VALID_ID);
    });


    it('should return 400 if userId and followId are the same', async () => {
        Sinon.stub(User, 'findOneAndUpdate')
            .onFirstCall().resolves(user1)
            .onSecondCall().resolves(user2);

        const res = await request(app)
            .post('/api/users/follow')
            .send({ userId: user1._id, followId: user1._id });

        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal(UserResponseMessages.ERROR_IDS_SAME);
    });


    it('should return 400 if user update fails', async () => {
        Sinon.stub(User, 'findOneAndUpdate')
            .onFirstCall().resolves(null) // Fail the first update
            .onSecondCall().resolves(user2); // Second call is not reached due to the first failing

        const res = await request(app)
            .post('/api/users/follow')
            .send({ userId: user1._id, followId: user2._id });

        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal(UserResponseMessages.ERROR_UPDATE_FOLLOWING);
    });

    it('should return 400 if follow user update fails', async () => {
        Sinon.stub(User, 'findOneAndUpdate')
            .onFirstCall().resolves(user1) // Success for the first update
            .onSecondCall().resolves(null); // Fail the second update

        const res = await request(app)
            .post('/api/users/follow')
            .send({ userId: user1._id, followId: user2._id });

        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal(UserResponseMessages.ERROR_UPDATE_FOLLOWERS);
    });

    it('should successfully follow a user', async () => {
        Sinon.stub(User, 'findOneAndUpdate')
            .onFirstCall().resolves({ ...user1, followings: [{ followingId: user2._id, date: new Date() }] })
            .onSecondCall().resolves({ ...user2, followers: [{ followId: user1._id, date: new Date() }] });

        const res = await request(app)
            .post('/api/users/follow')
            .send({ userId: user1._id, followId: user2._id });

        expect(res.status).to.equal(200);
        expect(res.body.message).to.equal(UserResponseMessages.UPDATE_FOLLOW);
    });
});

describe('Unfollow User Controller', () => {
    let user1, user2;
    const validObjectId = new mongoose.Types.ObjectId().toString();

    before(() => {
        // Create mock users
        user1 = { _id: validObjectId, followings: [{ followingId: 'user2', date: new Date() }], followers: [] };
        user2 = { _id: new mongoose.Types.ObjectId().toString(), followings: [], followers: [{ followId: validObjectId, date: new Date() }] };
    });

    afterEach(() => {
        Sinon.restore(); // Clean up any stubs or mocks
    });

    it('should return 400 if userId or unfollowId is not valid', async () => {
        Sinon.stub(User, 'findOneAndUpdate');

        const res = await request(app)
            .post('/api/users/unfollow')
            .send({ userId: 'invalidId', unfollowId: user2._id });

        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal(UserResponseMessages.ERROR_VALID_ID);
    });

    it('should return 400 if userId and unfollowId are the same', async () => {
        Sinon.stub(User, 'findOneAndUpdate');

        const res = await request(app)
            .post('/api/users/unfollow')
            .send({ userId: user1._id, unfollowId: user1._id });

        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal(UserResponseMessages.ERROR_IDS_SAME);
    });

    it('should return 400 if user update fails', async () => {
        Sinon.stub(User, 'findOneAndUpdate').onFirstCall().resolves(null);

        const res = await request(app)
            .post('/api/users/unfollow')
            .send({ userId: user1._id, unfollowId: user2._id });

        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal(UserResponseMessages.ERROR_UPDATE_UNFOLLOWING);
    });

    it('should return 400 if unfollow user update fails', async () => {
        Sinon.stub(User, 'findOneAndUpdate').onFirstCall().resolves(user1)
            .onSecondCall().resolves(null);

        const res = await request(app)
            .post('/api/users/unfollow')
            .send({ userId: user1._id, unfollowId: user2._id });

        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal(UserResponseMessages.ERROR_UPDATE_UNFOLLOWERS);
    });

    it('should successfully unfollow a user', async () => {
        Sinon.stub(User, 'findOneAndUpdate')
            .onFirstCall().resolves({ ...user1, followings: [] }) // Simulate success for the first update
            .onSecondCall().resolves({ ...user2, followers: [] }); // Simulate success for the second update

        const res = await request(app)
            .post('/api/users/unfollow')
            .send({ userId: user1._id, unfollowId: user2._id });

        expect(res.status).to.equal(200);
        expect(res.body.message).to.equal(UserResponseMessages.UPDATE_UNFOLLOW);
    });
});

describe('Get Followers Count Daily Controller', () => {
    const validObjectId = new mongoose.Types.ObjectId().toString();
    const invalidObjectId = 'invalidId';

    before(() => {
        // Stub the User.aggregate method
        Sinon.stub(User, 'aggregate');
    });

    afterEach(() => {
        Sinon.restore(); // Clean up any stubs or mocks
    });

    it('should return 400 if userId is not valid', async () => {
        const res = await request(app)
            .get(`/api/users/${invalidObjectId}/followers/daily`);

        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal(UserResponseMessages.ERROR_VALID_ID);
    });

    it('should return 200 with daily counts if data is retrieved successfully', async () => {
        const dailyCounts = [
            { date: '2024-07-20', count: 10 },
            { date: '2024-07-21', count: 5 },
        ];

        Sinon.stub(User, 'aggregate').resolves(dailyCounts);

        const res = await request(app)
            .get(`/api/users/${validObjectId}/followers/daily`);

        expect(res.status).to.equal(200);
        expect(res.body.message).to.equal(UserResponseMessages.SHOW_FOLLOWERS);
        expect(res.body.user).to.deep.equal(dailyCounts);
    });

    it('should handle errors thrown by the database', async () => {
        Sinon.stub(User, 'aggregate').throws(new Error('Database Error'));

        const res = await request(app)
            .get(`/api/users/${validObjectId}/followers/daily`);

        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal('Database Error');
    });
});

describe('Get Common Followers Controller', () => {
    const validObjectId1 = new mongoose.Types.ObjectId().toString();
    const validObjectId2 = new mongoose.Types.ObjectId().toString();
    const validObjectId3 = new mongoose.Types.ObjectId().toString();
    const validObjectId4 = new mongoose.Types.ObjectId().toString();

    const invalidObjectId = 'invalidId';

    before(() => {
        // Stub the User methods
        Sinon.stub(User, 'findById');
        Sinon.stub(User, 'find');
    });

    afterEach(() => {
        Sinon.restore(); // Clean up any stubs or mocks
    });

    it('should return 400 if userId1 or userId2 is not valid', async () => {
        const res = await request(app)
            .get(`/api/users/mutual-followers/${invalidObjectId}/${validObjectId2}`);

        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal(UserResponseMessages.ERROR_VALID_ID);
    });

    it('should return 400 if userId1 and userId2 are the same', async () => {
        const res = await request(app)
            .get(`/api/users/mutual-followers/${validObjectId1}/${validObjectId1}`);

        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal(UserResponseMessages.ERROR_IDS_SAME);
    });

    it('should return 404 if one of the users is not found', async () => {
        Sinon.stub(User, 'findById')
        .onFirstCall().resolves(null)  // User1 پیدا نشد
        .onSecondCall().resolves({ followers: [] });  // User2 وجود دارد

    const res = await request(app)
        .get(`/api/users/mutual-followers/${validObjectId1}/${validObjectId2}`);

        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal(UserResponseMessages.NOT_FOUND);
    });

    it('should return 200 with empty list if no common followers', async () => {
        const followers1 = [{ followId: 'user1Id' }];
        const followers2 = [{ followId: 'user2Id' }];

        const user1 = { followers: followers1 };
        const user2 = { followers: followers2 };

        Sinon.stub(User, 'findById')
            .onFirstCall().resolves(user1)
            .onSecondCall().resolves(user2);

        Sinon.stub(User, 'find').resolves([]);

        const res = await request(app)
            .get(`/api/users/mutual-followers/${validObjectId1}/${validObjectId2}`);

        expect(res.status).to.equal(200);
        expect(res.body.message).to.equal(UserResponseMessages.COMMON_FOLLOWERS);
        expect(res.body.user).to.deep.equal([]);
    });


    it('should return 200 with common followers if data is retrieved successfully', async () => {
        const followers1 = [
            { followId: validObjectId2 },
            { followId: validObjectId3 }
        ];
        const followers2 = [
            { followId: validObjectId2 },
            { followId: validObjectId4 }
        ];

        const user1 = { followers: followers1 };
        const user2 = { followers: followers2 };

        const commonFollowersDetails = [
            { _id: validObjectId2, username: 'user2' }
        ];

        Sinon.stub(User, 'findById')
            .onFirstCall().resolves(user1)
            .onSecondCall().resolves(user2);

        Sinon.stub(User, 'find').resolves(commonFollowersDetails);

        const res = await request(app)
            .get(`/api/users/mutual-followers/${validObjectId1}/${validObjectId2}`);

        // console.log(res.body);

        expect(res.status).to.equal(200);
        expect(res.body.message).to.equal(UserResponseMessages.COMMON_FOLLOWERS);
        expect(res.body.user).to.deep.equal(commonFollowersDetails);

        // Restore the stubbed methods
        User.findById.restore();
        User.find.restore();
    });
});

describe('Get All Users Controller', () => {
    let findAggregateStub;

    before(() => {
        findAggregateStub = Sinon.stub(User, 'aggregate');
    });

    afterEach(() => {
        Sinon.restore();
    });

    it('should return 200 with users data when aggregate is successful', async () => {
        const mockUsers = [
            {
                _id: new mongoose.Types.ObjectId(),
                username: 'user1',
                followersDetails: [{ _id: new mongoose.Types.ObjectId(), username: 'follower1' }],
                followingsDetails: [{ _id: new mongoose.Types.ObjectId(), username: 'following1' }]
            }
        ];

        findAggregateStub.resolves(mockUsers);

        const res = await request(app)
            .get('/api/users/all')
            .expect(200);

        expect(res.body.message).to.deep.equal(UserResponseMessages.ALL_USER);
        expect(res.status).to.equal(200);
    });

});