import React, { useRef , useState , useEffect } from 'react';

export const DropdownContext = React.createContext({ isOpen: false, setIsOpen: () => {} });

export function Dropdown({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  // Close the dropdown when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref]);

  return (
    <DropdownContext.Provider value={{ isOpen, setIsOpen }}>
      <div ref={ref}>{children}</div>
    </DropdownContext.Provider>
  );
}

export function DropdownTrigger({ children }) {
  const { setIsOpen } = React.useContext(DropdownContext);

  return (
    <button
        className="cursor-pointer px-2 relative group rounded-lg overflow-hidden "
        type="button"
      onClick={() => setIsOpen(true)}
    >
      {children}
      <div className="absolute left-1/2 top-1/2 hidden h-full w-72 -translate-x-1/2 -translate-y-1/2 transform items-center justify-center overflow-hidden rounded-lg p-0 group-hover:flex group-hover:backdrop-blur-xl  group-hover:transition-all group-hover:duration-300 md:w-96  ">
        <span className="flex items-center space-x-2 font-medium">
          <svg
            className="h-8 w-8 text-white"
            viewBox="0 0 256 256"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path opacity="0.2" d="M160 48H208V96L160 48Z" fill="white" />
            <path opacity="0.2" d="M96 208H48V160L96 208Z" fill="white" />
            <path opacity="0.2" d="M208 160V208H160L208 160Z" fill="white" />
            <path opacity="0.2" d="M48 96V48H96L48 96Z" fill="white" />
            <path
              d="M160 48H208V96L160 48Z"
              stroke="white"
              stroke-width="16"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M152 104L184 72"
              stroke="white"
              stroke-width="16"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M96 208H48V160L96 208Z"
              stroke="white"
              stroke-width="16"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M104 152L72 184"
              stroke="white"
              stroke-width="16"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M208 160V208H160L208 160Z"
              stroke="white"
              stroke-width="16"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M152 152L184 184"
              stroke="white"
              stroke-width="16"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M48 96V48H96L48 96Z"
              stroke="white"
              stroke-width="16"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M104 104L72 72"
              stroke="white"
              stroke-width="16"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span>Expand</span>
        </span>
      </div>
    </button>
  );
}

export function DropdownContent({ children }) {
  const { isOpen, setIsOpen } = React.useContext(DropdownContext);

  return isOpen ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center  overflow-x-hidden outline-none backdrop-blur-lg focus:outline-none"
      onClick={() => setIsOpen(false)}
    >
      <div className="relative mx-1 my-6 h-full max-h-[90vh] w-auto max-w-[90vw] p-3 ">
        <div className="relative flex w-full flex-col overflow-hidden rounded-lg border-0 bg-gray-600 shadow-lg outline-none focus:outline-none">
          <div className="relative">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute right-0 top-0 m-2 rounded-lg bg-white px-2 text-4xl text-black hover:bg-gray-200 active:scale-95"
            >
              &times;
            </button>
            {children}
          </div>
        </div>
      </div>
    </div>
  ) : null;
}












// import React, { useState } from 'react';

// export default function CastModel() {
//   const [isOpen, setIsOpen] = useState(false);

//   return (
//     <div>
//       <h2>Modal Example</h2>

//       <button
//         className="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
//         onClick={() => setIsOpen(true)}
//       >
//         Open Modal
//       </button>

//       {isOpen && (
//         <div
//           className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden outline-none backdrop-blur-lg focus:outline-none"
//           onClick={() => setIsOpen(false)}
//         >
//           <div className="relative mx-1 my-6 h-auto max-h-[90vh] w-auto max-w-[90vw] p-3 ">
//             <div className="relative flex w-full flex-col overflow-hidden rounded-lg border-0 bg-gray-600 shadow-lg outline-none focus:outline-none">
//               <div className="relative">
//                 <button
//                   onClick={() => setIsOpen(false)}
//                   className="absolute right-0 top-0 m-2 rounded-lg bg-white px-2 text-4xl text-black hover:bg-gray-200 active:scale-95"
//                 >
//                   &times;
//                 </button>
//                 <p>Some text in the Modal.. </p>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
