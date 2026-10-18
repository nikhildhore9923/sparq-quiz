/**
 * Centralized JWT configuration with fail-safe production checks.
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is missing in production. Refusing to start or authenticate.');
    }
    // Safe development fallback only
    return 'sparq-local-dev-secret-key-change-in-production-123';
  }

  return secret;
}

module.exports = { getJwtSecret };
