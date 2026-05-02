import os from "os";
import { openDb } from "./db.js";
import { createApp } from "./app.js";

const db = openDb();
const app = createApp(db);

const port = Number(process.env.PORT) || 3840;
const host = process.env.HOST || "0.0.0.0";

function lanIPv4s() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const addr of nets[name] || []) {
      if (addr.family === "IPv4" && !addr.internal) out.push(addr.address);
    }
  }
  return out;
}

app.listen(port, host, () => {
  console.log("");
  console.log("IT Helpdesk — open in browser:");
  console.log(`  • This machine:     http://localhost:${port}/`);
  const ips = lanIPv4s();
  if (ips.length) {
    console.log("  • Phone / other PC: use your LAN IP (not localhost), e.g.:");
    for (const ip of ips) console.log(`      http://${ip}:${port}/`);
  } else {
    console.log("  • Other devices: set HOST and PORT; firewall must allow inbound TCP.");
  }
  console.log(`  API base: /api/v1`);
  console.log("");
});
