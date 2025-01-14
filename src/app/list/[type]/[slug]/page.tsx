import React from 'react'
import { MEDIA_PAGE_SLUGS, NAV_ITEMS } from '@/constants'
import MediaPageResults from './MediaPageResults'
import { type MediaListDataQuery } from '@/types/media'
export const dynamicParams = false

export function generateStaticParams() {
  return MEDIA_PAGE_SLUGS
}
export default async function MediaPage({
  params,
}: {
  params: Promise<{ type: string; slug: string }>
}) {
  const { type, slug } = await params
  const navItem = NAV_ITEMS.find((item) => item.slug === type)
  const subNavItem = navItem
    ? navItem.submenu.find((item) => item.slug === slug)
    : null
  const query = (type + '_' + slug) as unknown as MediaListDataQuery['type']
  const mediatype =
    type === 'movies' ? 'movie' : type === 'tv-shows' ? 'tv' : 'person'

  return (
    <section className="flex min-h-screen w-full justify-center">
      <div className="top-0 w-full max-w-screen-xl items-center justify-center p-5">
        <h1 className="text-start text-4xl font-bold">
          {subNavItem?.name} {navItem?.name}
        </h1>

        <MediaPageResults query={query} mediatype={mediatype} />
      </div>
    </section>
  )
}
