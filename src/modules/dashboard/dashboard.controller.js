const dashboardService = require('./dashboard.service');

const getStats = async (req, res, next) => {
  try {
    const data = await dashboardService.getStats();
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};

const getTrends = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const data = await dashboardService.getTrends({ from, to });
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};

module.exports = { getStats, getTrends };
