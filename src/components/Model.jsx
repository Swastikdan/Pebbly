
import React, { useState } from "react";
export default function Model({ children, fullimagelink }) {
  const [showModal, setShowModal] = useState(false);
  return (
    <>
      <div
        className="cursor-pointer px-2 relative group rounded-lg overflow-hidden "
        type="button"
        onClick={() => setShowModal(true)}
      >
        {children}

        <div className="hidden group-hover:flex justify-center items-center absolute h-full w-72 md:w-96 p-0 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-lg group-hover:backdrop-blur-xl  overflow-hidden group-hover:transition-all group-hover:duration-300  ">
          <span className="flex items-center space-x-2 font-medium">
            <svg
              className="w-8 h-8 text-white"
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
      </div>
      {showModal ? (
        <>
          <div className="flex justify-center items-center overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none backdrop-blur-lg ">
            <div className="relative w-auto my-6 mx-1 p-3 ">
              <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-gray-600 outline-none focus:outline-none overflow-hidden">
                <div className="relative">
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-black absolute text-4xl top-0 right-0 px-2  m-2 bg-white rounded-lg hover:bg-gray-200 active:scale-95  "
                  >
                    &times;
                  </button>
                  <img
                    src={fullimagelink}
                    alt="fullimage"
                    className="w-full max-w-[90vw] max-h-[90vh]"
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

