"use cilent";
import { Suspense } from "react";

import {
  HomepageMediaListSection,
  GlobalHomepageMediaListLoadingState,
} from "@/components/homepage-media-list-section";
import { Searchbar, SearchBarSkeleton } from "@/components/search-bar";
export default function Home() {
  return (
    <section className="flex flex-col items-center justify-center">
      <div className="relative w-full">
        <div className="mx-auto max-w-screen-lg px-4 py-10 pt-5 pb-5 text-center sm:px-6 md:pt-10 lg:px-8 lg:py-14">
          <div className="py-5">
            <h1 className="items-center justify-center text-2xl font-black sm:text-4xl md:text-6xl lg:text-7xl lg:leading-tight">
              Welcome to
              <span className="text-foreground px-2">Film Fanatic</span>
            </h1>
            <p className="text-foreground mb-3 text-[10px] tracking-wide sm:text-xs">
              Millions of movies, TV shows, and people to discover.
            </p>
          </div>
          <Suspense fallback={<SearchBarSkeleton />}>
            <Searchbar />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<GlobalHomepageMediaListLoadingState />}>
        <HomepageMediaListSection />
      </Suspense>

      <div>
        <div className="h-20" />
      </div>
    </section>
  );
}
