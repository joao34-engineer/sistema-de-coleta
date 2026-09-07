import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("progress skip delivered migration (phase 5)", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../supabase/migrations/20260907020000_phase_5_progress_skip_delivered.sql"),
    "utf8",
  );

  it("replaces update_service_progress with CREATE OR REPLACE and no DROP FUNCTION", () => {
    expect(sql).toMatch(/create or replace function public\.update_service_progress\(/i);
    expect(sql.match(/create or replace function/gi)).toHaveLength(1);
    expect(sql).not.toMatch(/^\s*drop function/im);
  });

  it("does not emit GRANT statements", () => {
    expect(sql).not.toMatch(/^\s*grant\b/im);
  });

  it("raises item_already_delivered before writing a delivery_items id", () => {
    const writeLoop = sql.slice(
      sql.indexOf("for item_record in select * from jsonb_to_recordset"),
      sql.indexOf("end loop;"),
    );
    expect(writeLoop).toContain("from public.delivery_items as di");
    expect(writeLoop).toContain("errcode = 'P0001', message = 'item_already_delivered'");
    expect(writeLoop.indexOf("item_already_delivered")).toBeLessThan(writeLoop.indexOf("update public.service_order_items"));
  });
});
