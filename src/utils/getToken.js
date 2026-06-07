// Extracts a JWT from a request, supporting two transports:
//   • Mobile  → Authorization: Bearer <token>  (takes precedence)
//   • Web     → named httpOnly cookie (fallback)
// This lets a single endpoint serve both the browser apps and the mobile app.
const getToken = (req, cookieName) => {
  const header = req.headers?.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return req.cookies?.[cookieName];
};

module.exports = { getToken };
