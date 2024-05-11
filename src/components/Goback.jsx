import React from 'react';

export default function Goback({ type, text, link , bg}) {
  return (
    <>
      {link && link !== null && link !== undefined ? (
        <a
          href={link}
          className={`${'flex w-max items-start justify-start space-x-2 rounded-lg px-2 py-1 font-medium focus:outline-none focus:ring-2 focus:ring-gray-400 sm:text-lg'} ${bg ? 'hover:bg-gray-200/70' : ''} `}
        >
          <span className="flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 256 256"
              className={`${type === 'icon' ? 'mr-1 size-5 sm:size-7' : 'mr-1 size-5'}`}
            >
              <rect width="256" height="256" fill="none" />
              <line
                x1="216"
                y1="128"
                x2="40"
                y2="128"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="16"
              />
              <polyline
                points="112 56 40 128 112 200"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="16"
              />
            </svg>
            {text}
          </span>
        </a>
      ) : (
        <button
          className={`${
            type === 'icon'
              ? 'flex items-end justify-end space-x-2 rounded-lg px-2 py-1 font-medium hover:bg-gray-200/70 focus:outline-none focus:ring-2 focus:ring-gray-400 sm:text-lg'
              : 'my-4 inline-flex rounded-lg bg-gray-200/70 px-5 py-2.5 text-center text-sm font-medium text-black hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400'
          }`}
          onClick={() => window.history.back()}
        >
          <span className="flex items-center ">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 256 256"
              className={`${type === 'icon' ? 'mr-1 size-5 sm:size-7' : 'mr-1 size-5'}`}
            >
              <rect width="256" height="256" fill="none" />
              <line
                x1="216"
                y1="128"
                x2="40"
                y2="128"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="16"
              />
              <polyline
                points="112 56 40 128 112 200"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="16"
              />
            </svg>
            {text}
          </span>
        </button>
      )}
    </>
  );
}
