import React from 'react'

export default function Goback() {
  return (
    <button
                    className="inline-flex text-black bg-gray-200/70 hover:bg-gray-200 focus:ring-2 focus:outline-none focus:ring-gray-400 font-medium rounded-lg text-sm px-5 py-2.5 text-center my-4"
                    onClick={() => window.history.back()}
                >
                    Go Back 
                </button>
  )
}
