import { useState } from "react";

export default function NavmenuMobile({ navitems , pathname }) {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = () => setIsOpen(!isOpen);

  return (
    <nav className="md:hidden ">
      <div className="relative inline-block text-left">
        <div>
          <button
            onClick={toggle}
            type="button"
            className="text-md inline-flex w-full justify-center rounded-md border-2 border-gray-200/70 px-4 py-2 font-semibold shadow-sm hover:bg-gray-200/70"
            id="options-menu"
            aria-haspopup="true"
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
          >
            {isOpen ? 'Close' : 'Menu'}
          </button>
        </div>

        {isOpen && (
          <div
            className="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-md border-2 border-gray-200/70 bg-white shadow-lg focus:outline-none"
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="options-menu"
          >
            <div className="py-1" role="none">
              {navitems.map((item, index) => (
                <a
                  key={index}
                  href={item.href}
                  data-astro-prefetch
                  className={` mx-2 my-1 block rounded-md px-4 py-2 text-base text-gray-700 ring-gray-400 hover:bg-gray-200/70 hover:text-gray-900 focus:outline-none focus:ring-2  ${pathname === item.href ? 'bg-gray-200/70 text-gray-900' : ''}`}
                  role="menuitem"
                  tabIndex={0}
                  aria-label={item.name}
                  onClick={toggle}
                >
                  {item.name}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}