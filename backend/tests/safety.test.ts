import { describe, it, expect } from "vitest";

describe("Database Safety Guard Check", () => {
  it("rejects non-test databases if url does not end with _test", () => {
    function validateTestDatabase(url: string) {
      function extractDatabaseName(u: string): string {
        try {
          const parsed = new URL(u);
          return parsed.pathname.replace(/^\//, "");
        } catch {
          const parts = u.split("/");
          return parts[parts.length - 1]?.split("?")[0] || "";
        }
      }

      const dbName = extractDatabaseName(url);
      if (!dbName.endsWith("_test")) {
        throw new Error(
          `FATAL SAFETY VIOLATION: Database '${dbName}' does not end with '_test'`
        );
      }
      return true;
    }

    // Must reject production or dev DB names
    expect(() => validateTestDatabase("postgresql://user:pass@localhost:5432/jira_clone")).toThrow(
      "FATAL SAFETY VIOLATION"
    );
    expect(() => validateTestDatabase("postgresql://user:pass@localhost:5432/production_db")).toThrow(
      "FATAL SAFETY VIOLATION"
    );
    expect(() => validateTestDatabase("postgresql://user:pass@localhost:5432/jira_clone_dev?schema=public")).toThrow(
      "FATAL SAFETY VIOLATION"
    );

    // Must accept valid test DB names
    expect(validateTestDatabase("postgresql://user:pass@localhost:5432/jira_clone_test")).toBe(true);
    expect(validateTestDatabase("postgresql://user:pass@localhost:5432/my_app_test?schema=public")).toBe(true);
  });
});
