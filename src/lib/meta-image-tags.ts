import { SITE_CONFIG } from "@/constants";
export const MetaImageTagsGenerator = (props: {
  title: string;
  description: string;
  ogImage?: string;
  url: string;
  siteName?: string;
  imageWidth?: string;
  imageHeight?: string;
}) => {
  const {
    title,
    description,
    ogImage = SITE_CONFIG.defaultMetaImage,
    url,
    siteName = "Film Fanatic",
    imageWidth = "1200",
    imageHeight = "630",
  } = props;

  return [
    { title },
    // Basic meta
    { name: "description", content: description },
    // Open Graph
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:type", content: "website" },
    { property: "og:image", content: ogImage },
    { property: "og:image:width", content: imageWidth },
    { property: "og:image:height", content: imageHeight },
    { property: "og:image:alt", content: siteName },
    { property: "og:site_name", content: siteName },
    // Twitter
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: ogImage },
    { property: "twitter:domain", content: new URL(url).hostname },
    { name: "twitter:url", content: url },
  ];
};
