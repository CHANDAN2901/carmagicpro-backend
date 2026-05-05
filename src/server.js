require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const { PORT, CLIENT_URL } = require('./config/env');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const categoriesRoutes = require('./modules/categories/categories.routes');
const servicesRoutes = require('./modules/services/services.routes');
const productsRoutes = require('./modules/products/products.routes');
const bookingsRoutes = require('./modules/bookings/bookings.routes');
const ordersRoutes = require('./modules/orders/orders.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
const vehicleTypesRoutes = require('./modules/vehicleTypes/vehicleTypes.routes');
const slotsRoutes = require('./modules/slots/slots.routes');
const couponsRoutes = require('./modules/coupons/coupons.routes');
const paymentsRoutes = require('./modules/payments/payments.routes');
const webhooksRoutes = require('./modules/webhooks/webhooks.routes');
const invoicesRoutes = require('./modules/invoices/invoices.routes');
const uploadRoutes = require('./modules/upload/upload.routes');

const app = express();

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.options('/{*path}', cors({ origin: CLIENT_URL, credentials: true }));
app.use(helmet({ crossOriginResourcePolicy: false }));

// Webhook must receive raw body for HMAC verification — register BEFORE express.json()
app.use('/api/webhooks/razorpay', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.use('/api', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/vehicle-types', vehicleTypesRoutes);
app.use('/api/slots', slotsRoutes);
app.use('/api/coupons', couponsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/', (_, res) => {
  const uptimeSeconds = Math.floor(process.uptime());
  const h = Math.floor(uptimeSeconds / 3600);
  const m = Math.floor((uptimeSeconds % 3600) / 60);
  const s = uptimeSeconds % 60;
  res.json({
    success: true,
    message: '🚀 Welcome to CarMagicPro Customer & Dashboard API',
    status: '✅ Server is up and running',
    version: '1.0.0',
    data: {
      service: 'CarMagicPro API Server',
      version: '1.0.0',
      environment: process.env.NODE_ENV ?? 'development',
      timestamp: new Date().toISOString(),
      uptime: `${h}h ${m}m ${s}s`,
    },
    meta: {
      author: 'CarMagicPro Development Team',
    },
  });
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
