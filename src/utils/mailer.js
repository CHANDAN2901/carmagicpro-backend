const { SendMailClient } = require('zeptomail');
const { ZEPTO_MAIL_URL, ZEPTO_MAIL_TOKEN, ZEPTO_FROM_EMAIL, ZEPTO_FROM_NAME } = require('../config/env');

const client = new SendMailClient({ url: ZEPTO_MAIL_URL, token: ZEPTO_MAIL_TOKEN });

const sendOtpEmail = async (to, otp) => {
  await client.sendMail({
    from: { address: ZEPTO_FROM_EMAIL, name: ZEPTO_FROM_NAME },
    to: [{ email_address: { address: to, name: 'Admin' } }],
    subject: 'Your OTP Code',
    htmlbody: `<p>Your OTP is <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
  });
};

const sendCustomerOtpEmail = async (to, name, otp) => {
  await client.sendMail({
    from: { address: ZEPTO_FROM_EMAIL, name: ZEPTO_FROM_NAME },
    to: [{ email_address: { address: to, name: name ?? 'Customer' } }],
    subject: 'Your Login OTP',
    htmlbody: `<p>Hi ${name ?? 'there'},</p><p>Your OTP is <strong>${otp}</strong>. It expires in 10 minutes.</p><p>Do not share this with anyone.</p>`,
  });
};

module.exports = { sendOtpEmail, sendCustomerOtpEmail };
