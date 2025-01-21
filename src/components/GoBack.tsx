"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
export default function GoBack({ link }: { link?: string }) {
  const router = useRouter();
  function goBack() {
    if (link) {
      router.push(link);
    } else {
      router.back();
    }
  }
  return (
    <Button onClick={() => goBack()} variant="outline">
      <ArrowLeft size={24} /> Go Back
    </Button>
  );
}
