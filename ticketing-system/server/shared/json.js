export function parseJson(str, fallback) {
  try {
    return JSON.parse(str ?? "");
  } catch {
    return fallback;
  }
}
