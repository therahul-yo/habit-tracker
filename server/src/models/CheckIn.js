import mongoose from 'mongoose';

const checkInSchema = new mongoose.Schema(
  {
    habitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // The user's LOCAL calendar day, "YYYY-MM-DD". Deliberately a string and
    // not a Date: the domain fact is "which day", not "which instant".
    localDay: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    // Kept only for auditing/backfill provenance; never used for streak math.
    createdAtUtc: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

// The database enforces "one check-in per habit per local day".
checkInSchema.index({ habitId: 1, localDay: 1 }, { unique: true });

export default mongoose.model('CheckIn', checkInSchema);
