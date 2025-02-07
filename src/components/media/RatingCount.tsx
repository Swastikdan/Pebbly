import React from 'react'
import { Star } from 'lucide-react'
export default function RatingCount({
  rating,
  ratingcount,
}: {
  rating: number
  ratingcount: number
}) {
  return (
    <div className="flex items-center space-x-1 text-lg font-light">
      <Star size={24} className="size-5 fill-yellow-500 text-yellow-500" />
      <span>{rating}/10</span>
      {ratingcount && <span>{`(${ratingcount} users)`}</span>}
    </div>
  )
}
