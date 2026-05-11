export async function braveSearch(queries, apiKey, seenUrls = []) {
  const seenSet = new Set(seenUrls);
  const newUrls = [];

  for (const query of queries) {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`;
    let data;
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        console.warn(`  Search failed for "${query}": HTTP ${res.status}`);
        continue;
      }
      data = await res.json();
    } catch (e) {
      console.warn(`  Search error for "${query}": ${e.message}`);
      continue;
    }

    for (const result of data?.web?.results ?? []) {
      if (result.url && !seenSet.has(result.url)) {
        newUrls.push(result.url);
        seenSet.add(result.url);
      }
    }
  }

  return { urls: newUrls, updatedSeen: [...seenSet] };
}
