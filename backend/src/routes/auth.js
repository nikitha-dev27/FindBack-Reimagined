import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
const tokenFor = (user) => jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' });
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, college = '', phone = '' } = req.body;
    if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ message: 'Name, email and password are required.' });
    if (password.length < 8) return res.status(400).json({ message: 'Use a password with at least 8 characters.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    const normalizedEmail = email.toLowerCase().trim();
    if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ message: 'An account with this email already exists.' });
    const normalizedPhone = String(phone || '').trim();
    if (normalizedPhone && !/^\+[1-9]\d{7,14}$/.test(normalizedPhone.replace(/[\s()-]/g, ''))) return res.status(400).json({ message: 'Enter phone in international format, e.g. +919876543210.' });
    const user = await User.create({ name: name.trim(), email: normalizedEmail, phone: normalizedPhone.replace(/[\s()-]/g, ''), college: college.trim(), passwordHash: await bcrypt.hash(password, 12) });
    res.status(201).json({ token: tokenFor(user), user: user.toJSON() });
  } catch (e) { next(e); }
});
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email || '').toLowerCase().trim() });
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) return res.status(401).json({ message: 'Email or password is incorrect.' });
    res.json({ token: tokenFor(user), user: user.toJSON() });
  } catch (e) { next(e); }
});
router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));
export default router;
