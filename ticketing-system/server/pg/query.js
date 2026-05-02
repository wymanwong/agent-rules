/** Converts `?` placeholders to PostgreSQL $1, $2, ... */
export function toPg(sql, params = []) {
  let i = 0;
  const text = sql.replace(/\?/g, () => `$${++i}`);
  return { text, values: params };
}

export async function q(client, sql, params = []) {
  const { text, values } = toPg(sql, params);
  return client.query(text, values);
}

export async function one(client, sql, params = []) {
  const r = await q(client, sql, params);
  return r.rows[0] ?? null;
}

export async function many(client, sql, params = []) {
  const r = await q(client, sql, params);
  return r.rows;
}
