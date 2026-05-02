import { fail } from "../shared/response.js";

export function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, "VALIDATION_ERROR", "Invalid body", parsed.error.flatten());
    }
    req.validBody = parsed.data;
    next();
  };
}
