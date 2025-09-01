import { Chip } from "@heroui/chip";
export const MediaKeywords = ({
  keywords,
}: {
  keywords: Array<{ name: string }>;
}) => {
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
                <Chip
                  key={index}
                  className="[a&]:hover:bg-primary h-6 cursor-auto rounded-md px-4 text-xs font-light md:text-sm"
                  variant="faded"
                >
                  {keyword.name}
                </Chip>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
