const { z } = require('zod');
const prisma = require('../../config/prisma');

const getSettings = async (req, res, next) => {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'razorpay_mode' } });
    res.json({ success: true, mode: setting?.value ?? 'test' });
  } catch (err) { next(err); }
};

const updateSettingsSchema = z.object({
  mode: z.enum(['test', 'live']),
});

const updateSettings = async (req, res, next) => {
  try {
    const { mode } = updateSettingsSchema.parse(req.body);
    await prisma.appSetting.upsert({
      where: { key: 'razorpay_mode' },
      update: { value: mode },
      create: { key: 'razorpay_mode', value: mode },
    });
    res.json({ success: true, mode });
  } catch (err) { next(err); }
};

module.exports = { getSettings, updateSettings };
