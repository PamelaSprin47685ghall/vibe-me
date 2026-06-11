export function formatSearchResults(results: Array<{ title: string; url: string; content: string }>): string {
  if (!results?.length) return 'No results found.';
  return results.map((item, i) => `${i + 1}. ${item.title}\n   URL: ${item.url}\n   ${item.content}`).join('\n\n');
}

export function formatFetchResponse(data: { title?: string; byline?: string; length?: number; content?: string }): string {
  return [
    `Title: ${data.title ?? ''}`,
    data.byline ? `By: ${data.byline}` : null,
    typeof data.length === 'number' ? `Length: ${data.length}` : null,
    '',
    data.content ?? '',
  ].filter(Boolean).join('\n');
}