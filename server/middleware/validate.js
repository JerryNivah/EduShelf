import { AppError } from "../utils/AppError.js";

export function validate(schema, data) {
  const result = schema.safeParse(data);

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join(".") || "request",
      message: issue.message,
    }));

    throw new AppError("Invalid request data", 400, details);
  }

  return result.data;
}