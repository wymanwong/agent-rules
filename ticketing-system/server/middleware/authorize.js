import { fail } from "../shared/response.js";

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return fail(res, 401, "UNAUTHORIZED", "Authentication required");
    if (!roles.includes(req.user.role)) {
      return fail(res, 403, "FORBIDDEN", `Requires role: ${roles.join(" or ")}`);
    }
    next();
  };
}
