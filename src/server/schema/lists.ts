import * as v from "valibot";
import { mediaTypeSchema, metadataSchema } from "./common";

export const listVisibilitySchema = v.picklist(["public", "private"]);
export const listTypeSchema = v.picklist(["custom", "pebbly-picks"]);

const listNameSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(50));
const listColorSchema = v.pipe(
	v.string(),
	v.maxLength(20),
	v.regex(/^#[0-9a-fA-F]{3,8}$|^$/),
);

const listFields = {
	name: listNameSchema,
	color: v.optional(listColorSchema),
	visibility: v.optional(listVisibilitySchema),
	listType: v.optional(listTypeSchema),
};

export const createCustomListArgsSchema = v.object(listFields);
export type CreateCustomListArgs = v.InferOutput<
	typeof createCustomListArgsSchema
>;

export const updateCustomListArgsSchema = v.object({
	listId: v.string(),
	name: v.optional(listNameSchema),
	color: v.optional(listColorSchema),
	visibility: v.optional(listVisibilitySchema),
	listType: v.optional(listTypeSchema),
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
