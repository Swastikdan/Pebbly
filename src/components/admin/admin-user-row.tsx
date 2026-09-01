import { Ban, Check, ShieldCheck, UserCog, UserX } from "lucide-react";

import type { AdminUser } from "@/components/admin/use-admin-users";
import { ROLE_CONFIGS } from "@/components/admin/use-admin-users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function RoleToggleButtons({
  user,
  isBanned,
  isRolePending,
  onToggleRole,
}: {
  user: AdminUser;
  isBanned: boolean;
  isRolePending: boolean;
  onToggleRole: (role: (typeof ROLE_CONFIGS)[number]["value"]) => void;
}) {
  const currentRoles = (user.roles ?? []).filter(
    (role) => role === "video-player" || role === "ai-integrations",
  ) as (typeof ROLE_CONFIGS)[number]["value"][];

  return (
    <>
      {ROLE_CONFIGS.map((config) => {
        const isActive = currentRoles.includes(config.value);
        return (
          <button
            key={config.value}
            type="button"
            onClick={() => onToggleRole(config.value)}
            disabled={isBanned || isRolePending}
            title={
              isActive ? `Remove ${config.label}` : `Grant ${config.label}`
            }
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
              isActive
                ? "bg-secondary text-foreground border-border"
                : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            {isActive && <Check className="size-3" />}
            {config.short}
          </button>
        );
      })}
    </>
  );
}

function UserBadges({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  return (
    <>
      {user.isAdmin && (
        <Badge
          variant="outline"
          className="shrink-0 border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[10px] font-semibold text-amber-500"
        >
          Admin
        </Badge>
      )}
      {isSelf && (
        <Badge
          variant="outline"
          className="border-border text-muted-foreground shrink-0 px-1.5 py-0 text-[10px] font-semibold"
        >
          You
        </Badge>
      )}
    </>
  );
}

function UserAvatar({ user, size }: { user: AdminUser; size: "sm" | "lg" }) {
  const className =
    size === "sm"
      ? "size-8 rounded-full object-cover ring-1 ring-border"
      : "size-11 rounded-full object-cover shrink-0 ring-1 ring-border/60";
  const fallbackClassName =
    size === "sm"
      ? "flex size-8 items-center justify-center rounded-full bg-secondary ring-1 ring-border"
      : "flex size-11 items-center justify-center rounded-full bg-secondary shrink-0 ring-1 ring-border/60";
  const iconClassName = size === "sm" ? "size-4" : "size-5";

  return user.image ? (
    <img src={user.image} alt={user.name} className={className} />
  ) : (
    <div className={fallbackClassName}>
      <UserCog className={`${iconClassName} text-muted-foreground`} />
    </div>
  );
}

function UserStatusBadge({
  isBanned,
  size,
}: {
  isBanned: boolean;
  size: "sm" | "lg";
}) {
  if (isBanned) {
    return (
      <Badge
        className={`bg-destructive/15 text-destructive border-destructive/30 gap-1 font-semibold ${
          size === "sm" ? "hover:bg-destructive/20" : "shrink-0 py-1 text-xs"
        }`}
      >
        <UserX className="size-3" />
        Banned
      </Badge>
    );
  }
  return (
    <Badge
      className={`gap-1 border-emerald-500/30 bg-emerald-500/15 font-semibold text-emerald-600 dark:text-emerald-400 ${
        size === "sm" ? "hover:bg-emerald-500/20" : "shrink-0 py-1 text-xs"
      }`}
    >
      <ShieldCheck className="size-3" />
      Active
    </Badge>
  );
}

export function AdminUserRow({
  user,
  isSelf,
  isBanned,
  canModify,
  isRolePending,
  onToggleRole,
  onPromptBanToggle,
  variant,
}: {
  user: AdminUser;
  isSelf: boolean;
  isBanned: boolean;
  canModify: boolean;
  isRolePending: boolean;
  onToggleRole: (role: (typeof ROLE_CONFIGS)[number]["value"]) => void;
  onPromptBanToggle: (user: AdminUser) => void;
  variant: "desktop" | "mobile";
}) {
  if (variant === "desktop") {
    return (
      <tr
        className={`border-b transition-colors last:border-0 ${
          isBanned ? "bg-destructive/5" : "hover:bg-muted/20"
        }`}
      >
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-3">
            <UserAvatar user={user} size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{user.name}</span>
                <UserBadges user={user} isSelf={isSelf} />
              </div>
              <p className="text-muted-foreground text-xs">{user.email}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3.5">
          <UserStatusBadge isBanned={isBanned} size="sm" />
        </td>
        <td className="px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-1">
            <RoleToggleButtons
              user={user}
              isBanned={isBanned}
              isRolePending={isRolePending}
              onToggleRole={onToggleRole}
            />
          </div>
        </td>
        <td className="px-4 py-3.5 text-right">
          <Button
            variant={isBanned ? "outline" : "destructive"}
            size="sm"
            className={`h-8 px-3 text-xs font-semibold ${
              isBanned
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                : ""
            }`}
            onClick={() => onPromptBanToggle(user)}
            disabled={!canModify}
            title={
              isSelf
                ? "You cannot ban yourself"
                : user.isAdmin
                  ? "Admin users cannot be banned"
                  : isBanned
                    ? "Unban User"
                    : "Ban User"
            }
          >
            {isBanned ? (
              <>
                <ShieldCheck className="mr-1.5 size-3" />
                Unban
              </>
            ) : (
              <>
                <Ban className="mr-1.5 size-3" />
                Ban
              </>
            )}
          </Button>
        </td>
      </tr>
    );
  }

  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${
        isBanned
          ? "bg-destructive/5 border-destructive/20"
          : "bg-card border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <UserAvatar user={user} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-foreground truncate text-sm font-bold">
                {user.name}
              </span>
              <UserBadges user={user} isSelf={isSelf} />
            </div>
            <p className="text-muted-foreground mt-0.5 truncate text-xs">
              {user.email}
            </p>
          </div>
        </div>

        <UserStatusBadge isBanned={isBanned} size="lg" />
      </div>

      <div className="border-border/40 mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground mr-0.5 text-[11px] font-medium">
            Roles:
          </span>
          {ROLE_CONFIGS.map((config) => {
            const isActive = (user.roles ?? []).includes(config.value);
            return (
              <button
                key={config.value}
                type="button"
                onClick={() => onToggleRole(config.value)}
                disabled={isBanned || isRolePending}
                className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border px-3.5 py-2 text-xs font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
                  isActive
                    ? "bg-secondary text-foreground border-border/80"
                    : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                {isActive && <Check className="size-3.5" />}
                {config.label}
              </button>
            );
          })}
        </div>

        {canModify && (
          <Button
            variant={isBanned ? "outline" : "destructive"}
            size="sm"
            className={`ml-auto h-9 min-h-9 rounded-md px-3.5 text-xs font-semibold ${
              isBanned
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                : ""
            }`}
            onClick={() => onPromptBanToggle(user)}
          >
            {isBanned ? (
              <>
                <ShieldCheck className="mr-1 size-3.5" />
                Unban
              </>
            ) : (
              <>
                <Ban className="mr-1 size-3.5" />
                Ban
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
