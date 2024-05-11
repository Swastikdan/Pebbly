import React, { useState, useEffect } from 'react';
import Share from './Share';
import Goback from './Goback';
export default function Secondarynav({ movie, url, id, slug ,color }) {
  useEffect(() => {
    const div = document.querySelector('#dynmaic-bg');
    div.style.backgroundColor = color;
  }, []); // This useEffect will run once when the component mounts

  const [currentPath, setCurrentPath] = useState(null);

  useEffect(() => {
    if(window.location.pathname == `/movie/${id}/${slug}/media`){
      setCurrentPath('media')
    }else if(window.location.pathname == `/movie/${id}/${slug}/cast`){
      setCurrentPath('cast')
    }
  }, [window.location.pathname]);


  return (
    <section id="dynmaic-bg" data-id={color} class="pt-5 text-white">
      <div class="mx-auto block max-w-screen-2xl items-center px-2 md:px-10 xl:px-20">
        <div class="flex items-center space-x-0">
          <img
            src={`https://media.dev.to/cdn-cgi/image/width=400,height=600,fit=cover,gravity=auto,format=auto/https://image.tmdb.org/t/p/original/${movie.poster_path}`}
            alt={movie.title}
            class="hidden h-28 w-20 rounded-lg object-cover ring-2 ring-gray-200 md:block"
          />

          <div class="flex w-full flex-col px-2 sm:px-3 md:px-5">
            <div class="flex w-full items-center justify-between pb-2 ">
              <h1 class=" text-start text-lg  font-bold md:text-3xl">
                {movie.title} ({movie.year})
              </h1>
              {/* <Share title={movie.title} url={url} /> */}
            </div>
            <div class="flex w-full items-center justify-between pb-2 ">
              <Goback
                text="Back to main"
                type={'icon'}
                link={`/movie/${id}/${slug}`}
                bg={false}
              />
              <Share title={movie.title} url={url} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex w-full items-center justify-center gap-2 bg-gray-800 py-3  text-base font-semibold text-white">
        <a
          href={`/movie/${id}/${slug}/media`}
          className={` rounded-lg px-4 py-1  hover:ring-1 hover:ring-gray-200 ${currentPath == 'media' ? 'ring-1 ring-gray-200' : ''} `}
        >
          Media{' '}
        </a>
        <a
          href={`/movie/${id}/${slug}/cast`}
          className={` rounded-lg px-4 py-1  hover:ring-1 hover:ring-gray-200 ${currentPath == 'cast' ? 'ring-1 ring-gray-200' : ''} `}
        >
          Cast & Crew{' '}
        </a>
      </div>
    </section>
  );
}
