import crypto from 'crypto';

/**
 * Generate a URL-friendly slug from a string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars except spaces and hyphens
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generate a random suffix for uniqueness
 */
export function generateSlugSuffix(length: number = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const bytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  
  return result;
}

/**
 * Generate a unique slug with random suffix
 * Example: "ultimate-react-course-a3f9k2"
 */
export function generateUniqueSlug(name: string, suffixLength: number = 6): string {
  const baseSlug = slugify(name);
  const suffix = generateSlugSuffix(suffixLength);
  return `${baseSlug}-${suffix}`;
}

/**
 * Extract the base slug without the random suffix
 * Example: "ultimate-react-course-a3f9k2" => "ultimate-react-course"
 */
export function getBaseSlug(slug: string): string {
  const parts = slug.split('-');
  if (parts.length <= 1) return slug;
  
  // Remove last part (the random suffix)
  return parts.slice(0, -1).join('-');
}

/**
 * Extract product ID from slug if it follows pattern: name-id
 * Example: "ultimate-react-course-a3f9k2" => "a3f9k2"
 */
export function extractSuffixFromSlug(slug: string): string | null {
  const parts = slug.split('-');
  if (parts.length <= 1) return null;
  
  const lastPart = parts[parts.length - 1];
  // Check if last part looks like our generated suffix (6 alphanumeric chars)
  if (/^[a-z0-9]{6}$/.test(lastPart)) {
    return lastPart;
  }
  
  return null;
}