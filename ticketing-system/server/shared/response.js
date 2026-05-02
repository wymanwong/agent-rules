export function ok(res, data, meta = {}, status = 200) {
  res.status(status).json({ success: true, data, meta });
}

export function fail(res, status, code, message, details = {}) {
  res.status(status).json({
    success: false,
    error: { code, message, details },
  });
  return undefined;
}

/** Success with optional HTTP status (default 200) */
export function okStatus(res, status, data, meta = {}) {
  res.status(status).json({ success: true, data, meta });
}
