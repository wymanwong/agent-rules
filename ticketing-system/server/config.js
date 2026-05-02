export const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret-change-me";
export const ACCESS_TTL_SEC = Number(process.env.ACCESS_TTL_SEC) || 15 * 60;
export const REFRESH_TTL_SEC = Number(process.env.REFRESH_TTL_SEC) || 7 * 24 * 60 * 60;
