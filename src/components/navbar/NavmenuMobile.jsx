import { useState } from "react";

export default function NavmenuMobile({ navitems }) {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = () => setIsOpen(!isOpen);

  return (
    <nav>
      <div className="relative inline-block text-left">
        <div>
          <button
            onClick={toggle}
            type="button"
            className="inline-flex justify-center w-full rounded-md shadow-sm px-4 py-2 text-md font-semibold border-2 border-gray-200/70 hover:bg-gray-200/70"
            id="options-menu"
            aria-haspopup="true"
            aria-expanded={isOpen}
            aria-label={isOpen ? "Close menu" : "Open menu"}
          >
            {isOpen ? "Close" : "Menu"}
          </button>
        </div>

        {isOpen && (
          <div
            className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white border-2 border-gray-200/70 focus:outline-none z-50"
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
                  className="block px-4 py-2 mx-2 my-1 rounded-md text-base text-gray-700 hover:bg-gray-200/70 hover:text-gray-900"
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