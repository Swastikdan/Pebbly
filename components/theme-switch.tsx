"use client";
import { useCallback } from "react";
import { Button, ButtonProps } from "@heroui/button";
import { useTheme } from "next-themes";
import { useIsSSR } from "@react-aria/ssr";

import { cn } from "@/lib/utils";

import { MoonFilledIcon, SunFilledIcon, IconProps } from "./icons";

type ThemeSwitchProps = ButtonProps & {
  iconProps?: IconProps;
};

export const ThemeSwitch = ({ iconProps, ...props }: ThemeSwitchProps) => {
  const { theme, setTheme } = useTheme();
  const isSSR = useIsSSR();

  // useCallback for performance and reference stability
  const onChange = useCallback(() => {
    if (theme === "light") {
      setTheme("dark");
    } else {
      setTheme("light");
    }
  }, [theme, setTheme]);

  const renderIcon =
    theme === "light" || isSSR ? (
      <SunFilledIcon className={cn("size-5", iconProps?.className)} />
    ) : (
      <MoonFilledIcon className={cn("size-5", iconProps?.className)} />
    );

  return (
    <Button
      isIconOnly
      variant="flat"
      {...props}
      aria-label="Switch theme"
      startContent={renderIcon}
      onPress={onChange}
    />
  );
};

ThemeSwitch.displayName = "ThemeSwitch";
