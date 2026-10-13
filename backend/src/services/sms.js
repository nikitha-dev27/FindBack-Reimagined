/** Optional SMS delivery through Twilio. Configure all TWILIO_* variables to enable real SMS. */
export async function sendSms(to, body) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  if (!to || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    console.info('[FindBack SMS] Not sent: recipient phone or Twilio environment variables are missing.');
    return { sent: false, reason: 'not_configured' };
  }
  const phone = String(to).replace(/[\s()-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    console.info('[FindBack SMS] Not sent: phone must use international format, e.g. +919876543210.');
    return { sent: false, reason: 'invalid_phone' };
  }
  const form = new URLSearchParams({ To: phone, From: TWILIO_FROM_NUMBER, Body: body.slice(0, 1500) });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form
  });
  if (!response.ok) {
    const details = await response.text();
    console.error('[FindBack SMS] Twilio send failed:', response.status, details.slice(0, 500));
    return { sent: false, reason: 'provider_error' };
  }
  return { sent: true };
}
