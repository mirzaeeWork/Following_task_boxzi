import mongoose from 'mongoose';

const { Schema } = mongoose;

const UserSchema = new Schema({
    username: { type: String, required: true, unique: true },
    followers: [{
        followId: { type: Schema.Types.ObjectId, ref: 'User' },
        date: { type: Date, default: Date.now },
    }],   // کسایی که کاربر را دنبال می‌کنند
    followings: [{
        followingId: { type: Schema.Types.ObjectId, ref: 'User' },
        date: { type: Date, default: Date.now },
    }],  // افرادی که کاربر آنها را دنبال می‌کند
}, { timestamps: true });

export default mongoose.model('User', UserSchema);
