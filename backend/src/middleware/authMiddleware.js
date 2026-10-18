const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../utils/jwtConfig');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded; // { id, username }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
