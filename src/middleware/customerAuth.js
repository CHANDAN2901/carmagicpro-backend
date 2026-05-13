const { verifyAccessToken } = require('../utils/jwt');

const customerAuthenticate = (req, res, next) => {
  const token = req.cookies?.access_token;
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Session expired' });
  }
};

module.exports = { customerAuthenticate };
