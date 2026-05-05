const crypto = require('crypto');

const generateOtp = () => crypto.randomInt(100000, 999999).toString();

const OTP_TTL_MINUTES = 10;

const otpExpiresAt = () => new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

module.exports = { generateOtp, otpExpiresAt };
