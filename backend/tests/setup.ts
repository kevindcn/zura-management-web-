import dotenv from "dotenv";
import path from "path";

// Load test environment strictly from .env.test
dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

// Strict safety check:
const dbUrl = process.env.DATABASE_URL || "";

function extractDatabaseName(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\//, "");
  } catch {
    const parts = url.split("/");
    return parts[parts.length - 1]?.split("?")[0] || "";
  }
}

const dbName = extractDatabaseName(dbUrl);

if (!dbName.endsWith("_test")) {
  throw new Error(
    `FATAL SAFETY VIOLATION: Tests are forbidden from running against non-test databases!\n` +
    `Current database: '${dbName}'\n` +
    `Expected database name ending with '_test' (e.g. jira_clone_test).\n` +
    `Execution terminated immediately to protect dev/production data.`
  );
}

console.log(`[TEST SETUP] Connected to test database: '${dbName}'`);
