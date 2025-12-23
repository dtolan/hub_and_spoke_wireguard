import type { Request, Response, NextFunction } from 'express'

/**
 * Middleware to enforce HTTPS in production
 */
export function requireHTTPS(req: Request, res: Response, next: NextFunction): void {
  // Skip in development
  if (process.env.NODE_ENV !== 'production') {
    next()
    return
  }

  // Check if request is secure
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https'

  if (!isSecure) {
    res.status(403).json({
      error: 'HTTPS required',
      code: 'HTTPS_REQUIRED',
      hint: 'This endpoint requires a secure HTTPS connection',
    })
    return
  }

  next()
}

/**
 * Middleware to validate JSON request body
 */
export function validateJSON(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'POST' || req.method === 'PUT') {
    if (!req.is('application/json')) {
      res.status(400).json({
        error: 'Invalid content type',
        code: 'INVALID_CONTENT_TYPE',
        expected: 'application/json',
      })
      return
    }
  }

  next()
}

/**
 * Error handler middleware
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Unhandled error:', err)

  // Don't send error details in production
  const isDevelopment = process.env.NODE_ENV !== 'production'

  res.status(500).json({
    error: 'Internal server error',
    details: isDevelopment ? err.message : undefined,
    stack: isDevelopment ? err.stack : undefined,
  })
}
