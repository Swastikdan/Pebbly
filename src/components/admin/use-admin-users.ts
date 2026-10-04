import { useUser } from "@clerk/react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { RbacRole } from "@/constants";
import { destructiveToast, toast } from "@/lib/notifications";
import { queryKeys } from "@/lib/query/keys";
import { logError } from "@/lib/utils";
import { listUsers, setUserBanned, setUserRoles } from "@/server/fns/admin";
import { unwrap } from "@/server/schema/common";

export type DynamicRbacRole = Exclude<RbacRole, "admin">;

export const ROLE_CONFIGS: {
  value: DynamicRbacRole;
  label: string;
  short: string;
}[] = [
  { value: "ai-integrations", label: "AI Integrations", short: "AI" },
  { value: "external-redirect", label: "External Redirect", short: "External" },
];

export interface AdminUser {
  _id: string;
  tokenIdentifier: string;
  name: string;
  email: string;
  image: string | null;
  roles: string[];
  isBanned: boolean;
  isAdmin: boolean;
}

export interface UserTarget {
  tokenIdentifier: string;
  name: string;
  email: string;
  isBanned: boolean;
}

export type FilterTab = "all" | "active" | "banned";

export function useAdminUsers() {
  const { user: currentUser } = useUser();
  const queryClient = useQueryClient();
  const usersQuery = useQuery({
    queryKey: queryKeys.admin.users(currentUser?.id),
    queryFn: () => unwrap(listUsers({ data: {} })),
    // Keep the admin list fresh while an admin has the page open. This hook
    // only ever mounts inside the admin-gated route (and listUsers is
    // requireAdmin-protected server-side), so non-admins never fetch or sync
    // admin data. Pauses when the tab is hidden.
    refetchInterval: 10_000,
  });
  const refreshUsers = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.admin.users(currentUser?.id),
    });
  };
  // Any role/ban change alters effective feature access, so also refresh the
  // current user's (admins included) permissions right away instead of
  // waiting for the next data-version poll.
  const refreshPermissions = () =>
    void queryClient.invalidateQueries({ queryKey: ["permissions"] });
  const setUserRolesMutation = useMutation({
    mutationFn: (args: { tokenIdentifier: string; roles: DynamicRbacRole[] }) =>
      unwrap(setUserRoles({ data: args })),
    onSuccess: () => {
      refreshUsers();
      refreshPermissions();
    },
  });
  const setUserBannedMutation = useMutation({
    mutationFn: (args: { tokenIdentifier: string; banned: boolean }) =>
      unwrap(setUserBanned({ data: args })),
    onSuccess: () => {
      refreshUsers();
      refreshPermissions();
    },
  });

  const [selectedUser, setSelectedUser] = useState<UserTarget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleOverrides, setRoleOverrides] = useState<
    Map<string, DynamicRbacRole[]>
  >(new Map());
  const [bannedOverrides, setBannedOverrides] = useState<Map<string, boolean>>(
    new Map(),
  );
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");

  const users = usersQuery.data;

  const effectiveUsers = useMemo(() => {
    return (users ?? []).map((user) => {
      const isBannedOverride = bannedOverrides.get(user.tokenIdentifier);
      const rolesOverride = roleOverrides.get(user.tokenIdentifier);
      return {
        ...user,
        isBanned:
          isBannedOverride !== undefined ? isBannedOverride : user.isBanned,
        roles: rolesOverride !== undefined ? rolesOverride : user.roles,
      };
    });
  }, [users, bannedOverrides, roleOverrides]);

  const handleConfirmBanToggle = async () => {
    if (!selectedUser) return;
    const target = selectedUser;
    setSelectedUser(null);
    setErrorMessage(null);

    const willBan = !target.isBanned;

    // Immediately optimistic on client (0ms)
    setBannedOverrides((prev) =>
      new Map(prev).set(target.tokenIdentifier, willBan),
    );

    if (willBan) {
      // Destructive action: Ban User
      destructiveToast({
        title: "User banned",
        description: target.name || target.email,
        onUndo: () => {
          // Revert client state immediately - 0 server calls
          setBannedOverrides((prev) => {
            const next = new Map(prev);
            next.set(target.tokenIdentifier, false);
            return next;
          });
        },
        onConfirm: async () => {
          try {
            await setUserBannedMutation.mutateAsync({
              tokenIdentifier: target.tokenIdentifier,
              banned: true,
            });
          } catch (err) {
            logError("Ban user error", err);
          }
        },
      });
      return;
    }

    // Additive/restorative action: Unban User
    try {
      await setUserBannedMutation.mutateAsync({
        tokenIdentifier: target.tokenIdentifier,
        banned: false,
      });
      toast({
        title: "User unbanned",
        description: target.name || target.email,
      });
    } catch (err) {
      logError("Unban user error", err);
      setBannedOverrides((prev) => {
        const next = new Map(prev);
        next.set(target.tokenIdentifier, true);
        return next;
      });
    }
  };

  const lowerSearch = search.toLowerCase().trim();
  const hasValidSearch = lowerSearch.length >= 2;
  const filteredUsers = effectiveUsers.filter((user) => {
    const matchesSearch =
      !hasValidSearch ||
      user.name.toLowerCase().includes(lowerSearch) ||
      user.email.toLowerCase().includes(lowerSearch);

    const matchesFilter =
      filterTab === "all" ||
      (filterTab === "active" && !user.isBanned) ||
      (filterTab === "banned" && user.isBanned);

    return matchesSearch && matchesFilter;
  });

  const filterTabs: { id: FilterTab; label: string; count: number }[] = [
    { id: "all", label: "All", count: effectiveUsers.length },
    {
      id: "active",
      label: "Active",
      count: effectiveUsers.filter((u) => !u.isBanned).length,
    },
    {
      id: "banned",
      label: "Banned",
      count: effectiveUsers.filter((u) => u.isBanned).length,
    },
  ];

  const getCurrentRoles = (user: AdminUser): DynamicRbacRole[] =>
    (
      roleOverrides.get(user.tokenIdentifier) ??
      user.roles ??
      []
    ).filter(
      (role) => role === "ai-integrations" || role === "external-redirect",
    ) as DynamicRbacRole[];

  const isSelf = (user: AdminUser) =>
    currentUser?.id === user.tokenIdentifier ||
    `clerk|${currentUser?.id}` === user.tokenIdentifier;

  const toggleRole = (user: AdminUser, role: DynamicRbacRole) => {
    setRoleError(null);
    const currentRoles = getCurrentRoles(user);
    const isRemoving = currentRoles.includes(role);
    const next = isRemoving
      ? currentRoles.filter((r) => r !== role)
      : [...currentRoles, role];

    // Immediately optimistic on client (0ms)
    setRoleOverrides((prev) => new Map(prev).set(user.tokenIdentifier, next));

    if (isRemoving) {
      const config = ROLE_CONFIGS.find((c) => c.value === role);
      const roleLabel = config?.label ?? role;
      destructiveToast({
        title: `Role removed: ${roleLabel}`,
        description: `${user.name}`,
        onUndo: () => {
          // Revert client state immediately - 0 server calls
          setRoleOverrides((prev) => {
            const m = new Map(prev);
            m.set(user.tokenIdentifier, currentRoles);
            return m;
          });
        },
        onConfirm: async () => {
          try {
            await setUserRolesMutation.mutateAsync({
              tokenIdentifier: user.tokenIdentifier,
              roles: next,
            });
          } catch (err) {
            setRoleOverrides((prev) => {
              const m = new Map(prev);
              m.set(user.tokenIdentifier, currentRoles);
              return m;
            });
            setRoleError(err instanceof Error ? err.message : String(err));
          }
        },
      });
      return;
    }

    // Additive: granting role
    setUserRolesMutation
      .mutateAsync({
        tokenIdentifier: user.tokenIdentifier,
        roles: next,
      })
      .catch((err) => {
        setRoleOverrides((prev) => {
          const m = new Map(prev);
          m.set(user.tokenIdentifier, currentRoles);
          return m;
        });
        setRoleError(err instanceof Error ? err.message : String(err));
      });
  };

  const promptBanToggle = (user: AdminUser) => {
    setErrorMessage(null);
    setSelectedUser({
      tokenIdentifier: user.tokenIdentifier,
      name: user.name,
      email: user.email,
      isBanned: user.isBanned,
    });
  };

  return {
    currentUser,
    users,
    loading: users === undefined,
    filteredUsers,
    filterTabs,
    search,
    setSearch,
    filterTab,
    setFilterTab,
    roleError,
    setRoleError,
    selectedUser,
    setSelectedUser,
    isSubmitting,
    errorMessage,
    handleConfirmBanToggle,
    getCurrentRoles,
    isSelf,
    toggleRole,
    promptBanToggle,
    setUserRolesMutation,
  };
}
