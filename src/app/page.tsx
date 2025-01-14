import HomePageMediaListSection from '@/components/HomePageMediaListSection'
import { Searchbar } from '@/components/SearchBar'

export default function Home() {
  return (
    <section className="flex flex-col items-center justify-center">
      <div className="relative w-full overflow-hidden before:absolute before:start-1/2 before:top-1/2 before:-z-[1] before:h-96 before:w-full before:-translate-x-1/2 before:-translate-y-1/2 before:transform before:bg-[url('https://preline.co/assets/svg/component/hyperdrive.svg')] before:bg-center before:bg-no-repeat dark:before:bg-[url('https://preline.co/assets/svg/component-dark/hyperdrive.svg')]">
        <div className="mx-auto max-w-screen-lg px-4 py-10 pb-5 pt-5 text-center sm:px-6 md:pt-10 lg:px-8 lg:py-14">
          <div className="font-heading py-5">
            <h1 className="text-3xl font-bold sm:text-5xl lg:text-6xl lg:leading-tight">
              Welcome to
              <span className="px-2 text-blue-600">Film Fanatic</span>
            </h1>
            <p className="mb-3 text-[10px] tracking-wide text-gray-500 dark:text-gray-200 sm:text-xs">
              Millions of movies, TV shows, and people to discover.
            </p>
          </div>

          <Searchbar />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-screen-xl px-5 py-5 pb-5 pt-5 md:pt-10">
        <HomePageMediaListSection />
      </div>
      <div>
        <div className="h-20"></div>
      </div>
    </section>
  )
}
