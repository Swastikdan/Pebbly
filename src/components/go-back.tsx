"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { type Route } from "next";
export default function GoBack({
  title,
  link,
}: {
  title?: string;
  link?: string;
}) {
  const router = useRouter();

  function goBack() {
    if (link) {
      router.push({ pathname: link } as unknown as Route);
    } else {
      router.back();
    }
  }
  return (
    <Button
      onClick={() => goBack()}
      variant="outline"
      aria-label="Go back"
      className="Capitalized"
    >
      <ArrowLeft size={24} aria-hidden="true" />
      {title ?? "Go Back"}
    </Button>
  );
}
