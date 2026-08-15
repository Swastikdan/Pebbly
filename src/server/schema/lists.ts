import { z } from "zod";
import { mediaTypeSchema, metadataSchema } from "./common";

export const createCustomListArgsSchema = z.object({
	name: z.string(),
	color: z.string().optional(),
	visibility: z.string().optional(),
	listType: z.string().optional(),
});
export type CreateCustomListArgs = z.infer<typeof createCustomListArgsSchema>;

export const updateCustomListArgsSchema = z.object({
	listId: z.string(),
	name: z.string().optional(),
	color: z.string().optional(),
	visibility: z.string().optional(),
	listType: z.string().optional(),
});
export type UpdateCustomListArgs = z.infer<typeof updateCustomListArgsSchema>;

export const deleteCustomListArgsSchema = z.object({
	listId: z.string(),
});
export type DeleteCustomListArgs = z.infer<typeof deleteCustomListArgsSchema>;

export const getListItemsArgsSchema = z.object({
	listId: z.string(),
});
export type GetListItemsArgs = z.infer<typeof getListItemsArgsSchema>;

export const getItemListsArgsSchema = z.object({
	tmdbId: z.number(),
	mediaType: mediaTypeSchema,
});
export type GetItemListsArgs = z.infer<typeof getItemListsArgsSchema>;

export const toggleListItemArgsSchema = z
	.object({
		listId: z.string(),
		tmdbId: z.number(),
		mediaType: mediaTypeSchema,
		backdrop: z.string().optional(),
	})
	.merge(metadataSchema);
export type ToggleListItemArgs = z.infer<typeof toggleListItemArgsSchema>;

export const createCustomListAndAddItemArgsSchema = createCustomListArgsSchema
	.extend({
		tmdbId: z.number(),
		mediaType: mediaTypeSchema,
		backdrop: z.string().optional(),
	})
	.merge(metadataSchema);
export type CreateCustomListAndAddItemArgs = z.infer<
	typeof createCustomListAndAddItemArgsSchema
>;
