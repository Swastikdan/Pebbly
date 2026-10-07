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
    expect(invalidateUserCache).toHaveBeenCalledWith("user-1");
    expect(mockDb.delete).toHaveBeenCalledTimes(2);
  });

  it("skips deletion if Clerk user deletion fails", async () => {
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

    const mockDb = {
      select: vi.fn().mockReturnValue(mockSelect),
      delete: vi.fn(),
    } as unknown as Db;

    const count = await processDueAccountDeletions(mockDb);

    expect(count).toBe(0);
    expect(deleteClerkUser).toHaveBeenCalledWith("clerk-2");
    expect(mockDb.delete).not.toHaveBeenCalled();
  });
});
