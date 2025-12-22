export class AppError extends Error {
  statusCode: number;
  errors?: any;

  constructor(message: string, statusCode = 500, errors?: any) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
  }
}

// ✅ Can accept custom message or default
export class ValidationError extends AppError {
  constructor(errors: any, message = "Validation failed") {
    super(message, 400, errors);
  }
}

export class AuthError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource", message?: string) {
    super(message ?? `${resource} not found`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409);
  }
}
