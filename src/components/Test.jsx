import React from 'react'
import { Dropdown, DropdownTrigger, DropdownContent } from './_CastModel';
export default function Test() {
  return (
    <Dropdown>
      <DropdownTrigger>
        <img
          src="https://image.tmdb.org/t/p/w500/6Wdl9N6dL0Hi0T1qJLWSz6gMLbd.jpg"
          alt="movie"
          className="h-full w-full rounded-lg object-cover"
        />
      </DropdownTrigger>
      <DropdownContent>
        {' '}
        <img
          src="https://image.tmdb.org/t/p/w500/6Wdl9N6dL0Hi0T1qJLWSz6gMLbd.jpg"
          alt="movie"
          className="h-full w-full rounded-lg object-cover"
        />
      </DropdownContent>
    </Dropdown>
  );
}
