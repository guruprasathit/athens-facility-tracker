#!/usr/bin/env node
// scripts/check-kv.mjs
// Run: node scripts/check-kv.mjs
// Verifies your Upstash KV connection before deploying

const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

console.log("\n🔍 Athens Community Tracker — KV Connection Check\n");

// 1. Check env vars exist
console.log("── Environment Variables ──────────────────────────");
if (!KV_URL)    console.error("❌ KV_REST_API_URL     → MISSING");
else            console.log (`✅ KV_REST_API_URL     → ${KV_URL}`);

if (!KV_TOKEN)  console.error("❌ KV_REST_API_TOKEN   → MISSING");
else            console.log (`✅ KV_REST_API_TOKEN   → ${KV_TOKEN.slice(0, 10)}...`);

if (!KV_URL || !KV_TOKEN) {
  console.error("\n💡 Fix: Set env vars in .env.local or Vercel dashboard\n");
  process.exit(1);
}

// 2. DNS check
console.log("\n── DNS Resolution ─────────────────────────────────");
try {
  const { hostname } = new URL(KV_URL);
  const { Resolver } = await import("dns/promises");
  const resolver = new Resolver();
  const addresses = await resolver.resolve4(hostname);
  console.log(`✅ DNS resolved: ${hostname} → ${addresses[0]}`);
} catch (dnsErr) {
  console.error(`❌ DNS FAILED: ${dnsErr.message}`);
  console.error("   → Check KV_REST_API_URL hostname is correct");
  process.exit(1);
}

// 3. Ping KV with a test set/get
console.log("\n── KV Connectivity ────────────────────────────────");
try {
  const testKey = "_ping_test";
  const testVal = Date.now().toString();

  // SET
  const setRes = await fetch(`${KV_URL}/set/${testKey}/${testVal}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const setData = await setRes.json();
  if (setData.result !== "OK") throw new Error("SET failed: " + JSON.stringify(setData));
  console.log("✅ KV SET  → OK");

  // GET
  const getRes = await fetch(`${KV_URL}/get/${testKey}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const getData = await getRes.json();
  if (getData.result !== testVal) throw new Error("GET mismatch: " + JSON.stringify(getData));
  console.log("✅ KV GET  → OK");

  // DELETE
  await fetch(`${KV_URL}/del/${testKey}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  console.log("✅ KV DEL  → OK");

  console.log("\n🎉 All checks passed! KV is working correctly.\n");

} catch (err) {
  console.error(`\n❌ KV test failed: ${err.message}\n`);
  process.exit(1);
}
