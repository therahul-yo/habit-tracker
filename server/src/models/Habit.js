import mongoose from 'mongoose';

const habitSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

// A user cannot have two habits with the same name.
habitSchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.model('Habit', habitSchema);
