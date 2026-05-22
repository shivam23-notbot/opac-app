/**
 * Shared utilities for HTML/PDF generation.
 * Imported by salaryPdf.ts and productionPdf.ts — keep lightweight.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generatedOnString(): string {
  return new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function wrapDocument(styleHtml: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  ${styleHtml}
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
