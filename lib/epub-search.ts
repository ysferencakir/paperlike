import {
  SEARCH_RESULT_LIMIT,
  SEARCH_YIELD_INTERVAL,
  throwIfSearchAborted,
  yieldSearchControl,
} from "./search-control";

export interface EpubSearchSection {
  load: (request: (path: string) => Promise<unknown>) => Promise<unknown>;
  unload: () => void;
  find: (query: string) => { cfi: string; excerpt: string }[];
}

interface EpubSearchOptions {
  signal?: AbortSignal;
  onProgress?: (progress: {
    completed: number;
    total: number;
    resultCount: number;
  }) => void;
}

export async function searchEpubSections(
  sections: EpubSearchSection[],
  request: (path: string) => Promise<unknown>,
  query: string,
  options?: EpubSearchOptions
): Promise<{ location: string; excerpt: string }[]> {
  const results: { location: string; excerpt: string }[] = [];

  for (let index = 0; index < sections.length; index++) {
    if (results.length >= SEARCH_RESULT_LIMIT) break;
    throwIfSearchAborted(options?.signal);
    const section = sections[index];
    try {
      await section.load(request);
      throwIfSearchAborted(options?.signal);
      for (const match of section.find(query)) {
        results.push({ location: match.cfi, excerpt: match.excerpt });
        if (results.length >= SEARCH_RESULT_LIMIT) break;
      }
    } finally {
      section.unload();
    }
    options?.onProgress?.({
      completed: index + 1,
      total: sections.length,
      resultCount: results.length,
    });
    if ((index + 1) % SEARCH_YIELD_INTERVAL === 0) {
      await yieldSearchControl(options?.signal);
    }
  }

  return results;
}
