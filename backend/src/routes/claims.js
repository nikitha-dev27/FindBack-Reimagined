import { Router } from 'express';
import mongoose from 'mongoose';
import Claim from '../models/Claim.js';
import Report from '../models/Report.js';
import { requireAuth } from '../middleware/auth.js';
import { sendSms } from '../services/sms.js';
const router = Router();
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { reportId, message, contact } = req.body;
    if (!mongoose.isValidObjectId(reportId)) return res.status(400).json({ message: 'Choose a valid report.' });
    if (!String(message || '').trim() || !String(contact || '').trim()) return res.status(400).json({ message: 'Please provide identifying details and a way to contact you.' });
    const report = await Report.findById(reportId);
    if (!report || report.status !== 'open') return res.status(404).json({ message: 'This report is no longer available.' });
    if (String(report.owner) === String(req.user._id)) return res.status(400).json({ message: 'You cannot claim your own report.' });
    const claim = await Claim.create({ report: report._id, claimant: req.user._id, message: String(message).trim(), contact: String(contact).trim() });
    const owner = await (await import('../models/User.js')).default.findById(report.owner).select('name phone');
    if (owner?.phone) sendSms(owner.phone, `FindBack: A student submitted a private claim for your item \"${report.title}\". Sign in to FindBack to review it. Do not share verification codes.`).catch(err => console.error('SMS notification failed:', err.message));
    res.status(201).json({ claim: await claim.populate([{ path: 'report', select: 'title type category owner' }, { path: 'claimant', select: 'name email college' }]) });
  } catch (e) { if (e.code === 11000) return res.status(409).json({ message: 'You have already submitted a claim for this report.' }); next(e); }
});
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const claims = await Claim.find({ $or: [{ claimant: req.user._id }, { report: { $in: await Report.find({ owner: req.user._id }).distinct('_id') } }] }).populate('claimant','name email college phone').populate({ path: 'report', populate: { path: 'owner', select: 'name email college phone' } }).sort({ createdAt: -1 });
    const safeClaims = claims.map((claim) => { const data = claim.toObject(); const isReportOwner = String(data.report?.owner?._id || data.report?.owner) === String(req.user._id); if (data.status !== 'accepted') { if (isReportOwner) { delete data.contact; if (data.claimant) delete data.claimant.phone; } else if (data.report?.owner) { delete data.report.owner.phone; delete data.report.owner.email; } } return data; });
    res.json({ claims: safeClaims });
  } catch (e) { next(e); }
});
router.patch('/:id/status', requireAuth, async (req, res, next) => {
  try {
    if (!['accepted','rejected'].includes(req.body.status)) return res.status(400).json({ message: 'Status must be accepted or rejected.' });
    const claim = await Claim.findById(req.params.id).populate('report');
    if (!claim) return res.status(404).json({ message: 'Claim not found.' });
    if (String(claim.report.owner) !== String(req.user._id)) return res.status(403).json({ message: 'Only the report owner can review this claim.' });
    claim.status = req.body.status; await claim.save();
    const claimantUser = await (await import('../models/User.js')).default.findById(claim.claimant).select('name phone');
    if (claimantUser?.phone) sendSms(claimantUser.phone, `FindBack: Your claim for \"${claim.report.title}\" was ${req.body.status}. Sign in to FindBack to view the update and coordinate privately.`).catch(err => console.error('SMS notification failed:', err.message));
    res.json({ claim: await claim.populate([{ path: 'claimant', select: 'name email college' }, { path: 'report', populate: { path: 'owner', select: 'name email college' } }]) });
  } catch (e) { next(e); }
});
export default router;
