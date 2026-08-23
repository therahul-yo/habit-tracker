import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // IANA zone name, e.g. "Asia/Kolkata". Validated at the route boundary.
    timezone: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
