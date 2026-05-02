export function parseJson(str, fallback) {
  try {
    return JSON.parse(str ?? "");
  } catch {
    return fallback;
  }
}

/** Normalize PG jsonb / string / array to plain object/array */
export function asJson(val, fallback) {
  if (val == null || val === "") return fallback;
  if (typeof val === "object") return val;
  return parseJson(val, fallback);
}
