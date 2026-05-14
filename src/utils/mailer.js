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

const sendAdminWelcomeEmail = async (to, email, password, dashboardUrl) => {
  await client.sendMail({
    from: { address: ZEPTO_FROM_EMAIL, name: ZEPTO_FROM_NAME },
    to: [{ email_address: { address: to, name: 'Admin' } }],
    subject: 'Your Car Magic Pro CRM Access',
    htmlbody: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#f9f9f9;border-radius:8px;">
        <h2 style="color:#1a1a1a;margin-bottom:8px;">Welcome to Car Magic Pro CRM</h2>
        <p style="color:#555;margin-bottom:24px;">Your admin account has been created. Here are your login credentials:</p>
        <table style="width:100%;background:#fff;border-radius:6px;padding:20px;border:1px solid #e5e5e5;">
          <tr><td style="padding:8px 0;color:#888;font-size:13px;">Dashboard URL</td></tr>
          <tr><td style="padding:0 0 16px;"><a href="${dashboardUrl}" style="color:#2563eb;">${dashboardUrl}</a></td></tr>
          <tr><td style="padding:8px 0;color:#888;font-size:13px;">Email</td></tr>
          <tr><td style="padding:0 0 16px;font-weight:600;color:#1a1a1a;">${email}</td></tr>
          <tr><td style="padding:8px 0;color:#888;font-size:13px;">Password</td></tr>
          <tr><td style="padding:0 0 8px;font-weight:600;color:#1a1a1a;">${password}</td></tr>
        </table>
        <p style="color:#888;font-size:12px;margin-top:24px;">Please change your password after your first login. Do not share these credentials with anyone.</p>
      </div>
    `,
  });
};

module.exports = { sendOtpEmail, sendCustomerOtpEmail, sendAdminWelcomeEmail };
