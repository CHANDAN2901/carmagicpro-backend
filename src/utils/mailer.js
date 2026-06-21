const { SendMailClient } = require('zeptomail');
const {
  ZEPTO_MAIL_URL, ZEPTO_MAIL_TOKEN, ZEPTO_FROM_EMAIL, ZEPTO_FROM_NAME,
  ADMIN_NOTIFY_EMAIL, SUPPORT_EMAIL, SUPPORT_NUMBER, WEBSITE_URL,
} = require('../config/env');

const client = new SendMailClient({ url: ZEPTO_MAIL_URL, token: ZEPTO_MAIL_TOKEN });

// ── Shared template helpers ──────────────────────────────
const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Renders an array of [label, value] pairs as a clean details table; rows with
// empty values are skipped.
const detailRows = (rows) => rows
  .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
  .map(([label, value]) => `
    <tr>
      <td style="padding:8px 0;color:#888;font-size:13px;width:42%;vertical-align:top;">${esc(label)}</td>
      <td style="padding:8px 0;color:#1a1a1a;font-size:14px;font-weight:600;">${esc(value)}</td>
    </tr>`).join('');

const wrap = (heading, intro, bodyHtml) => `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#f7f7f8;border-radius:10px;color:#1a1a1a;">
    <h2 style="margin:0 0 8px;color:#1a1a1a;">${heading}</h2>
    <p style="color:#555;margin:0 0 24px;line-height:1.5;">${intro}</p>
    ${bodyHtml}
  </div>`;

const customerFooter = () => `
  <p style="color:#555;margin:24px 0 8px;line-height:1.5;">If you have any questions, feel free to contact our support team.</p>
  <p style="color:#1a1a1a;margin:0 0 4px;font-weight:600;">Thank you for trusting Car Magic Pro.</p>
  <p style="color:#888;font-size:13px;margin:16px 0 0;line-height:1.6;">
    Best Regards,<br/>Team Car Magic Pro<br/>
    Website: <a href="${esc(WEBSITE_URL)}" style="color:#2563eb;">${esc(WEBSITE_URL)}</a><br/>
    Phone: ${esc(SUPPORT_NUMBER)}<br/>
    Email: ${esc(SUPPORT_EMAIL)}
  </p>`;

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

// ── Booking emails ───────────────────────────────────────

// b: { bookingNumber, customerName, customerEmail, customerMobile, serviceName,
//      vehicleNumber, vehicleModel, bookingDate, bookingTime, serviceAddress,
//      paymentMethod, paymentStatus, amount, notes }
const sendBookingConfirmationEmail = async (to, b) => {
  const body = `
    <div style="background:#fff;border-radius:8px;padding:20px;border:1px solid #e5e5e5;">
      <h3 style="margin:0 0 8px;font-size:15px;color:#1a1a1a;">Booking Details</h3>
      <table style="width:100%;border-collapse:collapse;">${detailRows([
        ['Booking ID', b.bookingNumber],
        ['Service', b.serviceName],
        ['Vehicle', b.vehicleNumber],
        ['Date', b.bookingDate],
        ['Time', b.bookingTime],
        ['Service Address', b.serviceAddress],
        ['Payment Method', b.paymentMethod],
        ['Payment Status', b.paymentStatus],
        ['Amount', `₹${b.amount}`],
      ])}</table>
    </div>
    <h3 style="margin:24px 0 8px;font-size:15px;color:#1a1a1a;">What's Next?</h3>
    <ul style="color:#555;font-size:14px;line-height:1.7;margin:0;padding-left:20px;">
      <li>Our team will review your booking.</li>
      <li>A technician will be assigned before your appointment.</li>
      <li>You'll receive reminder notifications before your scheduled service.</li>
      <li>Once the service is completed, your invoice will be available in your account.</li>
    </ul>
    <p style="color:#555;font-size:14px;margin:16px 0 0;line-height:1.5;">If you need to reschedule or cancel, please do so before the scheduled appointment through the Car Magic Pro app or website.</p>
    ${customerFooter()}`;

  await client.sendMail({
    from: { address: ZEPTO_FROM_EMAIL, name: ZEPTO_FROM_NAME },
    to: [{ email_address: { address: to, name: b.customerName ?? 'Customer' } }],
    subject: `✅ Your Car Magic Pro Booking is Confirmed! | Booking ID #${b.bookingNumber}`,
    htmlbody: wrap(
      'Your Booking is Confirmed!',
      `Dear ${esc(b.customerName ?? 'Customer')}, thank you for choosing Car Magic Pro! Your booking has been successfully confirmed. We look forward to providing you with a premium car care experience.`,
      body,
    ),
  });
};

const sendBookingNotificationToAdmin = async (b) => {
  if (!ADMIN_NOTIFY_EMAIL) return;
  const body = `
    <div style="background:#fff;border-radius:8px;padding:20px;border:1px solid #e5e5e5;margin-bottom:16px;">
      <h3 style="margin:0 0 8px;font-size:15px;color:#1a1a1a;">Customer Details</h3>
      <table style="width:100%;border-collapse:collapse;">${detailRows([
        ['Customer Name', b.customerName],
        ['Mobile Number', b.customerMobile],
        ['Email Address', b.customerEmail],
      ])}</table>
    </div>
    <div style="background:#fff;border-radius:8px;padding:20px;border:1px solid #e5e5e5;">
      <h3 style="margin:0 0 8px;font-size:15px;color:#1a1a1a;">Booking Details</h3>
      <table style="width:100%;border-collapse:collapse;">${detailRows([
        ['Booking ID', b.bookingNumber],
        ['Service', b.serviceName],
        ['Vehicle Number', b.vehicleNumber],
        ['Vehicle Model', b.vehicleModel],
        ['Booking Date', b.bookingDate],
        ['Booking Time', b.bookingTime],
        ['Service Address', b.serviceAddress],
        ['Payment Method', b.paymentMethod],
        ['Payment Status', b.paymentStatus],
        ['Total Amount', `₹${b.amount}`],
        ['Additional Notes', b.notes],
      ])}</table>
    </div>
    <h3 style="margin:24px 0 8px;font-size:15px;color:#1a1a1a;">Action Required</h3>
    <ul style="color:#555;font-size:14px;line-height:1.7;margin:0;padding-left:20px;">
      <li>Review the booking.</li>
      <li>Assign a technician.</li>
      <li>Confirm service availability.</li>
      <li>Ensure the technician arrives on time.</li>
    </ul>
    <p style="color:#888;font-size:13px;margin:16px 0 0;">Please log in to the Admin Dashboard to manage this booking.<br/>Car Magic Pro System</p>`;

  await client.sendMail({
    from: { address: ZEPTO_FROM_EMAIL, name: ZEPTO_FROM_NAME },
    to: [{ email_address: { address: ADMIN_NOTIFY_EMAIL, name: 'Admin' } }],
    subject: `🚗 New Booking Received | Booking ID #${b.bookingNumber}`,
    htmlbody: wrap('New Booking Received', 'A new booking has been received through Car Magic Pro.', body),
  });
};

// ── Order emails ─────────────────────────────────────────

// o: { orderNumber, customerName, customerEmail, customerMobile, items: [{ name, qty, amount }],
//      deliveryAddress, paymentMethod, paymentStatus, amount, notes }
const orderItemsTable = (items = []) => `
  <table style="width:100%;border-collapse:collapse;margin-top:4px;">
    <tr style="border-bottom:1px solid #e5e5e5;">
      <td style="padding:6px 0;color:#888;font-size:12px;">Item</td>
      <td style="padding:6px 0;color:#888;font-size:12px;text-align:center;">Qty</td>
      <td style="padding:6px 0;color:#888;font-size:12px;text-align:right;">Amount</td>
    </tr>
    ${items.map((i) => `
      <tr style="border-bottom:1px solid #f0f0f0;">
        <td style="padding:8px 0;color:#1a1a1a;font-size:13px;">${esc(i.name)}</td>
        <td style="padding:8px 0;color:#1a1a1a;font-size:13px;text-align:center;">${esc(i.qty)}</td>
        <td style="padding:8px 0;color:#1a1a1a;font-size:13px;text-align:right;">₹${esc(i.amount)}</td>
      </tr>`).join('')}
  </table>`;

const sendOrderConfirmationEmail = async (to, o) => {
  const body = `
    <div style="background:#fff;border-radius:8px;padding:20px;border:1px solid #e5e5e5;">
      <h3 style="margin:0 0 8px;font-size:15px;color:#1a1a1a;">Order Details</h3>
      <table style="width:100%;border-collapse:collapse;">${detailRows([
        ['Order ID', o.orderNumber],
        ['Delivery Address', o.deliveryAddress],
        ['Payment Method', o.paymentMethod],
        ['Payment Status', o.paymentStatus],
        ['Total Amount', `₹${o.amount}`],
      ])}</table>
      <h3 style="margin:20px 0 4px;font-size:15px;color:#1a1a1a;">Items</h3>
      ${orderItemsTable(o.items)}
    </div>
    <h3 style="margin:24px 0 8px;font-size:15px;color:#1a1a1a;">What's Next?</h3>
    <ul style="color:#555;font-size:14px;line-height:1.7;margin:0;padding-left:20px;">
      <li>Our team will process and pack your order.</li>
      <li>You'll receive updates as your order is shipped.</li>
      <li>Your invoice will be available in your account once dispatched.</li>
    </ul>
    ${customerFooter()}`;

  await client.sendMail({
    from: { address: ZEPTO_FROM_EMAIL, name: ZEPTO_FROM_NAME },
    to: [{ email_address: { address: to, name: o.customerName ?? 'Customer' } }],
    subject: `✅ Your Car Magic Pro Order is Confirmed! | Order ID #${o.orderNumber}`,
    htmlbody: wrap(
      'Your Order is Confirmed!',
      `Dear ${esc(o.customerName ?? 'Customer')}, thank you for shopping with Car Magic Pro! Your order has been successfully placed.`,
      body,
    ),
  });
};

const sendOrderNotificationToAdmin = async (o) => {
  if (!ADMIN_NOTIFY_EMAIL) return;
  const body = `
    <div style="background:#fff;border-radius:8px;padding:20px;border:1px solid #e5e5e5;margin-bottom:16px;">
      <h3 style="margin:0 0 8px;font-size:15px;color:#1a1a1a;">Customer Details</h3>
      <table style="width:100%;border-collapse:collapse;">${detailRows([
        ['Customer Name', o.customerName],
        ['Mobile Number', o.customerMobile],
        ['Email Address', o.customerEmail],
      ])}</table>
    </div>
    <div style="background:#fff;border-radius:8px;padding:20px;border:1px solid #e5e5e5;">
      <h3 style="margin:0 0 8px;font-size:15px;color:#1a1a1a;">Order Details</h3>
      <table style="width:100%;border-collapse:collapse;">${detailRows([
        ['Order ID', o.orderNumber],
        ['Delivery Address', o.deliveryAddress],
        ['Payment Method', o.paymentMethod],
        ['Payment Status', o.paymentStatus],
        ['Total Amount', `₹${o.amount}`],
        ['Additional Notes', o.notes],
      ])}</table>
      <h3 style="margin:20px 0 4px;font-size:15px;color:#1a1a1a;">Items</h3>
      ${orderItemsTable(o.items)}
    </div>
    <h3 style="margin:24px 0 8px;font-size:15px;color:#1a1a1a;">Action Required</h3>
    <ul style="color:#555;font-size:14px;line-height:1.7;margin:0;padding-left:20px;">
      <li>Review the order.</li>
      <li>Confirm stock and pack the items.</li>
      <li>Arrange dispatch and delivery.</li>
    </ul>
    <p style="color:#888;font-size:13px;margin:16px 0 0;">Please log in to the Admin Dashboard to manage this order.<br/>Car Magic Pro System</p>`;

  await client.sendMail({
    from: { address: ZEPTO_FROM_EMAIL, name: ZEPTO_FROM_NAME },
    to: [{ email_address: { address: ADMIN_NOTIFY_EMAIL, name: 'Admin' } }],
    subject: `🛒 New Order Received | Order ID #${o.orderNumber}`,
    htmlbody: wrap('New Order Received', 'A new order has been received through Car Magic Pro.', body),
  });
};

module.exports = {
  sendOtpEmail,
  sendCustomerOtpEmail,
  sendAdminWelcomeEmail,
  sendBookingConfirmationEmail,
  sendBookingNotificationToAdmin,
  sendOrderConfirmationEmail,
  sendOrderNotificationToAdmin,
};
