const { ZodError } = require('zod');

const PRISMA_UNIQUE_FIELD_LABELS = {
  email: 'Email',
  phone: 'Phone number',
};

const errorHandler = (err, req, res, next) => {
  // Prisma unique constraint violation (P2002)
  if (err?.code === 'P2002') {
    const field = err?.meta?.target?.[0];
    const label = PRISMA_UNIQUE_FIELD_LABELS[field] ?? field ?? 'Value';
    return res.status(409).json({ success: false, message: `${label} already exists` });
  }

  if (err instanceof ZodError || (err?.name === 'ZodError' && Array.isArray(err.issues))) {
    const issues = err.errors ?? err.issues ?? [];
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
  }

  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }

  if (err.retryAfter) {
    res.set('Retry-After', String(err.retryAfter));
  }

  res.status(status).json({ success: false, message: err.message || 'Internal server error' });
};

module.exports = errorHandler;
