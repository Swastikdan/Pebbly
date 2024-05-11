import React from 'react'

export default function NavmenuDesktop({navitems , pathname}) {
  return (
    <nav className="hidden space-x-2 md:flex  ">
      {navitems.map((item, index) => (
        <a
          key={index}
          href={item.href}
          data-astro-prefetch
          className={`rounded-lg px-2 py-1 text-lg font-medium text-black ring-gray-400 hover:bg-gray-200/70 focus:outline-none focus:ring-2 ${pathname === item.href ? 'bg-gray-200/70' : ''}`}
          aria-label={item.name}
        >
          {item.name}
        </a>
      ))}
    </nav>
  );
}
