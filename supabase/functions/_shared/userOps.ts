import type postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

type Sql = ReturnType<typeof postgres>;
type Args = Record<string, unknown>;

/**
 * The only database changes a regular (non-admin) user may make.
 * Every statement is parameterised and scoped to the user id taken from the
 * verified token, so a user can never read or change another user's rows.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REPEATS = new Set(["week", "month", "3months", "year"]);
const MAX_TEXT = 5000;

export class BadRequest extends Error {}

function text(args: Args, key: string, optional = false): string | null {
  const v = args[key];
  if ((v === undefined || v === null || v === "") && optional) return null;
  if (typeof v !== "string" || v.length > MAX_TEXT) throw new BadRequest(`Invalid ${key}`);
  return v;
}

function date(args: Args, key: string): string {
  const v = String(args[key] ?? "").split("T")[0];
  if (!DATE_RE.test(v)) throw new BadRequest(`Invalid ${key}`);
  return v;
}

function uuid(args: Args, key: string, optional = false): string | null {
  const v = args[key];
  if ((v === undefined || v === null || v === "") && optional) return null;
  if (typeof v !== "string" || !UUID_RE.test(v)) throw new BadRequest(`Invalid ${key}`);
  return v;
}

function int(args: Args, key: string, min: number, max: number): number {
  const v = Number(args[key]);
  if (!Number.isInteger(v) || v < min || v > max) throw new BadRequest(`Invalid ${key}`);
  return v;
}

export async function runUserOp(sql: Sql, userId: string, op: string, args: Args): Promise<unknown[]> {
  switch (op) {
    case "add-task": {
      const groupId = uuid(args, "recurringGroupId", true);
      return await sql`
        INSERT INTO life_navigator.tasks (user_id, text, date, completed, recurring_group_id)
        VALUES (${userId}::uuid, ${text(args, "text")}, ${date(args, "date")}, false, ${groupId})
        RETURNING *`;
    }
    case "toggle-task":
      return await sql`
        UPDATE life_navigator.tasks SET completed = NOT completed
        WHERE id = ${uuid(args, "taskId")}::uuid AND user_id = ${userId}::uuid
        RETURNING *`;
    case "update-task":
      return await sql`
        UPDATE life_navigator.tasks SET text = ${text(args, "text")}
        WHERE id = ${uuid(args, "taskId")}::uuid AND user_id = ${userId}::uuid
        RETURNING *`;
    case "delete-task": {
      const groupId = uuid(args, "recurringGroupId", true);
      if (groupId) {
        return await sql`
          DELETE FROM life_navigator.tasks
          WHERE recurring_group_id = ${groupId}::uuid AND user_id = ${userId}::uuid
          RETURNING id`;
      }
      return await sql`
        DELETE FROM life_navigator.tasks
        WHERE id = ${uuid(args, "taskId")}::uuid AND user_id = ${userId}::uuid
        RETURNING id`;
    }

    case "add-habit": {
      const repeat = String(args.repeat);
      if (!REPEATS.has(repeat)) throw new BadRequest("Invalid repeat");
      return await sql`
        INSERT INTO life_navigator.habits (user_id, text, start_date, end_date, repeat)
        VALUES (${userId}::uuid, ${text(args, "text")}, ${date(args, "startDate")}, ${date(args, "endDate")}, ${repeat})
        RETURNING *`;
    }
    case "update-habit":
      return await sql`
        UPDATE life_navigator.habits SET text = ${text(args, "text")}
        WHERE id = ${uuid(args, "habitId")}::uuid AND user_id = ${userId}::uuid
        RETURNING *`;
    case "delete-habit":
      return await sql`
        DELETE FROM life_navigator.habits
        WHERE id = ${uuid(args, "habitId")}::uuid AND user_id = ${userId}::uuid
        RETURNING id`;
    case "set-habit-completion": {
      const habitId = uuid(args, "habitId");
      const day = date(args, "date");
      const owned = await sql`
        SELECT 1 FROM life_navigator.habits WHERE id = ${habitId}::uuid AND user_id = ${userId}::uuid`;
      if (owned.length === 0) throw new BadRequest("Habit not found");
      if (args.completed === true) {
        return await sql`
          INSERT INTO life_navigator.habit_completions (habit_id, date)
          VALUES (${habitId}::uuid, ${day})
          ON CONFLICT (habit_id, date) DO UPDATE SET date = EXCLUDED.date
          RETURNING *`;
      }
      return await sql`
        DELETE FROM life_navigator.habit_completions
        WHERE habit_id = ${habitId}::uuid AND date = ${day}
        RETURNING id`;
    }

    case "save-achievement":
      return await sql`
        INSERT INTO life_navigator.achievements (user_id, date, achievement_1, achievement_2, achievement_3)
        VALUES (${userId}::uuid, ${date(args, "date")},
          ${text(args, "achievement1", true)}, ${text(args, "achievement2", true)}, ${text(args, "achievement3", true)})
        ON CONFLICT (user_id, date) DO UPDATE SET
          achievement_1 = EXCLUDED.achievement_1,
          achievement_2 = EXCLUDED.achievement_2,
          achievement_3 = EXCLUDED.achievement_3
        RETURNING *`;

    case "save-year-goal": {
      const year = int(args, "year", 2000, 2100);
      const goal = text(args, "goal", true) ?? "";
      // month is NULL for year goals, so UNIQUE does not prevent duplicates: update the latest row if present.
      const updated = await sql`
        UPDATE life_navigator.user_goals SET goal_text = ${goal}, updated_at = now()
        WHERE id = (
          SELECT id FROM life_navigator.user_goals
          WHERE user_id = ${userId}::uuid AND type = 'year' AND year = ${year} AND month IS NULL
          ORDER BY updated_at DESC NULLS LAST, created_at DESC
          LIMIT 1
        )
        RETURNING *`;
      if (updated.length > 0) return updated;
      return await sql`
        INSERT INTO life_navigator.user_goals (user_id, type, year, month, goal_text)
        VALUES (${userId}::uuid, 'year', ${year}, NULL, ${goal})
        RETURNING *`;
    }
    case "save-month-goal":
      return await sql`
        INSERT INTO life_navigator.user_goals (user_id, type, year, month, goal_text)
        VALUES (${userId}::uuid, 'month', ${int(args, "year", 2000, 2100)}, ${int(args, "month", 1, 12)}, ${text(args, "goal", true) ?? ""})
        ON CONFLICT (user_id, type, year, month) DO UPDATE SET
          goal_text = EXCLUDED.goal_text,
          updated_at = now()
        RETURNING *`;

    default:
      throw new BadRequest("Unknown operation");
  }
}
