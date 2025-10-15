import { Button } from "@/components/ui/button";
import { MoonFilledIcon, SunFilledIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "./theme-provider";

export const ThemeSwitch = () => {
	const { theme, setTheme } = useTheme();
	if (!theme || theme === null) {
		return <Skeleton className="size-9 opacity-80" />;
	}

	return (
		<Button
			variant="outline"
			size="icon"
			onClick={() => setTheme(theme === "light" ? "dark" : "light")}
			className="pressable rounded-[calc(var(--radius-md)+3px)]"
		>
			{theme === "light" ? (
				<SunFilledIcon className="size-5" />
			) : (
				<MoonFilledIcon className="size-5" />
			)}
		</Button>
	);
};
