"use client";

/**
 * iTunes Preview integration.
 *
 * Apple's iTunes Search API is free, requires no auth, allows CORS, and
 * returns 30-second .m4a preview URLs for almost every commercial song.
 * Perfect for an MVP: real artist recordings as our "Lyssna på exempel"
 * playback target, with zero infrastructure.
 *
 * We skip lookups for "Traditional" artists (Twinkle, Happy Birthday,
 * Frère Jacques, etc.) because iTunes returns random/low-quality covers
 * for those — the synth fallback sounds more on-spec.
 *
 * In-memory cache prevents refetching the same song repeatedly. The
 * cache lives for the page session (Map in module scope).
 *
 * TODO (future): server-side proxy if we ever hit iTunes' undocumented
 * rate limit, or migrate to Spotify Web API previews for tighter
 * artist/track matching.
 */

const cache = new Map<string, string | null>();

/**
 * Returns a 30-second preview URL, or `null` if iTunes had no good hit.
 * Always resolves — never throws — so callers can safely fall back.
 */
export async function getPreviewUrl(
  artist: string,
  title: string,
): Promise<string | null> {
  if (!artist || !title) return null;
  if (artist.toLowerCase() === "traditional") return null;

  const cacheKey = `${artist}::${title}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;

  // Strip parentheticals like "(Live)" or "(2011 Remaster)" from title —
  // they hurt search relevance more than they help.
  const cleanTitle = title.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const query = `${cleanTitle} ${artist}`.replace(/\s+/g, " ").trim();

  const url =
    `https://itunes.apple.com/search?` +
    `term=${encodeURIComponent(query)}` +
    `&entity=song&limit=5&country=SE`;

  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      cache.set(cacheKey, null);
      return null;
    }
    const data: { results?: Array<{ previewUrl?: string; artistName?: string; trackName?: string }> } =
      await res.json();
    const results = data.results ?? [];

    // Prefer the result whose artistName most closely matches our artist.
    // iTunes's first hit isn't always the original artist.
    const wantArtist = artist.toLowerCase();
    const ranked = results
      .map((r) => {
        const a = (r.artistName ?? "").toLowerCase();
        const score =
          a === wantArtist ? 100 :
          a.includes(wantArtist) ? 80 :
          wantArtist.includes(a) ? 60 :
          0;
        return { r, score };
      })
      .sort((a, b) => b.score - a.score);

    const picked = ranked.find((x) => x.r.previewUrl);
    const previewUrl = picked?.r.previewUrl ?? null;
    cache.set(cacheKey, previewUrl);
    return previewUrl;
  } catch {
    cache.set(cacheKey, null);
    return null;
  }
}
