import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";

export const MediaKeywords = (props: {
  keywords: Array<{ name: string; id: number }>;
}) => {
  const hasKeywords = props.keywords.length > 0;
  if (!hasKeywords) return null;
  return (
    <div className="py-5">
      <div className="flex flex-col gap-5">
        <span className="font-heading w-fit text-xl font-semibold md:text-2xl">
          Keywords
        </span>
        <div className="flex flex-wrap gap-2">
          {props.keywords.map((keyword) => (
            <Link
              key={keyword.id}
              to="/keyword/$id"
              params={{ id: String(keyword.id) }}
              className="pressable-small"
            >
              <Badge
                className="[a&]:hover:bg-primary h-8 cursor-pointer rounded-md px-4 text-xs sm:h-8 md:text-sm"
                variant="secondary"
              >
                {keyword.name}
              </Badge>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
