const { SMS_SENDER_ID, SMS_API_KEY, SMS_CLIENT_ID, SMS_API_URL } = require('../config/env');

async function sendOtpSms(phone, otp) {
  const message = encodeURIComponent(`Your One-Time Password (OTP) is: ${otp} for Registration in App of Invent Educare`);
  const url = `${SMS_API_URL}?SenderId=${SMS_SENDER_ID}&Message=${message}&MobileNumbers=${phone}&ApiKey=${SMS_API_KEY}&ClientId=${SMS_CLIENT_ID}`;

  const res = await fetch(url);
  const text = await res.text();
  console.log('[SMS] raw response:', text);

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`SMS service returned unexpected response: ${text}`);
  }

  // ssexpertsystem API returns ErrorCode 0 on success
  if (json.ErrorCode !== undefined && json.ErrorCode !== 0) {
    throw new Error(`SMS API error ${json.ErrorCode}: ${json.ErrorDescription || 'unknown'}`);
  }
}

module.exports = { sendOtpSms };
