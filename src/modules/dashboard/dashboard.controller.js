const dashboardService = require('./dashboard.service');

const getStats = async (req, res, next) => {
  try {
    const data = await dashboardService.getStats();
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};

module.exports = { getStats };
