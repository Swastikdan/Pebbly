import { Badge } from "@/components/ui/badge";

export default function MediaKeywords({
  keywords,
}: {
  keywords: Array<{ name: string }>;
}) {
  return (
    <div className="py-5">
      <div className="flex flex-col gap-5">
        {keywords.length === 0 ? (
          <>
            <div className="w-fit text-xl font-semibold md:text-2xl">
              Keywords
            </div>
            <p className="py-2 text-sm" role="alert">
              No keywords found
            </p>
          </>
        ) : (
          <>
            <span className="w-fit text-xl font-semibold md:text-2xl">
              Keywords
            </span>
            <div className="flex flex-wrap gap-2">
              {keywords.map((keyword, index) => (
                <Badge
                  variant="secondary"
                  className="[a&]:hover:bg-primary h-6 cursor-auto rounded-sm px-4 text-xs font-light md:text-sm"
                  key={index}
                >
                  {keyword.name}
                </Badge>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
