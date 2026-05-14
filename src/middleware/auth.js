const { verifyAccessToken } = require('../utils/jwt');

const authenticate = (req, res, next) => {
  const token = req.cookies?.access_token;
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });

  try {
    const decoded = verifyAccessToken(token);
    if (decoded.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Session expired' });
  }
};

module.exports = { authenticate };
