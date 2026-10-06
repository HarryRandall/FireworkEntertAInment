/** Validation shared with the catalogue Finale mapping database constraints. */
import { z } from 'zod';

export const FINALE_PRODUCT_ID_MAX_CHARACTERS = 128; // catalogue_items_finale_product_id_format, characters.
export const FINALE_EFFECT_NAME_MAX_CHARACTERS = 256; // catalogue_items_finale_effect_name_format, characters.
const withoutControlCharacters = (value: string) => !/[\p{Cc}]/u.test(value);

/** Empty optional fields are stored as null by the catalogue save action. */
export const finaleMappingFields = {
  finaleProductId: z
    .string()
    .trim()
    .max(FINALE_PRODUCT_ID_MAX_CHARACTERS)
    .refine(withoutControlCharacters, 'Control characters are not allowed.')
    .optional(),
  finaleEffectName: z
    .string()
    .trim()
    .max(FINALE_EFFECT_NAME_MAX_CHARACTERS)
    .refine(withoutControlCharacters, 'Control characters are not allowed.')
    .optional(),
};
