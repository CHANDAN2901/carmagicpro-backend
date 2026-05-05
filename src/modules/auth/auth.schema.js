const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

const verifyOtpSchema = z.object({
  email: z.string().trim().email(),
  otp: z.string().length(6).regex(/^\d+$/),
});

const resendOtpSchema = z.object({
  email: z.string().trim().email(),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

const resetPasswordSchema = z.object({
  email: z.string().trim().email(),
  otp: z.string().length(6).regex(/^\d+$/),
  password: z
    .string()
    .min(8)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/, {
      message: 'Password must contain uppercase, lowercase, number and special character',
    }),
});

module.exports = { loginSchema, verifyOtpSchema, resendOtpSchema, forgotPasswordSchema, resetPasswordSchema };
