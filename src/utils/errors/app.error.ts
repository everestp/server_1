/**
 * @file app.error.ts
 */

/**
 * Interface representing a custom application error.
 */
export interface AppError extends Error {
    statusCode: number;
}

/**
 * Bad Request - 400
 */
export class BadRequestError implements AppError {
    statusCode = 400;
    message: string;
    name = "BadRequestError";

    constructor(message = "Bad Request") {
        this.message = message;
    }
}

/**
 * Unauthorized - 401
 */
export class UnauthorizedError implements AppError {
    statusCode = 401;
    message: string;
    name = "UnauthorizedError";

    constructor(message = "Unauthorized") {
        this.message = message;
    }
}

/**
 * Authentication Error - 401 (advanced)
 */
export class AuthenticationError implements AppError {
    statusCode = 401;
    message: string;
    name = "AuthenticationError";

    constructor(message = "Authentication Failed") {
        this.message = message;
    }
}

/**
 * Token Expired - 401
 */
export class TokenExpiredError implements AppError {
    statusCode = 401;
    message: string;
    name = "TokenExpiredError";

    constructor(message = "Token Expired") {
        this.message = message;
    }
}

/**
 * Forbidden - 403
 */
export class ForbiddenError implements AppError {
    statusCode = 403;
    message: string;
    name = "ForbiddenError";

    constructor(message = "Forbidden") {
        this.message = message;
    }
}

/**
 * Not Found - 404
 */
export class NotFoundError implements AppError {
    statusCode = 404;
    message: string;
    name = "NotFoundError";

    constructor(message = "Not Found") {
        this.message = message;
    }
}

/**
 * Conflict - 409
 */
export class ConflictError implements AppError {
    statusCode = 409;
    message: string;
    name = "ConflictError";

    constructor(message = "Conflict") {
        this.message = message;
    }
}

/**
 * Validation Error - 422
 */
export class ValidationError implements AppError {
    statusCode = 422;
    message: string;
    name = "ValidationError";

    constructor(message = "Validation Failed") {
        this.message = message;
    }
}

/**
 * Payload Too Large - 413
 */
export class PayloadTooLargeError implements AppError {
    statusCode = 413;
    message: string;
    name = "PayloadTooLargeError";

    constructor(message = "Payload Too Large") {
        this.message = message;
    }
}

/**
 * Unsupported Media Type - 415
 */
export class UnsupportedMediaTypeError implements AppError {
    statusCode = 415;
    message: string;
    name = "UnsupportedMediaTypeError";

    constructor(message = "Unsupported Media Type") {
        this.message = message;
    }
}

/**
 * Request Timeout - 408
 */
export class RequestTimeoutError implements AppError {
    statusCode = 408;
    message: string;
    name = "RequestTimeoutError";

    constructor(message = "Request Timeout") {
        this.message = message;
    }
}

/**
 * Too Many Requests - 429
 */
export class TooManyRequestsError implements AppError {
    statusCode = 429;
    message: string;
    name = "TooManyRequestsError";

    constructor(message = "Too Many Requests") {
        this.message = message;
    }
}

/**
 * Service Unavailable - 503
 */
export class ServiceUnavailableError implements AppError {
    statusCode = 503;
    message: string;
    name = "ServiceUnavailableError";

    constructor(message = "Service Unavailable") {
        this.message = message;
    }
}

/**
 * Database Error - 500
 */
export class DatabaseError implements AppError {
    statusCode = 500;
    message: string;
    name = "DatabaseError";

    constructor(message = "Database Error") {
        this.message = message;
    }
}

/**
 * Internal Server Error - 500
 */
export class InternalServerError implements AppError {
    statusCode = 500;
    message: string;
    name = "InternalServerError";

    constructor(message = "Internal Server Error") {
        this.message = message;
    }
}
