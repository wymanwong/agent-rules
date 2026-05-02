import { createDb } from "./db.js";
import { createApp } from "./app.js";

const db = await createDb();
const app = createApp(db);

const port = Number(process.env.PORT) || 3840;
app.listen(port, () => {
  console.log(`IT Ticketing API at http://localhost:${port}/api/v1 (PostgreSQL)`);
});
