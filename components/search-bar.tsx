"use client";

import React, { useEffect, useState, useCallback, memo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Form } from "@heroui/form";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Skeleton } from "@heroui/skeleton";

import { SearchIcon } from "./icons";

export function Searchbar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const query = searchParams.get("query") ?? "";

  useEffect(() => {
    if (query) setSearch(query);
  }, [query]);

  const submit = useCallback(
    (term: string) => {
      const trimmed = term.trim();

      if (!trimmed) return;
      router.push(`/search?query=${encodeURIComponent(trimmed)}`);
    },
    [router],
  );

  const handleSubmit = useCallback(
    // eslint-disable-next-line no-undef
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      submit(search);
    },
    [submit, search],
  );

  return (
    <Form className="flex w-full flex-row gap-2" onSubmit={handleSubmit}>
      <Input
        fullWidth
        isClearable
        className="flex-1"
        placeholder="👀 What movie, show? Let's find it!"
        size="lg"
        startContent={<SearchIcon className="size-5" />}
        value={search}
        variant="faded"
        onChange={(e) => setSearch(e.target.value)}
        onClear={() => setSearch("")}
      />
      {search.trim() !== "" && (
        <Button
          aria-label="Submit Search"
          className="shrink-0 hidden md:flex"
          size="lg"
          type="submit"
          variant="solid"
          onPress={() => submit(search)}
        >
          Search
        </Button>
      )}
    </Form>
  );
}

export const SearchBarSkeleton = memo(function SearchBarSkeleton() {
  return <Skeleton className="h-12 w-full rounded-xl" />;
});
