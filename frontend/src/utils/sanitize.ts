import DOMPurify from 'dompurify';

/**
 * ponytail: Sanitizes raw HTML to prevent Stored XSS.
 * This should be used anywhere we render HTML returned from the backend, 
 * especially data originating from the scraper pipelines.
 */
export const sanitizeHtml = (dirtyHtml: string): string => {
  if (!dirtyHtml) return '';
  return DOMPurify.sanitize(dirtyHtml, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class'],
  });
};
