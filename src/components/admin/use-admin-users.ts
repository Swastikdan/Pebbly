import { useUser } from "@clerk/react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { RbacRole } from "@/constants";
import { queryKeys } from "@/lib/query/keys";
import { listUsers, setUserBanned, setUserRoles } from "@/server/fns/admin";
import { unwrap } from "@/server/schema/common";

export type DynamicRbacRole = Exclude<RbacRole, "admin">;

export const ROLE_CONFIGS: {
  value: DynamicRbacRole;
  label: string;
  short: string;
}[] = [
  { value: "video-player", label: "Video Player", short: "Video" },
  { value: "ai-integrations", label: "AI Integrations", short: "AI" },
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
  const setUserRolesMutation = useMutation({
    mutationFn: (args: { tokenIdentifier: string; roles: DynamicRbacRole[] }) =>
      unwrap(setUserRoles({ data: args })),
    onSuccess: refreshUsers,
  });
  const setUserBannedMutation = useMutation({
    mutationFn: (args: { tokenIdentifier: string; banned: boolean }) =>
      unwrap(setUserBanned({ data: args })),
    onSuccess: refreshUsers,
  });

  const [selectedUser, setSelectedUser] = useState<UserTarget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");

  const users = usersQuery.data;

  const handleConfirmBanToggle = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await setUserBannedMutation.mutateAsync({
        tokenIdentifier: selectedUser.tokenIdentifier,
        banned: !selectedUser.isBanned,
      });
      setSelectedUser(null);
    } catch (err) {
      console.error("Ban user error:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to update user status",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const lowerSearch = search.toLowerCase().trim();
  const filteredUsers = (users ?? []).filter((user) => {
    const matchesSearch =
      !lowerSearch ||
      user.name.toLowerCase().includes(lowerSearch) ||
      user.email.toLowerCase().includes(lowerSearch);

    const matchesFilter =
      filterTab === "all" ||
      (filterTab === "active" && !user.isBanned) ||
      (filterTab === "banned" && user.isBanned);

    return matchesSearch && matchesFilter;
  });

  const filterTabs: { id: FilterTab; label: string; count: number }[] = [
    { id: "all", label: "All", count: users?.length ?? 0 },
    {
      id: "active",
      label: "Active",
      count: (users ?? []).filter((u) => !u.isBanned).length,
    },
    {
      id: "banned",
      label: "Banned",
      count: (users ?? []).filter((u) => u.isBanned).length,
    },
  ];

  const getCurrentRoles = (user: AdminUser): DynamicRbacRole[] =>
    (user.roles ?? []).filter(
      (role) => role === "video-player" || role === "ai-integrations",
    ) as DynamicRbacRole[];

  const isSelf = (user: AdminUser) =>
    currentUser?.id === user.tokenIdentifier ||
    `clerk|${currentUser?.id}` === user.tokenIdentifier;

  const toggleRole = (user: AdminUser, role: DynamicRbacRole) => {
    setRoleError(null);
    const currentRoles = getCurrentRoles(user);
    const next = currentRoles.includes(role)
      ? currentRoles.filter((r) => r !== role)
      : [...currentRoles, role];
    setUserRolesMutation
      .mutateAsync({
        tokenIdentifier: user.tokenIdentifier,
        roles: next,
      })
      .catch((err) => {
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
