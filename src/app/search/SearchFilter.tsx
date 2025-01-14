"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function SearchFilter({
  className,
  activeTypes,
}: {
  className?: string;
  activeTypes: string[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentType = searchParams.get("type") ?? null;

  const [type, setType] = useState(currentType);

  useEffect(() => {
    const isValidType = ["movie", "tv", "person"].includes(type ?? "");
    if (!isValidType) {
      setType(null);
    }
  }, [type]);

  const handleTypeChange = async (newType: string | null) => {
    const updatedParams = new URLSearchParams(searchParams.toString());

    if (newType === type || newType === null) {
      setType(null);
      updatedParams.delete("type");
      updatedParams.delete("page"); // Reset page when changing filter
    } else {
      setType(newType);
      updatedParams.set("type", newType);
      updatedParams.delete("page"); // Reset page when changing filter
    }

    router.push(`?${updatedParams.toString()}`);
  };

  return (
    <div className={cn(className, "flex items-center justify-center gap-2")}>
      <Button
        variant={!type ? "secondary" : "link"}
        onClick={() => handleTypeChange(null)}
        className="w-[84px] hover:no-underline"
      >
        All
      </Button>
      <Button
        variant={type === "movie" ? "secondary" : "link"}
        onClick={() => handleTypeChange("movie")}
        className="w-[84px] hover:no-underline"
        disabled={!activeTypes.includes("movie")}
      >
        Movies
      </Button>
      <Button
        variant={type === "tv" ? "secondary" : "link"}
        onClick={() => handleTypeChange("tv")}
        className="w-[84px] hover:no-underline"
        disabled={!activeTypes.includes("tv")}
      >
        TV Shows
      </Button>
      <Button
        variant={type === "person" ? "secondary" : "link"}
        onClick={() => handleTypeChange("person")}
        className="w-[84px] hover:no-underline"
        disabled={!activeTypes.includes("person")}
      >
        People
      </Button>
    </div>
  );
}
