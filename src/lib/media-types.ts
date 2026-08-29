import * as v from "valibot";

import { MEDIA_TYPES } from "@/domain/media";

export {
  MEDIA_TYPES,
  MEDIA_TYPE_SLUGS,
  isMediaType,
  mediaTypeToSlug,
  slugToMediaType,
} from "@/domain/media";
export type { MediaType } from "@/domain/media";

export const mediaTypeSchema = v.picklist([...MEDIA_TYPES]);
