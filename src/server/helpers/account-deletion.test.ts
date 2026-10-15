import { describe, expect, it, vi } from "vitest";

import type { Db } from "../db/client";
import { deleteClerkUser, invalidateUserCache } from "../auth.server";
import { processDueAccountDeletions } from "./account-deletion";

vi.mock("../auth.server", () => ({
  deleteClerkUser: vi.fn(),
  invalidateUserCache: vi.fn(),
}));

describe("processDueAccountDeletions", () => {
  it("processes due requests and deletes user data", async () => {
    vi.mocked(deleteClerkUser).mockResolvedValue(true);

    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          userId: "user-1",
          clerkUserId: "clerk-1",
          status: "pending",
          scheduledFor: Date.now() - 1000,
        },
      ]),
    };

    const mockDelete = {
      where: vi.fn().mockResolvedValue({}),
    };

    const mockDb = {
      select: vi.fn().mockReturnValue(mockSelect),
      delete: vi.fn().mockReturnValue(mockDelete),
    } as unknown as Db;

    const count = await processDueAccountDeletions(mockDb);

    expect(count).toBe(1);
    expect(deleteClerkUser).toHaveBeenCalledWith("clerk-1");
    expect(invalidateUserCache).toHaveBeenCalledWith("clerk-1");
    expect(mockDb.delete).toHaveBeenCalledTimes(2);
  });

  it("deletes DB data first and rethrows when Clerk deletion fails", async () => {
    vi.mocked(deleteClerkUser).mockResolvedValue(false);

    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          userId: "user-2",
          clerkUserId: "clerk-2",
          status: "pending",
          scheduledFor: Date.now() - 1000,
        },
      ]),
    };

    const mockDelete = {
      where: vi.fn().mockResolvedValue({}),
    };

    const mockDb = {
      select: vi.fn().mockReturnValue(mockSelect),
      delete: vi.fn().mockReturnValue(mockDelete),
    } as unknown as Db;

    await expect(processDueAccountDeletions(mockDb)).rejects.toThrow();
    expect(deleteClerkUser).toHaveBeenCalledWith("clerk-2");
    // DB PII is still deleted first; cache cleanup uses the Clerk sub.
    expect(mockDb.delete).toHaveBeenCalled();
    expect(invalidateUserCache).toHaveBeenCalledWith("clerk-2");
  });

  it("skips Clerk deletion when the DB delete fails", async () => {
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          userId: "user-3",
          clerkUserId: "clerk-3",
          status: "pending",
          scheduledFor: Date.now() - 1000,
        },
      ]),
    };

    const mockDb = {
      select: vi.fn().mockReturnValue(mockSelect),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error("db down")),
      }),
    } as unknown as Db;

    const count = await processDueAccountDeletions(mockDb);

    expect(count).toBe(0);
    expect(deleteClerkUser).not.toHaveBeenCalledWith("clerk-3");
    expect(invalidateUserCache).not.toHaveBeenCalledWith("clerk-3");
  });
});
