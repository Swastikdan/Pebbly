'use client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollContainer } from '@/components/ScrollContainer'
import { MediaCard, MediaCardSkeleton } from '@/components/MediaCard'
import { getMedia } from '@/lib/getmedia'
import { useQuery } from '@tanstack/react-query'

// export default function HomePageMediaListSection() {
//   // Trending Section
//   const {
//     data: trending_day_data,
//     isFetching: trending_day_fetching,
//     error: trending_day_error,
//   } = useQuery({
//     queryKey: ['trending_day'],
//     queryFn: async () => await getMedia({ type: 'trending_day' }),
//     staleTime: 1000 * 60 * 60,
//   })

//   const {
//     data: trending_week_data,
//     isFetching: trending_week_fetching,
//     error: trending_week_error,
//   } = useQuery({
//     queryKey: ['trending_week'],
//     queryFn: async () => await getMedia({ type: 'trending_week' }),
//     staleTime: 1000 * 60 * 60,
//   })

//   // Top Rated Section
//   const {
//     data: top_rated_movies_data,
//     isFetching: top_rated_movies_fetching,
//     error: top_rated_movies_error,
//   } = useQuery({
//     queryKey: ['top_rated_movies'],
//     queryFn: async () => await getMedia({ type: 'top_rated_movie' }),
//     staleTime: 1000 * 60 * 60,
//   })

//   const {
//     data: top_rated_tv_data,
//     isFetching: top_rated_tv_fetching,
//     error: top_rated_tv_error,
//   } = useQuery({
//     queryKey: ['top_rated_tv'],
//     queryFn: async () => await getMedia({ type: 'top_rated_tv' }),
//     staleTime: 1000 * 60 * 60,
//   })

//   // Upcoming Movie Section
//   const {
//     data: upcoming_movie_data,
//     isFetching: upcoming_movie_fetching,
//     error: upcoming_movie_error,
//   } = useQuery({
//     queryKey: ['upcoming_movie'],
//     queryFn: async () => await getMedia({ type: 'upcoming_movie' }),
//     staleTime: 1000 * 60 * 60,
//   })

//   // Popular Section
//   const {
//     data: popular_movie_data,
//     isFetching: popular_movie_fetching,
//     error: popular_movie_error,
//   } = useQuery({
//     queryKey: ['popular_movie'],
//     queryFn: async () => await getMedia({ type: 'popular_movie' }),
//     staleTime: 1000 * 60 * 60,
//   })

//   const {
//     data: popular_tv_data,
//     isFetching: popular_tv_fetching,
//     error: popular_tv_error,
//   } = useQuery({
//     queryKey: ['popular_tv'],
//     queryFn: async () => await getMedia({ type: 'popular_tv' }),
//     staleTime: 1000 * 60 * 60,
//   })

//   return (
//     <div className="flex w-full flex-col gap-10">
//       <Tabs defaultValue="trending_day">
//         <div className="flex items-center gap-5">
//           <h2 className="font-heading text-xl font-semibold md:text-2xl">
//             Trending
//           </h2>
//           <TabsList className="h-8 rounded-xl border border-input bg-background p-0">
//             <TabsTrigger
//               value="trending_day"
//               className="h-full w-full rounded-xl px-5 data-[state=active]:bg-accent data-[state=active]:shadow-none"
//             >
//               Today
//             </TabsTrigger>
//             <TabsTrigger
//               value="trending_week"
//               className="h-full w-full rounded-xl px-5 data-[state=active]:bg-accent data-[state=active]:shadow-none"
//             >
//               This Week
//             </TabsTrigger>
//           </TabsList>
//         </div>
//         <TabsContent value="trending_day">
//           <ScrollContainer isButtonsVisible={!trending_day_fetching}>
//             <div className="flex gap-4 p-4 first:pl-0 last:pr-0">
//               {trending_day_fetching || trending_day_error
//                 ? Array.from({ length: 6 }).map((_, index) => (
//                     <MediaCardSkeleton key={index} />
//                   ))
//                 : trending_day_data?.map((item) => (
//                     <MediaCard
//                       key={item.id}
//                       title={item.title || item.name || 'Untitled'}
//                       rating={item.vote_average}
//                       image={item.poster_path}
//                       poster_path={item.poster_path as string}
//                       media_type={item.media_type as 'movie' | 'tv'}
//                       id={item.id}
//                       relese_date={
//                         item.first_air_date || item.release_date || null
//                       }
//                     />
//                   ))}
//             </div>
//           </ScrollContainer>
//         </TabsContent>
//         <TabsContent value="trending_week">
//           <ScrollContainer isButtonsVisible={!trending_week_fetching}>
//             <div className="flex gap-4 p-4 first:pl-0 last:pr-0">
//               {trending_week_fetching || trending_week_error
//                 ? Array.from({ length: 6 }).map((_, index) => (
//                     <MediaCardSkeleton key={index} />
//                   ))
//                 : trending_week_data?.map((item) => (
//                     <MediaCard
//                       key={item.id}
//                       title={item.title || item.name || 'Untitled'}
//                       rating={item.vote_average}
//                       image={item.poster_path}
//                       poster_path={item.poster_path || ''}
//                       media_type={item.media_type as 'movie' | 'tv'}
//                       id={item.id}
//                       relese_date={
//                         item.first_air_date || item.release_date || null
//                       }
//                     />
//                   ))}
//             </div>
//           </ScrollContainer>
//         </TabsContent>
//       </Tabs>

//       <section>
//         <div className="flex items-center gap-5">
//           <h2 className="font-heading text-xl font-semibold md:text-2xl">
//             Upcoming Movies
//           </h2>
//         </div>
//         <div>
//           <ScrollContainer isButtonsVisible={!upcoming_movie_fetching}>
//             <div className="flex gap-4 p-4 first:pl-0 last:pr-0">
//               {upcoming_movie_fetching || upcoming_movie_error
//                 ? Array.from({ length: 6 }).map((_, index) => (
//                     <MediaCardSkeleton card_type="vertical" key={index} />
//                   ))
//                 : upcoming_movie_data?.map((item) => (
//                     <MediaCard
//                       key={item.id}
//                       card_type="vertical"
//                       title={item.title || item.name || 'Untitled'}
//                       rating={item.vote_average}
//                       poster_path={item.poster_path || ''}
//                       image={item.backdrop_path}
//                       media_type={'movie'}
//                       id={item.id}
//                       relese_date={
//                         item.first_air_date || item.release_date || null
//                       }
//                     />
//                   ))}
//             </div>
//           </ScrollContainer>
//         </div>
//       </section>

//       <Tabs defaultValue="popular_movie">
//         <div className="flex items-center gap-5">
//           <h2 className="font-heading text-xl font-semibold md:text-2xl">{`What's Popular`}</h2>
//           <TabsList className="h-8 rounded-xl border border-input bg-background p-0">
//             <TabsTrigger
//               value="popular_movie"
//               className="h-full w-full rounded-xl px-5 data-[state=active]:bg-accent data-[state=active]:shadow-none"
//             >
//               Theaters
//             </TabsTrigger>
//             <TabsTrigger
//               value="popular_tv"
//               className="h-full w-full rounded-xl px-5 data-[state=active]:bg-accent data-[state=active]:shadow-none"
//             >
//               On TV
//             </TabsTrigger>
//           </TabsList>
//         </div>
//         <TabsContent value="popular_movie">
//           <ScrollContainer isButtonsVisible={!popular_movie_fetching}>
//             <div className="flex gap-4 p-4 first:pl-0 last:pr-0">
//               {popular_movie_fetching || popular_movie_error
//                 ? Array.from({ length: 6 }).map((_, index) => (
//                     <MediaCardSkeleton key={index} />
//                   ))
//                 : popular_movie_data?.map((item) => (
//                     <MediaCard
//                       key={item.id}
//                       id={item.id}
//                       title={item.title || item.original_title || 'Untitled'}
//                       poster_path={item.poster_path || ''}
//                       image={item.poster_path}
//                       relese_date={item.release_date || null}
//                       rating={item.vote_average}
//                       media_type="movie"
//                     />
//                   ))}
//             </div>
//           </ScrollContainer>
//         </TabsContent>
//         <TabsContent value="popular_tv">
//           <ScrollContainer isButtonsVisible={!popular_tv_fetching}>
//             <div className="flex gap-4 p-4 first:pl-0 last:pr-0">
//               {popular_tv_fetching || popular_tv_error
//                 ? Array.from({ length: 6 }).map((_, index) => (
//                     <MediaCardSkeleton key={index} />
//                   ))
//                 : popular_tv_data?.map((item) => (
//                     <MediaCard
//                       key={item.id}
//                       id={item.id}
//                       title={item.name || item.original_name || 'Untitled'}
//                       poster_path={item.poster_path || ''}
//                       image={item.poster_path}
//                       relese_date={item.first_air_date || null}
//                       rating={item.vote_average}
//                       media_type="tv"
//                     />
//                   ))}
//             </div>
//           </ScrollContainer>
//         </TabsContent>
//       </Tabs>
//       <Tabs defaultValue="top_rated_movies">
//         <div className="flex items-center gap-5">
//           <h2 className="font-heading text-xl font-semibold md:text-2xl">
//             Top Rated
//           </h2>
//           <TabsList className="h-8 rounded-xl border border-input bg-background p-0">
//             <TabsTrigger
//               value="top_rated_movies"
//               className="h-full w-full rounded-xl px-5 data-[state=active]:bg-accent data-[state=active]:shadow-none"
//             >
//               Movies
//             </TabsTrigger>
//             <TabsTrigger
//               value="top_rated_tv"
//               className="h-full w-full rounded-xl px-5 data-[state=active]:bg-accent data-[state=active]:shadow-none"
//             >
//               TV Shows
//             </TabsTrigger>
//           </TabsList>
//         </div>
//         <TabsContent value="top_rated_movies">
//           <ScrollContainer isButtonsVisible={!top_rated_movies_fetching}>
//             <div className="flex gap-4 p-4 first:pl-0 last:pr-0">
//               {top_rated_movies_fetching || top_rated_movies_error
//                 ? Array.from({ length: 6 }).map((_, index) => (
//                     <MediaCardSkeleton key={index} />
//                   ))
//                 : top_rated_movies_data?.map((item) => (
//                     <MediaCard
//                       key={item.id}
//                       title={item.title || item.name || 'Untitled'}
//                       rating={item.vote_average}
//                       image={item.poster_path}
//                       poster_path={item.poster_path || ''}
//                       media_type={'movie'}
//                       id={item.id}
//                       relese_date={
//                         item.first_air_date || item.release_date || null
//                       }
//                     />
//                   ))}
//             </div>
//           </ScrollContainer>
//         </TabsContent>
//         <TabsContent value="top_rated_tv">
//           <ScrollContainer isButtonsVisible={!top_rated_tv_fetching}>
//             <div className="flex gap-4 p-4 first:pl-0 last:pr-0">
//               {top_rated_tv_fetching || top_rated_tv_error
//                 ? Array.from({ length: 6 }).map((_, index) => (
//                     <MediaCardSkeleton key={index} />
//                   ))
//                 : top_rated_tv_data?.map((item) => (
//                     <MediaCard
//                       key={item.id}
//                       title={item.title || item.name || 'Untitled'}
//                       rating={item.vote_average}
//                       image={item.poster_path}
//                       poster_path={item.poster_path || ''}
//                       media_type={'tv'}
//                       id={item.id}
//                       relese_date={
//                         item.first_air_date || item.release_date || null
//                       }
//                     />
//                   ))}
//             </div>
//           </ScrollContainer>
//         </TabsContent>
//       </Tabs>
//     </div>
//   )
// }

function TrendingDayMovies() {
  const { data, isFetching, error } = useQuery({
    queryKey: ['trending_day'],
    queryFn: async () => await getMedia({ type: 'trending_day' }),
    staleTime: 1000 * 60 * 60,
  })

  return (
    <ScrollContainer isButtonsVisible={!isFetching}>
      <div className="flex gap-4 p-4 first:pl-0 last:pr-0">
        {isFetching || error
          ? Array.from({ length: 6 }).map((_, index) => (
              <MediaCardSkeleton key={index} />
            ))
          : data?.map((item) => (
              <MediaCard
                key={item.id}
                title={item.title || item.name || 'Untitled'}
                rating={item.vote_average}
                image={item.poster_path}
                poster_path={item.poster_path as string}
                media_type={item.media_type as 'movie' | 'tv'}
                id={item.id}
                relese_date={item.first_air_date || item.release_date || null}
              />
            ))}
      </div>
    </ScrollContainer>
  )
}

function TrendingWeekMovies() {
  const { data, isFetching, error } = useQuery({
    queryKey: ['trending_week'],
    queryFn: async () => await getMedia({ type: 'trending_week' }),
    staleTime: 1000 * 60 * 60,
  })

  return (
    <ScrollContainer isButtonsVisible={!isFetching}>
      <div className="flex gap-4 p-4 first:pl-0 last:pr-0">
        {isFetching || error
          ? Array.from({ length: 6 }).map((_, index) => (
              <MediaCardSkeleton key={index} />
            ))
          : data?.map((item) => (
              <MediaCard
                key={item.id}
                title={item.title || item.name || 'Untitled'}
                rating={item.vote_average}
                image={item.poster_path}
                poster_path={item.poster_path || ''}
                media_type={item.media_type as 'movie' | 'tv'}
                id={item.id}
                relese_date={item.first_air_date || item.release_date || null}
              />
            ))}
      </div>
    </ScrollContainer>
  )
}

function UpcomingMovies() {
  const { data, isFetching, error } = useQuery({
    queryKey: ['upcoming_movie'],
    queryFn: async () => await getMedia({ type: 'upcoming_movie' }),
    staleTime: 1000 * 60 * 60,
  })

  return (
    <ScrollContainer isButtonsVisible={!isFetching}>
      <div className="flex gap-4 p-4 first:pl-0 last:pr-0">
        {isFetching || error
          ? Array.from({ length: 6 }).map((_, index) => (
              <MediaCardSkeleton card_type="vertical" key={index} />
            ))
          : data?.map((item) => (
              <MediaCard
                key={item.id}
                card_type="vertical"
                title={item.title || item.name || 'Untitled'}
                rating={item.vote_average}
                poster_path={item.poster_path || ''}
                image={item.backdrop_path}
                media_type={'movie'}
                id={item.id}
                relese_date={item.first_air_date || item.release_date || null}
              />
            ))}
      </div>
    </ScrollContainer>
  )
}

function PopularMovies() {
  const { data, isFetching, error } = useQuery({
    queryKey: ['popular_movie'],
    queryFn: async () => await getMedia({ type: 'popular_movie' }),
    staleTime: 1000 * 60 * 60,
  })

  return (
    <ScrollContainer isButtonsVisible={!isFetching}>
      <div className="flex gap-4 p-4 first:pl-0 last:pr-0">
        {isFetching || error
          ? Array.from({ length: 6 }).map((_, index) => (
              <MediaCardSkeleton key={index} />
            ))
          : data?.map((item) => (
              <MediaCard
                key={item.id}
                id={item.id}
                title={item.title || item.original_title || 'Untitled'}
                poster_path={item.poster_path || ''}
                image={item.poster_path}
                relese_date={item.release_date || null}
                rating={item.vote_average}
                media_type="movie"
              />
            ))}
      </div>
    </ScrollContainer>
  )
}

function PopularTv() {
  const { data, isFetching, error } = useQuery({
    queryKey: ['popular_tv'],
    queryFn: async () => await getMedia({ type: 'popular_tv' }),
    staleTime: 1000 * 60 * 60,
  })

  return (
    <ScrollContainer isButtonsVisible={!isFetching}>
      <div className="flex gap-4 p-4 first:pl-0 last:pr-0">
        {isFetching || error
          ? Array.from({ length: 6 }).map((_, index) => (
              <MediaCardSkeleton key={index} />
            ))
          : data?.map((item) => (
              <MediaCard
                key={item.id}
                id={item.id}
                title={item.name || item.original_name || 'Untitled'}
                poster_path={item.poster_path || ''}
                image={item.poster_path}
                relese_date={item.first_air_date || null}
                rating={item.vote_average}
                media_type="tv"
              />
            ))}
      </div>
    </ScrollContainer>
  )
}

function TopRatedMovies() {
  const { data, isFetching, error } = useQuery({
    queryKey: ['top_rated_movies'],
    queryFn: async () => await getMedia({ type: 'top_rated_movie' }),
    staleTime: 1000 * 60 * 60,
  })

  return (
    <ScrollContainer isButtonsVisible={!isFetching}>
      <div className="flex gap-4 p-4 first:pl-0 last:pr-0">
        {isFetching || error
          ? Array.from({ length: 6 }).map((_, index) => (
              <MediaCardSkeleton key={index} />
            ))
          : data?.map((item) => (
              <MediaCard
                key={item.id}
                title={item.title || item.name || 'Untitled'}
                rating={item.vote_average}
                image={item.poster_path}
                poster_path={item.poster_path || ''}
                media_type={'movie'}
                id={item.id}
                relese_date={item.first_air_date || item.release_date || null}
              />
            ))}
      </div>
    </ScrollContainer>
  )
}

function TopRatedTv() {
  const { data, isFetching, error } = useQuery({
    queryKey: ['top_rated_tv'],
    queryFn: async () => await getMedia({ type: 'top_rated_tv' }),
    staleTime: 1000 * 60 * 60,
  })

  return (
    <ScrollContainer isButtonsVisible={!isFetching}>
      <div className="flex gap-4 p-4 first:pl-0 last:pr-0">
        {isFetching || error
          ? Array.from({ length: 6 }).map((_, index) => (
              <MediaCardSkeleton key={index} />
            ))
          : data?.map((item) => (
              <MediaCard
                key={item.id}
                title={item.title || item.name || 'Untitled'}
                rating={item.vote_average}
                image={item.poster_path}
                poster_path={item.poster_path || ''}
                media_type={'tv'}
                id={item.id}
                relese_date={item.first_air_date || item.release_date || null}
              />
            ))}
      </div>
    </ScrollContainer>
  )
}

export {
  TrendingDayMovies,
  TrendingWeekMovies,
  UpcomingMovies,
  PopularMovies,
  PopularTv,
  TopRatedMovies,
  TopRatedTv,
}
