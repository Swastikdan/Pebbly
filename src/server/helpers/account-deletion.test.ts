import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "../db/client";
import { deleteClerkUser, invalidateUserCache } from "../auth.server";
import {
  processDueAccountDeletions,
  retryFailedClerkDeletions,
} from "./account-deletion";

vi.mock("../auth.server", () => ({
  deleteClerkUser: vi.fn(),
  invalidateUserCache: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function dueRequest(userId: string, clerkUserId: string) {
  return {
    userId,
    clerkUserId,
    status: "pending",
    scheduledFor: Date.now() - 1000,
  };
}

function processDb(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });

  const onConflictDoNothing = vi.fn().mockResolvedValue({});
  const onConflictDoUpdate = vi.fn().mockResolvedValue({});
  const values = vi
    .fn()
    .mockReturnValue({ onConflictDoNothing, onConflictDoUpdate });
  const insert = vi.fn().mockReturnValue({ values });

  const delWhere = vi.fn().mockResolvedValue({});
  const del = vi.fn().mockReturnValue({ where: delWhere });

  const db = {
    run: vi.fn().mockResolvedValue({}),
    select,
    insert,
    delete: del,
  } as unknown as Db;

  return { db, insert, values, onConflictDoNothing, onConflictDoUpdate, del };
}

describe("processDueAccountDeletions", () => {
  it("processes due requests and deletes user data", async () => {
    vi.mocked(deleteClerkUser).mockResolvedValue(true);
    const { db, del, onConflictDoNothing } = processDb([
      dueRequest("user-1", "clerk-1"),
    ]);

    const count = await processDueAccountDeletions(db);

    expect(count).toBe(1);
    expect(deleteClerkUser).toHaveBeenCalledWith("clerk-1");
    expect(invalidateUserCache).toHaveBeenCalledWith("clerk-1");
    // users delete, rate-limit cleanup, and clearing the intent record.
    expect(del).toHaveBeenCalledTimes(3);
    expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
  });

  it("deletes DB data first and rethrows when Clerk deletion fails", async () => {
    vi.mocked(deleteClerkUser).mockResolvedValue(false);
    const { db, onConflictDoUpdate } = processDb([
      dueRequest("user-2", "clerk-2"),
    ]);

    await expect(processDueAccountDeletions(db)).rejects.toThrow(
      AggregateError,
    );
    expect(deleteClerkUser).toHaveBeenCalledWith("clerk-2");
    // The retry record is updated with the failure.
    expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
    expect(invalidateUserCache).toHaveBeenCalledWith("clerk-2");
  });

  it("skips a user when the retry intent cannot be persisted", async () => {
    vi.mocked(deleteClerkUser).mockResolvedValue(true);
    const { db, values, del } = processDb([
      dueRequest("user-int", "clerk-int"),
    ]);
    values.mockReturnValueOnce({
      onConflictDoNothing: vi.fn().mockRejectedValue(new Error("db down")),
      onConflictDoUpdate: vi.fn().mockResolvedValue({}),
    });

    const count = await processDueAccountDeletions(db);

    expect(count).toBe(0);
    expect(deleteClerkUser).not.toHaveBeenCalled();
    expect(invalidateUserCache).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it("still deletes Clerk and records retry when rate-limit cleanup fails", async () => {
    vi.mocked(deleteClerkUser).mockResolvedValue(false);
    const { db, del, onConflictDoUpdate } = processDb([
      dueRequest("user-clean", "clerk-clean"),
    ]);
    del.mockReturnValueOnce({ where: vi.fn().mockResolvedValue({}) });
    del.mockReturnValueOnce({
      where: vi.fn().mockRejectedValue(new Error("cleanup down")),
    });

    await expect(processDueAccountDeletions(db)).rejects.toThrow(
      AggregateError,
    );
    expect(deleteClerkUser).toHaveBeenCalledWith("clerk-clean");
    expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
  });

  it("skips Clerk deletion when the DB delete fails", async () => {
    const { db, del } = processDb([dueRequest("user-3", "clerk-3")]);
    del.mockReturnValueOnce({
      where: vi.fn().mockRejectedValue(new Error("db down")),
    });

    const count = await processDueAccountDeletions(db);

    expect(count).toBe(0);
    expect(deleteClerkUser).not.toHaveBeenCalledWith("clerk-3");
    expect(invalidateUserCache).not.toHaveBeenCalledWith("clerk-3");
  });

  it("records failed Clerk deletions and keeps processing the rest of the batch", async () => {
    // First Clerk delete fails, second succeeds. The batch must not abort.
    vi.mocked(deleteClerkUser)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const { db, values, onConflictDoNothing, onConflictDoUpdate } = processDb([
      dueRequest("user-a", "clerk-a"),
      dueRequest("user-b", "clerk-b"),
    ]);

    await expect(processDueAccountDeletions(db)).rejects.toThrow(
      AggregateError,
    );

    expect(deleteClerkUser).toHaveBeenCalledWith("clerk-a");
    expect(deleteClerkUser).toHaveBeenCalledWith("clerk-b");
    // Intent for both users, plus the failure update for the first.
    expect(values).toHaveBeenCalledTimes(3);
    expect(onConflictDoNothing).toHaveBeenCalledTimes(2);
    expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
  });
});

function retryDb(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn().mockReturnValue({ limit });
  const where = vi.fn().mockReturnValue({ orderBy });
  const leftJoin = vi.fn().mockReturnValue({ where });
  const from = vi.fn().mockReturnValue({ leftJoin });
  const select = vi.fn().mockReturnValue({ from });

  const onConflictDoUpdate = vi.fn().mockResolvedValue({});
  const values = vi.fn().mockReturnValue({
    onConflictDoNothing: vi.fn().mockResolvedValue({}),
    onConflictDoUpdate,
  });
  const insert = vi.fn().mockReturnValue({ values });

  const delWhere = vi.fn().mockResolvedValue({});
  const del = vi.fn().mockReturnValue({ where: delWhere });

  const db = {
    run: vi.fn().mockResolvedValue({}),
    select,
    insert,
    delete: del,
  } as unknown as Db;

  return { db, leftJoin, del, onConflictDoUpdate };
}

describe("retryFailedClerkDeletions", () => {
  it("retries stored failures and clears entries on success", async () => {
    vi.mocked(deleteClerkUser).mockResolvedValue(true);
    const { db, leftJoin, del } = retryDb([
      { clerkUserId: "clerk-x", userId: "user-x" },
    ]);

    const resolved = await retryFailedClerkDeletions(db);

    expect(resolved).toBe(1);
    expect(deleteClerkUser).toHaveBeenCalledWith("clerk-x");
    expect(leftJoin).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledTimes(1);
  });

  it("keeps entries and rethrows when the retried deletion fails again", async () => {
    vi.mocked(deleteClerkUser).mockResolvedValue(false);
    const { db, onConflictDoUpdate, del } = retryDb([
      { clerkUserId: "clerk-y", userId: "user-y" },
    ]);

    await expect(retryFailedClerkDeletions(db)).rejects.toThrow(AggregateError);
    expect(deleteClerkUser).toHaveBeenCalledWith("clerk-y");
    expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
    expect(del).not.toHaveBeenCalled();
  });
});
