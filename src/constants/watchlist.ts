import type { ComponentType } from "react";
import {
	CheckCircle,
	Clock,
	Eye,
	Heart,
} from "@/components/ui/icons";
import { Frown, Meh, Smile, X } from "lucide-react";
import type { ProgressStatus, ReactionStatus } from "@/types";

export const PROGRESS_OPTIONS: Array<{
	value: ProgressStatus;
	label: string;
	icon: ComponentType<{ size?: string | number; className?: string }>;
	tvOnly?: boolean;
}> = [
	{ value: "watch-later", label: "Watch Later", icon: Clock },
	{ value: "watching", label: "Watching", icon: Eye },
	{ value: "done", label: "Done", icon: CheckCircle },
	{ value: "dropped", label: "Dropped", icon: X, tvOnly: true },
];

export const REACTION_OPTIONS: Array<{
	value: ReactionStatus;
	label: string;
	icon: ComponentType<{ size?: string | number; className?: string }>;
	emoji: string;
}> = [
	{ value: "loved", label: "Loved", icon: Heart, emoji: "\u2764\uFE0F" },
	{ value: "liked", label: "Liked", icon: Smile, emoji: "\uD83D\uDE0A" },
	{ value: "mixed", label: "Mixed", icon: Meh, emoji: "\uD83D\uDE10" },
	{ value: "not-for-me", label: "Not for me", icon: Frown, emoji: "\uD83D\uDE15" },
];

export const PROGRESS_LABELS: Record<ProgressStatus, string> = {
	"watch-later": "Watch Later",
	watching: "Watching",
	done: "Done",
	dropped: "Dropped",
};

export function getProgressOption(status: ProgressStatus) {
	return PROGRESS_OPTIONS.find((o) => o.value === status) ?? PROGRESS_OPTIONS[0];
}

export function getReactionOption(reaction: ReactionStatus) {
	return REACTION_OPTIONS.find((o) => o.value === reaction) ?? null;
}
