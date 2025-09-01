"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";

import { ArrowLeft } from "./icons";

export const GoBack = ({ title, link }: { title?: string; link?: string }) => {
  const router = useRouter();

  function goBack() {
    if (link) {
      // @ts-ignore its exists
      router.push(link);
    } else {
      router.back();
    }
  }

  return (
    <Button
      aria-label="Go back"
      className="Capitalized"
      startContent={<ArrowLeft size={24} />}
      variant="faded"
      onPress={() => goBack()}
    >
      {title ?? "Go Back"}
    </Button>
  );
};
