const slotsService = require('./slots.service');
const { z } = require('zod');

const configSchema = z.object({
  workStartTime: z.string().regex(/^\d{2}:\d{2}$/),
  workEndTime: z.string().regex(/^\d{2}:\d{2}$/),
  employeeTeams: z.number().int().positive(),
  slotIntervalMins: z.number().int().positive(),
});

const blockedDateSchema = z.object({
  date: z.string().min(1),
  reason: z.string().optional(),
});

const getAvailable = async (req, res, next) => {
  try {
    const slots = await slotsService.getAvailableSlots(req.query);
    res.json({ success: true, slots });
  } catch (err) {
    next(err);
  }
};

const getConfig = async (req, res, next) => {
  try {
    const config = await slotsService.getConfig();
    res.json({ success: true, config });
  } catch (err) {
    next(err);
  }
};

const saveConfig = async (req, res, next) => {
  try {
    const body = configSchema.parse(req.body);
    const config = await slotsService.saveConfig(body);
    res.json({ success: true, config });
  } catch (err) {
    next(err);
  }
};

const getBlockedDates = async (req, res, next) => {
  try {
    const dates = await slotsService.getBlockedDates();
    res.json({ success: true, dates });
  } catch (err) {
    next(err);
  }
};

const addBlockedDate = async (req, res, next) => {
  try {
    const body = blockedDateSchema.parse(req.body);
    const date = await slotsService.addBlockedDate(body);
    res.status(201).json({ success: true, date });
  } catch (err) {
    next(err);
  }
};

const removeBlockedDate = async (req, res, next) => {
  try {
    await slotsService.removeBlockedDate(req.params.id);
    res.json({ success: true, message: 'Blocked date removed' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAvailable, getConfig, saveConfig, getBlockedDates, addBlockedDate, removeBlockedDate };
