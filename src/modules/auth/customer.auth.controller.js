const { z } = require('zod');
const service = require('./customer.auth.service');

const passwordSchema = z
  .string()
  .min(8, 'Min 8 characters')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[0-9]/, 'Must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Must contain a special character');

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: passwordSchema,
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

const resendOtpSchema = z.object({
  email: z.string().email(),
});

const register = async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const result = await service.register(data);
    res.status(201).json({ success: true, ...result });
  } catch (err) { next(err); }
};

const login = async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await service.login(data);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

const verifyOtp = async (req, res, next) => {
  try {
    const data = verifyOtpSchema.parse(req.body);
    const result = await service.verifyOtp(data);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

const resendOtp = async (req, res, next) => {
  try {
    const data = resendOtpSchema.parse(req.body);
    const result = await service.resendOtp(data);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

module.exports = { register, login, verifyOtp, resendOtp };
