const { AISENSY_API_KEY, AISENSY_OTP_CAMPAIGN } = require('../config/env');

// Sends OTP via an AiSensy API campaign built on an approved AUTHENTICATION template.
// The template's copy-code button needs the OTP too, hence `buttons`.
async function sendOtpWhatsApp(phone, otp) {
  if (!AISENSY_API_KEY || !AISENSY_OTP_CAMPAIGN) throw new Error('AiSensy is not configured');

  const res = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: AISENSY_API_KEY,
      campaignName: AISENSY_OTP_CAMPAIGN,
      destination: `+91${phone}`,
      userName: 'Customer',
      templateParams: [otp],
      buttons: [{ type: 'button', sub_type: 'url', index: 0, parameters: [{ type: 'text', text: otp }] }],
    }),
  });

  if (!res.ok) throw new Error(`AiSensy error ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

module.exports = { sendOtpWhatsApp };
