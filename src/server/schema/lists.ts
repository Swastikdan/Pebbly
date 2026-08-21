import * as v from "valibot";
import { mediaTypeSchema, metadataSchema } from "./common";

export const listVisibilitySchema = v.picklist(["public", "private"]);
export const listTypeSchema = v.picklist(["custom", "pebbly-picks"]);
export const listSortTypeSchema = v.picklist(["unordered", "ordered"]);

const listNameSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(50));
const listColorSchema = v.pipe(
	v.string(),
	v.maxLength(20),
	v.regex(/^#[0-9a-fA-F]{3,8}$|^$/),
);
const listDescriptionSchema = v.pipe(v.string(), v.maxLength(150));

const listFields = {
	name: listNameSchema,
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
	name: v.optional(listNameSchema),
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
