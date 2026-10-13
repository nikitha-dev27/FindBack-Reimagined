import { Router } from 'express';
import mongoose from 'mongoose';
import Report from '../models/Report.js';
import Claim from '../models/Claim.js';
import { requireAuth } from '../middleware/auth.js';
import { sendSms } from '../services/sms.js';
import { sendEmail } from '../services/email.js';
const router = Router();
const categories = ['Electronics','Bags & Wallets','ID Cards','Books & Notes','Keys','Clothing','Accessories','Water Bottles','Other'];
const clean = (v) => String(v ?? '').trim();

function scoreMatches(report, candidates) {
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const titleTokens = new Set(norm(`${report.title} ${report.description}`));
  return candidates.map((candidate) => {
    const other = new Set(norm(`${candidate.title} ${candidate.description}`));
    const shared = [...titleTokens].filter((t) => t.length > 2 && other.has(t)).length;
    let score = 35 + Math.min(35, shared * 9);
    if (norm(report.location).some((t) => t.length > 2 && norm(candidate.location).includes(t))) score += 15;
    const days = Math.abs(new Date(report.itemDate) - new Date(candidate.itemDate)) / 86400000;
    if (days <= 2) score += 15;
    else if (days <= 7) score += 8;
    return {
      candidate,
      matchScore: Math.min(score, 98),
      matchReasons: [candidate.category === report.category ? 'Same category' : null, shared ? 'Similar item details' : null, score >= 50 ? 'Date/location may align' : null].filter(Boolean)
    };
  }).filter((match) => match.matchScore >= 40).sort((a, b) => b.matchScore - a.matchScore).slice(0, 12);
}

function reportSummary(report) {
  return `Item: ${report.title}\nType: ${report.type}\nCategory: ${report.category}\nLocation: ${report.location}\nDate: ${new Date(report.itemDate).toLocaleDateString()}\nDescription: ${report.description}`;
}

async function notifyPotentialMatches(newReport, newOwner) {
  try {
    const oppositeType = newReport.type === 'lost' ? 'found' : 'lost';
    const candidates = await Report.find({
      _id: { $ne: newReport._id },
      type: oppositeType,
      status: 'open',
      category: newReport.category
    }).populate('owner', 'name email').limit(100).lean();

    const matches = scoreMatches(newReport, candidates);
    if (!matches.length) {
      console.log(`No potential matches for report ${newReport._id}; no match emails sent.`);
      return;
    }

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const reportsUrl = `${frontendUrl}/`;
    if (newOwner?.email) {
      const list = matches.map((match, index) => `${index + 1}. ${match.candidate.title} (${match.matchScore}% possible match)\n${reportSummary(match.candidate)}\n`).join('\n');
      await sendEmail({
        to: newOwner.email,
        subject: `FindBack: possible match for your ${newReport.type} item`,
        text: `Hi ${newOwner.name || 'there'},\n\nA possible match was found for the item you just reported.\n\nYour report:\n${reportSummary(newReport)}\n\nPossible matching report(s):\n${list}\nSign in to FindBack to review the reports: ${reportsUrl}\n\nThis is an automated notification. Please verify item details before making a claim.`
      });
    }

    const byOwner = new Map();
    for (const match of matches) {
      const owner = match.candidate.owner;
      if (!owner?.email || String(owner._id) === String(newOwner?._id)) continue;
      if (!byOwner.has(owner.email)) byOwner.set(owner.email, { owner, matches: [] });
      byOwner.get(owner.email).matches.push(match);
    }
    await Promise.all([...byOwner.values()].map(({ owner, matches: ownerMatches }) => {
      const details = ownerMatches.map((match, index) => `${index + 1}. Your report: ${match.candidate.title} (${match.matchScore}% possible match)\nNew report:\n${reportSummary(newReport)}\n`).join('\n');
      return sendEmail({
        to: owner.email,
        subject: `FindBack: a new report may match your ${ownerMatches[0].candidate.type} item`,
        text: `Hi ${owner.name || 'there'},\n\nA newly submitted report may match an item you reported on FindBack.\n\n${details}\nSign in to FindBack to review the details: ${reportsUrl}\n\nThis is an automated notification. Please verify item details before making a claim.`
      });
    }));
    console.log(`Potential match notifications processed for report ${newReport._id}; matches: ${matches.length}`);
  } catch (error) {
    // A mail/matching problem must not make report submission fail.
    console.error('Potential-match email notification error:', error.message);
  }
}

router.get('/', async (req, res, next) => {
  try {
    const { type, category, q, status = 'open', mine } = req.query;
    const filter = {};
    if (['lost','found'].includes(type)) filter.type = type;
    if (categories.includes(category)) filter.category = category;
    if (status !== 'all') filter.status = ['open','resolved'].includes(status) ? status : 'open';
    if (q?.trim()) { const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); filter.$or = [{ title: rx }, { description: rx }, { location: rx }, { category: rx }]; }
    if (mine === 'true') {
      const auth = req.headers.authorization || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (!token) return res.status(401).json({ message: 'Sign in to view your reports.' });
      const jwt = await import('jsonwebtoken'); let payload;
      try { payload = jwt.default.verify(token, process.env.JWT_SECRET); } catch { return res.status(401).json({ message: 'Please sign in again.' }); }
      filter.owner = payload.sub;
    }
    const reports = await Report.find(filter).populate('owner','name college').sort({ createdAt: -1 }).limit(100).lean();
    res.json({ reports });
  } catch (e) { next(e); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { type, title, description, category, location, itemDate, imageUrl = '', contactPreference = 'in-app' } = req.body;
    if (!['lost','found'].includes(type)) return res.status(400).json({ message: 'Choose Lost or Found.' });
    if (!clean(title) || !clean(description) || !categories.includes(category) || !clean(location) || !itemDate) return res.status(400).json({ message: 'Complete all required item details.' });
    if (Number.isNaN(Date.parse(itemDate))) return res.status(400).json({ message: 'Enter a valid item date.' });
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) return res.status(400).json({ message: 'Image URL must start with http:// or https://.' });
    const report = await Report.create({ type, title: clean(title), description: clean(description), category, location: clean(location), itemDate: new Date(itemDate), imageUrl: clean(imageUrl), contactPreference: contactPreference === 'email' ? 'email' : 'in-app', owner: req.user._id });
    const populated = await report.populate('owner','name college');
    // Detect opposite-type reports immediately after a new report is created.
    // Email failures are logged and never block the report from being saved.
    void notifyPotentialMatches(report.toObject(), req.user);
    res.status(201).json({ report: populated });
  } catch (e) { next(e); }
});

router.get('/mine', requireAuth, async (req, res, next) => {
  try { const reports = await Report.find({ owner: req.user._id }).populate('owner','name college').sort({ createdAt: -1 }).lean(); res.json({ reports }); } catch (e) { next(e); }
});

router.get('/:id/matches', requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid report ID.' });
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found.' });
    const opposite = report.type === 'lost' ? 'found' : 'lost';
    const candidates = await Report.find({ _id: { $ne: report._id }, type: opposite, status: 'open', category: report.category }).populate('owner','name college').limit(100).lean();
    const matches = scoreMatches(report, candidates).map(({ candidate, matchScore, matchReasons }) => ({ ...candidate, matchScore, matchReasons }));
    res.json({ matches });
  } catch (e) { next(e); }
});

router.patch('/:id/resolve', requireAuth, async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found.' });
    if (String(report.owner) !== String(req.user._id)) return res.status(403).json({ message: 'Only the report owner can update its status.' });
    if (req.body.resolved) {
      const acceptedClaim = await Claim.exists({ report: report._id, status: 'accepted' });
      if (!acceptedClaim) return res.status(409).json({ message: 'This report cannot be marked recovered yet. Review and accept a claim first, then confirm the item has actually been returned.' });
      report.status = 'resolved';
    } else { report.status = 'open'; }
    await report.save();
    const owner = await (await import('../models/User.js')).default.findById(req.user._id).select('phone');
    if (report.status === 'resolved' && owner?.phone) sendSms(owner.phone, `FindBack: Your report for \"${report.title}\" is now marked recovered. Thank you for closing the loop.`).catch(err => console.error('SMS notification failed:', err.message));
    res.json({ report });
  } catch (e) { next(e); }
});
// Permanently delete a report only when the signed-in user owns it.
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid report ID.' });
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found.' });
    if (String(report.owner) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Only the person who created this report can delete it.' });
    }
    // Remove claims attached to this report so they do not become orphaned.
    await Claim.deleteMany({ report: report._id });
    await report.deleteOne();
    return res.json({ message: 'Report deleted successfully.', reportId: req.params.id });
  } catch (e) { next(e); }
});

export default router;
