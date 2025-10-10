import path from 'node:path'

export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFKD') // Normalize unicode characters
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, '') // Trim - from end of text
}

export const rootPath = path.resolve()
