import slugify from 'slugify';

/**
 * Generate a URL-friendly slug from a string.
 * @param {string} text
 * @param {object} [options]
 * @param {boolean} [options.lower=true]
 * @param {boolean} [options.strict=true]
 * @param {string} [options.replacement='-']
 * @param {string} [options.locale='en']
 * @param {string|number} [options.suffix] — appended to ensure uniqueness
 * @returns {string}
 */
export function generateSlug(text, options = {}) {
  const {
    lower = true,
    strict = true,
    replacement = '-',
    locale = 'en',
    suffix,
  } = options;

  let slug = slugify(String(text || ''), {
    lower,
    strict,
    replacement,
    locale,
    trim: true,
  });

  if (!slug) {
    slug = 'item';
  }

  if (suffix !== undefined && suffix !== null && suffix !== '') {
    slug = `${slug}${replacement}${suffix}`;
  }

  return slug;
}

/**
 * Generate a slug with a short random suffix for uniqueness.
 * @param {string} text
 * @param {number} [randomLength=6]
 * @returns {string}
 */
export function generateUniqueSlug(text, randomLength = 6) {
  const suffix = Math.random()
    .toString(36)
    .slice(2, 2 + randomLength);
  return generateSlug(text, { suffix });
}

export default {
  generateSlug,
  generateUniqueSlug,
};
