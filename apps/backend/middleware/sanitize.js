/**
 * Custom NoSQL injection sanitizer compatible with Express 5.
 * Recursively strips keys that start with '$' or contain '.'
 * from req.body and req.params.
 *
 * Note: req.query is read-only in Express 5 (getter from URL),
 * so query-based injection must be handled at the DB layer
 * (e.g. Mongoose schema validation already covers this).
 */

const FORBIDDEN_PATTERN = /^\$|\.{1}/;

function sanitizeValue(value) {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (typeof value === 'object') {
    return sanitizeObject(value);
  }

  return value;
}

function sanitizeObject(obj) {
  const clean = {};
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_PATTERN.test(key)) continue; // strip dangerous keys
    clean[key] = sanitizeValue(obj[key]);
  }
  return clean;
}

export const sanitizeNoSQL = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  if (req.params && typeof req.params === 'object') {
    try {
      for (const key of Object.keys(req.params)) {
        if (typeof req.params[key] === 'string' && FORBIDDEN_PATTERN.test(req.params[key])) {
          req.params[key] = req.params[key].replace(FORBIDDEN_PATTERN, '');
        }
      }
    } catch {
      // req.params may be read-only in some Express versions, skip silently
    }
  }

  next();
};
