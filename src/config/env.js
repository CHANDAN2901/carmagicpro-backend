require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
if (!process.env.REFRESH_TOKEN_SECRET) throw new Error('REFRESH_TOKEN_SECRET is not set');
if (NODE_ENV === 'production' && !process.env.CLIENT_URL) throw new Error('CLIENT_URL is not set');
if (NODE_ENV === 'production' && !process.env.R2_ACCOUNT_ID) throw new Error('R2_ACCOUNT_ID is not set');
if (NODE_ENV === 'production' && !process.env.R2_ACCESS_KEY_ID) throw new Error('R2_ACCESS_KEY_ID is not set');
if (NODE_ENV === 'production' && !process.env.R2_SECRET_ACCESS_KEY) throw new Error('R2_SECRET_ACCESS_KEY is not set');
if (NODE_ENV === 'production' && !process.env.R2_BUCKET_NAME) throw new Error('R2_BUCKET_NAME is not set');
if (NODE_ENV === 'production' && !process.env.R2_PUBLIC_URL) throw new Error('R2_PUBLIC_URL is not set');
if (NODE_ENV === 'production' && !process.env.SMS_API_KEY) throw new Error('SMS_API_KEY is not set');
if (NODE_ENV === 'production' && !process.env.SMS_CLIENT_ID) throw new Error('SMS_CLIENT_ID is not set');
if (NODE_ENV === 'production' && !process.env.SMS_SENDER_ID) throw new Error('SMS_SENDER_ID is not set');
if (NODE_ENV === 'production' && !process.env.SMS_API_URL) throw new Error('SMS_API_URL is not set');

const getEnv = (key) => process.env[key];

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  ZEPTO_MAIL_URL: process.env.ZEPTO_MAIL_URL,
  ZEPTO_MAIL_TOKEN: process.env.ZEPTO_MAIL_TOKEN,
  ZEPTO_FROM_EMAIL: process.env.ZEPTO_FROM_EMAIL,
  ZEPTO_FROM_NAME: process.env.ZEPTO_FROM_NAME,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  // Where "new booking/order" notifications are sent. Falls back to the sender address.
  ADMIN_NOTIFY_EMAIL: process.env.ADMIN_NOTIFY_EMAIL || process.env.ZEPTO_FROM_EMAIL,
  // Contact details surfaced to customers in transactional emails.
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || process.env.ZEPTO_FROM_EMAIL,
  SUPPORT_NUMBER: process.env.SUPPORT_NUMBER || '+91 00000 00000',
  WEBSITE_URL: process.env.WEBSITE_URL || 'https://carmagicpro.com',
  SMS_SENDER_ID: process.env.SMS_SENDER_ID,
  SMS_API_KEY: process.env.SMS_API_KEY,
  SMS_CLIENT_ID: process.env.SMS_CLIENT_ID,
  SMS_API_URL: process.env.SMS_API_URL || 'http://api.ssexpertsystem.com/api/v2/SendSMS',
  getEnv,
};
