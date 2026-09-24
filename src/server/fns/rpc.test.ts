import { describe, expect, it, vi } from "vitest";

import type { AuthUser, ClerkSessionClaims } from "../auth";
import { requireUser } from "../auth";
import { authedFn } from "./rpc";

vi.mock("../auth", () => ({
  requireUser: vi.fn(),
  getSessionClaims: vi.fn(),
  findUserByClaims: vi.fn(),
}));

vi.mock("../db/client", () => ({
  getDb: vi.fn(() => ({})),
}));

vi.mock("../env", () => ({
  getEnv: vi.fn(() => ({})),
}));

vi.mock("../rbac", () => ({
  hasFeature: vi.fn(),
  isAdminByClaims: vi.fn((claims: ClerkSessionClaims) => {
    const meta = claims.publicMetadata;
    return (
      typeof meta === "object" &&
      meta !== null &&
      (meta as Record<string, unknown>).isAdmin === true
    );
  }),
}));

vi.mock("@/lib/posthog-server", () => ({
  captureServerException: vi.fn(),
  captureServerEvent: vi.fn(),
}));

function mockAuth(
  user: Partial<AuthUser>,
  claims: Partial<ClerkSessionClaims> = {},
) {
  const fullUser: AuthUser = {
    id: "user-1",
    tokenIdentifier: "clerk|user-1",
    name: "Test User",
    image: null,
    email: "test@example.com",
    roles: [],
    isBanned: false,
    watchlistRev: 0,
    listsRev: 0,
    aiRev: 0,
    permsRev: 0,
    ...user,
  };
  const fullClaims: ClerkSessionClaims = {
    sub: "user-1",
    ...claims,
  };
  vi.mocked(requireUser).mockResolvedValue({
    user: fullUser,
    claims: fullClaims,
    error: null,
  } as never);
}

describe("authedFn ban enforcement & admin protections", () => {
  it("rejects banned users globally with FORBIDDEN on default authenticated calls", async () => {
    mockAuth({ isBanned: true });

    const handler = vi.fn();
    const result = await authedFn({ mode: "require" }, { foo: "bar" }, handler);

    expect(result).toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "Forbidden: account is banned",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("permits banned users only when allowBanned is explicitly true", async () => {
    mockAuth({ isBanned: true });

    const handler = vi
      .fn()
      .mockResolvedValue({ ok: true, data: "user_status" });
    const result = await authedFn(
      { mode: "require", allowBanned: true },
      {},
      handler,
    );

    expect(result).toEqual({ ok: true, data: "user_status" });
    expect(handler).toHaveBeenCalled();
  });

  it("rejects banned users even if they have admin claims", async () => {
    mockAuth({ isBanned: true }, { publicMetadata: { isAdmin: true } });

    const handler = vi.fn();
    const result = await authedFn(
      { mode: "require", admin: true },
      {},
      handler,
    );

    expect(result).toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "Forbidden: account is banned",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("allows unbanned users through to handler", async () => {
    mockAuth({ isBanned: false });

    const handler = vi.fn().mockResolvedValue({ ok: true, data: "success" });
    const result = await authedFn({ mode: "require" }, { test: 1 }, handler);

    expect(result).toEqual({ ok: true, data: "success" });
    expect(handler).toHaveBeenCalled();
  });
});
