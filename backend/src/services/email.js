import nodemailer from 'nodemailer';

let transport;
let warnedMissingConfig = false;

function getTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    if (!warnedMissingConfig) {
      console.warn('Email notifications are disabled: set SMTP_HOST, SMTP_USER, and SMTP_PASS in backend/.env.');
      warnedMissingConfig = true;
    }
    return null;
  }
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 587);
    transport = nodemailer.createTransport({
      host,
      port,
      secure: String(process.env.SMTP_SECURE || (port === 465)).toLowerCase() === 'true',
      auth: { user, pass }
    });
  }
  return transport;
}

export async function sendEmail({ to, subject, text }) {
  const mailer = getTransport();
  if (!mailer || !to) return false;
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  try {
    await mailer.sendMail({ from, to, subject, text });
    console.log(`Email notification sent to ${to}`);
    return true;
  } catch (error) {
    console.error(`Email notification failed for ${to}:`, error.message);
    return false;
  }
}
