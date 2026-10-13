import mongoose from 'mongoose';
const claimSchema = new mongoose.Schema({
  report: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', required: true, index: true },
  claimant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true, trim: true, maxlength: 1000 },
  contact: { type: String, required: true, trim: true, maxlength: 160 },
  status: { type: String, enum: ['pending','accepted','rejected'], default: 'pending', index: true }
}, { timestamps: true });
claimSchema.index({ report: 1, claimant: 1 }, { unique: true });
export default mongoose.model('Claim', claimSchema);
