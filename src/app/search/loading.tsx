import { SearchBarSkeleton } from "@/components/search/search-bar";
export default function LoadingPage() {
  return (
    <section className="flex w-full justify-center">
      <div className="mx-auto w-full max-w-screen-xl p-5">
        <SearchBarSkeleton />
        <div className="h-[50vh] w-full py-5"></div>
      </div>
    </section>
  );
}
