import mongoose from 'mongoose';
const reportSchema = new mongoose.Schema({
  type: { type: String, enum: ['lost', 'found'], required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, required: true, trim: true, maxlength: 1200 },
  category: { type: String, required: true, enum: ['Electronics','Bags & Wallets','ID Cards','Books & Notes','Keys','Clothing','Accessories','Water Bottles','Other'], index: true },
  location: { type: String, required: true, trim: true, maxlength: 160 },
  itemDate: { type: Date, required: true },
  imageUrl: { type: String, trim: true, default: '' },
  contactPreference: { type: String, enum: ['in-app', 'email'], default: 'in-app' },
  status: { type: String, enum: ['open','resolved'], default: 'open', index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }
}, { timestamps: true });
reportSchema.index({ title: 'text', description: 'text', location: 'text' });
export default mongoose.model('Report', reportSchema);
