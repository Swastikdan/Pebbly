import * as v from "valibot";

import { mediaTypeSchema, metadataSchema } from "./common";

// Canonical values; the valibot picklists here and the drizzle column enums /
// CHECK constraints in server/db/schema.ts derive from these.
export const LIST_VISIBILITIES = ["public", "private"] as const;
export const LIST_TYPES = ["custom", "pebbly-picks"] as const;

export type ListVisibility = (typeof LIST_VISIBILITIES)[number];
export type ListType = (typeof LIST_TYPES)[number];

/**
 * The system-owned Pebbly Picks list (services/picks-list.ts). Users cannot
 * create or rename a custom list to this name; appendToPicksList additionally
 * matches it by listType so a legacy custom list squatting on the name never
 * receives picks.
 */
export const PEBBLY_PICKS_LIST_TYPE = "pebbly-picks" as const;
export const PEBBLY_PICKS_LIST_NAME = "Pebbly Picks";

function isReservedListName(name: string): boolean {
  return name.trim().toLowerCase() === PEBBLY_PICKS_LIST_NAME.toLowerCase();
}

const customListNameSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(50),
  v.check(
    (name) => !isReservedListName(name),
    `"${PEBBLY_PICKS_LIST_NAME}" is a reserved list name`,
  ),
);

export const listVisibilitySchema = v.picklist([...LIST_VISIBILITIES]);
export const listTypeSchema = v.picklist([...LIST_TYPES]);
export const listSortTypeSchema = v.picklist(["unordered", "ordered"]);

const listColorSchema = v.pipe(
  v.string(),
  v.maxLength(20),
  v.regex(/^#[0-9a-fA-F]{3,8}$|^$/),
);
const listDescriptionSchema = v.pipe(v.string(), v.maxLength(150));

const listFields = {
  name: customListNameSchema,
  color: v.optional(listColorSchema),
  description: v.optional(listDescriptionSchema),
  visibility: v.optional(listVisibilitySchema),
  listType: v.optional(listTypeSchema),
  sortType: v.optional(listSortTypeSchema),
};

export const createCustomListArgsSchema = v.object(listFields);
export type CreateCustomListArgs = v.InferOutput<
  typeof createCustomListArgsSchema
>;

export const updateCustomListArgsSchema = v.object({
  listId: v.string(),
  // Renaming to the reserved name is rejected; renaming away from it (a
  // legacy squatter list) stays allowed because only the NEW value is checked.
  name: v.optional(customListNameSchema),
  color: v.optional(listColorSchema),
  description: v.optional(listDescriptionSchema),
  visibility: v.optional(listVisibilitySchema),
  listType: v.optional(listTypeSchema),
  sortType: v.optional(listSortTypeSchema),
});
export type UpdateCustomListArgs = v.InferOutput<
  typeof updateCustomListArgsSchema
>;

export const deleteCustomListArgsSchema = v.object({
  listId: v.string(),
});
export type DeleteCustomListArgs = v.InferOutput<
  typeof deleteCustomListArgsSchema
>;

export const getListItemsArgsSchema = v.object({
  listId: v.string(),
});
export type GetListItemsArgs = v.InferOutput<typeof getListItemsArgsSchema>;

export const getItemListsArgsSchema = v.object({
  tmdbId: v.number(),
  mediaType: mediaTypeSchema,
});
export type GetItemListsArgs = v.InferOutput<typeof getItemListsArgsSchema>;

export const toggleListItemArgsSchema = v.object({
  ...metadataSchema.entries,
  listId: v.string(),
  tmdbId: v.number(),
  mediaType: mediaTypeSchema,
  backdrop: v.optional(v.string()),
});
export type ToggleListItemArgs = v.InferOutput<typeof toggleListItemArgsSchema>;

export const createCustomListAndAddItemArgsSchema = v.object({
  ...createCustomListArgsSchema.entries,
  ...metadataSchema.entries,
  tmdbId: v.number(),
  mediaType: mediaTypeSchema,
  backdrop: v.optional(v.string()),
});
export type CreateCustomListAndAddItemArgs = v.InferOutput<
  typeof createCustomListAndAddItemArgsSchema
>;

export const reorderListItemsArgsSchema = v.object({
  listId: v.string(),
  orderedItems: v.pipe(
    v.array(v.object({ tmdbId: v.number(), mediaType: mediaTypeSchema })),
    v.maxLength(1000),
  ),
});
export type ReorderListItemsArgs = v.InferOutput<
  typeof reorderListItemsArgsSchema
>;

export const getCollectionPageArgsSchema = v.object({
  listId: v.string(),
});
export type GetCollectionPageArgs = v.InferOutput<
  typeof getCollectionPageArgsSchema
>;

export const cloneCustomListArgsSchema = v.object({
  sourceListId: v.string(),
});
export type CloneCustomListArgs = v.InferOutput<
  typeof cloneCustomListArgsSchema
>;
