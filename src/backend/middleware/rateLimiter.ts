import rateLimit from 'express-rate-limit'

/**
 * Rate limiter for token generation
 * Limits: 10 tokens per hour per IP address
 */
export const tokenGenerationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour per IP
  message: {
    error: 'Too many token generation requests',
    code: 'RATE_LIMIT_EXCEEDED',
    hint: 'Maximum 10 tokens per hour. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * Rate limiter for spoke registration
 * Limits: 20 registrations per hour per IP address
 */
export const spokeRegistrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 requests per hour per IP
  message: {
    error: 'Too many registration requests',
    code: 'RATE_LIMIT_EXCEEDED',
    hint: 'Maximum 20 registrations per hour. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * General API rate limiter
 * Limits: 100 requests per 15 minutes per IP address
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes per IP
  message: {
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED',
    hint: 'Please slow down and try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
})
