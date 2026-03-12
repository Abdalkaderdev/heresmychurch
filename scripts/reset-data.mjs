#!/usr/bin/env node
/**
 * Reset script to clear US church data and prepare for Middle East population.
 *
 * Usage:
 *   1. Deploy the updated server function first:
 *      npx supabase login
 *      npx supabase functions deploy server --no-verify-jwt
 *
 *   2. Then run this script:
 *      node scripts/reset-data.mjs
 */

const projectId = "epufchwxofsyuictfufy";
const publicAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwdWZjaHd4b2ZzeXVpY3RmdWZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NzcxMTUsImV4cCI6MjA4ODU1MzExNX0.v11kHHpM1IsK6q81909CYkWgX5TdV8kJhCkNqSEs5QM";

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-283d8046`;

async function resetData() {
  console.log("Resetting church data...");

  try {
    const res = await fetch(`${BASE_URL}/admin/reset-all`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${publicAnonKey}`,
      },
    });

    const data = await res.json();
    console.log("Reset result:", data);

    if (data.error) {
      console.error("Error:", data.error);
      process.exit(1);
    }

    console.log("\nData cleared successfully!");
    console.log("Now you can populate Middle East countries by clicking on them in the app.");

  } catch (err) {
    console.error("Failed to reset:", err.message);
    console.log("\nMake sure the server function is deployed with the reset endpoint.");
    process.exit(1);
  }
}

// Middle East countries to populate
const MIDDLE_EAST_COUNTRIES = [
  { code: "LB", name: "Lebanon" },
  { code: "EG", name: "Egypt" },
  { code: "JO", name: "Jordan" },
  { code: "IQ", name: "Iraq" },
  { code: "SY", name: "Syria" },
  { code: "TR", name: "Turkey" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "QA", name: "Qatar" },
  { code: "KW", name: "Kuwait" },
  { code: "BH", name: "Bahrain" },
  { code: "OM", name: "Oman" },
  { code: "PS", name: "Palestine" },
  { code: "DZ", name: "Algeria" },
  { code: "MA", name: "Morocco" },
  { code: "TN", name: "Tunisia" },
  { code: "LY", name: "Libya" },
  { code: "SD", name: "Sudan" },
  { code: "YE", name: "Yemen" },
  { code: "DJ", name: "Djibouti" },
  { code: "SO", name: "Somalia" },
  { code: "MR", name: "Mauritania" },
  { code: "KM", name: "Comoros" },
];

async function populateCountry(code, name) {
  console.log(`Populating ${name} (${code})...`);

  try {
    const res = await fetch(`${BASE_URL}/churches/populate/${code}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${publicAnonKey}`,
      },
    });

    const data = await res.json();

    if (data.error) {
      console.log(`  ⚠ ${name}: ${data.error}`);
      return 0;
    }

    const count = data.count || 0;
    console.log(`  ✓ ${name}: ${count} churches`);
    return count;

  } catch (err) {
    console.log(`  ✗ ${name}: ${err.message}`);
    return 0;
  }
}

async function populateAllCountries() {
  console.log("\nPopulating Middle East countries with church data...\n");

  let totalChurches = 0;

  // Countries with highest expected church counts first
  const priorityOrder = ["LB", "EG", "SY", "IQ", "JO", "TR", "PS", "SA", "AE"];
  const sorted = [...MIDDLE_EAST_COUNTRIES].sort((a, b) => {
    const aIdx = priorityOrder.indexOf(a.code);
    const bIdx = priorityOrder.indexOf(b.code);
    if (aIdx === -1 && bIdx === -1) return 0;
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  for (const { code, name } of sorted) {
    const count = await populateCountry(code, name);
    totalChurches += count;
    // Wait between requests to avoid rate limiting
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n=== Total: ${totalChurches} churches across ${MIDDLE_EAST_COUNTRIES.length} countries ===`);
}

// Run
const args = process.argv.slice(2);

if (args.includes("--reset")) {
  resetData();
} else if (args.includes("--populate")) {
  populateAllCountries();
} else if (args.includes("--all")) {
  resetData().then(() => {
    console.log("\nWaiting 3 seconds before populating...\n");
    return new Promise(r => setTimeout(r, 3000));
  }).then(() => populateAllCountries());
} else {
  console.log(`
Usage:
  node scripts/reset-data.mjs --reset     Clear all existing US church data
  node scripts/reset-data.mjs --populate  Populate Middle East countries
  node scripts/reset-data.mjs --all       Reset then populate

Note: You must deploy the server function first:
  npx supabase login
  npx supabase functions deploy server --no-verify-jwt
`);
}
