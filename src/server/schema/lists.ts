import * as v from "valibot";
import { mediaTypeSchema, metadataSchema } from "./common";

export const createCustomListArgsSchema = v.object({
	name: v.string(),
	color: v.optional(v.string()),
	visibility: v.optional(v.string()),
	listType: v.optional(v.string()),
});
export type CreateCustomListArgs = v.InferOutput<
	typeof createCustomListArgsSchema
>;

export const updateCustomListArgsSchema = v.object({
	listId: v.string(),
	name: v.optional(v.string()),
	color: v.optional(v.string()),
	visibility: v.optional(v.string()),
	listType: v.optional(v.string()),
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
