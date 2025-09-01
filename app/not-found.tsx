import type { Metadata } from "next";

import React from "react";

export const metadata: Metadata = {
  title: "404 | Not Found",
  description: "This page could not be found",
};

export default function NotFoundPage() {
  return (
    <div className="grid h-full min-h-[calc(100vh-250px)] place-content-center items-center justify-center">
      <h1 className="font-heading text-xl tracking-widest uppercase">
        404 | Not Found
      </h1>
    </div>
  );
}
