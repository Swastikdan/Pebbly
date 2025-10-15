import { Badge } from "@/components/ui/badge";

export const MediaKeywords = (props: { keywords: Array<{ name: string }> }) => {
  const hasKeywords = props.keywords.length > 0;
  if (!hasKeywords) return null;
  return (
    <div className="py-5">
      <div className="flex flex-col gap-5">
        <span className="w-fit text-xl font-semibold md:text-2xl">
          Keywords
        </span>
        <div className="flex flex-wrap gap-2">
          {props.keywords.map((keyword, index) => (
            <Badge
              key={index}
              className="[a&]:hover:bg-primary h-6 cursor-auto rounded-md px-4 text-xs  md:text-sm"
              variant="secondary"
            >
              {keyword.name}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
};
