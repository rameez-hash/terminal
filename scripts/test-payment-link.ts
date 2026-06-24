/**
 * Test script: login as seller, create payment link, show demo URL
 * Run: npx tsx scripts/test-payment-link.ts
 */

const BASE = process.env.NEXTAUTH_URL || "http://localhost:3000";

async function login(email: string, password: string) {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const cookies = csrfRes.headers.get("set-cookie") || "";

  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies,
    },
    body: new URLSearchParams({
      csrfToken,
      email,
      password,
      callbackUrl: `${BASE}/seller`,
      json: "true",
    }),
    redirect: "manual",
  });

  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("Login failed — no session cookie");
  return setCookie.split(",").map((c) => c.split(";")[0].trim()).join("; ");
}

async function main() {
  console.log("=== Payment Link Demo Test ===\n");

  console.log("1. Logging in as seller (john@salesportal.com)...");
  const cookie = await login("john@salesportal.com", "seller123");
  console.log("   ✅ Login OK\n");

  console.log("2. Fetching clients...");
  const clientsRes = await fetch(`${BASE}/api/clients?limit=5`, {
    headers: { Cookie: cookie },
  });
  const clientsData = await clientsRes.json();
  const client = clientsData.data?.[0];
  if (!client) throw new Error("No clients found — run: npx tsx prisma/seed.ts");
  console.log(`   ✅ Client: ${client.name} (${client.email})\n`);

  console.log("3. Creating payment link ($2,500 USD, STRIPE demo)...");
  const createRes = await fetch(`${BASE}/api/payment-links`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      clientId: client.id,
      amount: 2500,
      currency: "USD",
      description: "Website Development - Demo",
      provider: "STRIPE",
    }),
  });
  const link = await createRes.json();
  if (!createRes.ok) throw new Error(link.error || "Create failed");

  console.log("   ✅ Payment link created!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📎 DEMO PAYMENT LINK:");
  console.log(`   ${link.externalUrl}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log("Details:");
  console.log(`   ID:       ${link.id}`);
  console.log(`   Amount:   $${link.amount} ${link.currency}`);
  console.log(`   Client:   ${link.client.name}`);
  console.log(`   Provider: ${link.provider} (demo mode)`);
  console.log(`   Status:   ${link.status}\n`);

  console.log("4. Simulating payment (demo pay)...");
  const payRes = await fetch(`${BASE}/api/payment-links/${link.id}`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  const payData = await payRes.json();
  if (!payRes.ok) throw new Error(payData.error || "Pay simulate failed");
  console.log("   ✅ Payment successful!\n");

  console.log("5. Checking seller target...");
  const targetsRes = await fetch(`${BASE}/api/targets`, {
    headers: { Cookie: cookie },
  });
  const targetsData = await targetsRes.json();
  const target = targetsData.data?.[0];
  if (target) {
    console.log(`   Target:    $${target.targetAmount}`);
    console.log(`   Achieved:  $${target.achievedAmount}`);
    console.log(`   Remaining: $${target.remainingAmount}`);
    console.log(`   Progress:  ${target.completionPercentage}%\n`);
  }

  console.log("=== Test Complete ===");
  console.log(`Open in browser: ${link.externalUrl}`);
}

main().catch((e) => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
