/**
 * Utility to normalize player names for robust matching.
 * Mirrors the logic used in the Android version's NameNormalizer.kt.
 */
export const NameNormalizer = {
    /**
     * Normalizes a string by:
     * 1. Applying NFKC (Unicode normalization).
     * 2. Removing symbols and whitespace.
     * 3. Converting to lowercase.
     */
    normalizeForMatching(value: string): string {
        if (!value) return "";

        // NFKC normalization handles things like full-width to half-width conversion
        const normalized = value.normalize('NFKC');

        // Remove whitespace and punctuation/symbols
        // In JS, we can use regex to match non-word characters (including spaces)
        return normalized
            .replace(/[\s\p{Punctuation}\p{Separator}\p{Symbol}]+/gu, "")
            .toLowerCase();
    }
};
