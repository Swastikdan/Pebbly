import React from "react";

export default function DefaultLoader() {
  return (
    <div className="flex h-[100vh] w-full items-center justify-center">
      <div className="h-10 w-10">
        <svg viewBox="25 25 50 50" className="svg">
          <circle r="20" cy="50" cx="50" className="circle"></circle>
        </svg>
      </div>
    </div>
  );
}
