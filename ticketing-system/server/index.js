import { openDb } from "./db.js";
import { createApp } from "./app.js";

const db = openDb();
const app = createApp(db);

const port = Number(process.env.PORT) || 3840;
const host = process.env.HOST || "0.0.0.0";
app.listen(port, host, () => {
  console.log(`IT Helpdesk UI + API → http://${host === "0.0.0.0" ? "localhost" : host}:${port}/   (API /api/v1)`);
});
