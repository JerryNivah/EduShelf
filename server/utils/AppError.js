export class AppError extends Error {
  constructor(message, statusCode, details = null) {
    super(message);

    this.statusCode = statusCode;
    this.isOperational = true;
    this.name = "AppError";
    this.details = details;
  }
} 