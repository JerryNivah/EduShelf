import { success } from "zod";

export function handleError(error, res) {
  const isOperational = error?.isOperational == true;

  const statusCode = 
  isOperational && Number.isInteger(error.statusCode)
  ? error.statusCode
  : 500;

  const message = isOperational
  ? error.message
  :"Internal server error";

  if (!isOperational) {
    console.error(error);
  }

  return res.status(statusCode).json({
    success: false,
    message,
    ...(isOperational && error.details
      ?{ errors: error.details }
      :{}),
  });
}