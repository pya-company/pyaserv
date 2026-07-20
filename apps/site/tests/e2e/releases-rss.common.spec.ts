/*
 * E2E: /releases/rss.xml integrity.
 *
 * Bug rss-feed-broken-missing-latest-wrong-links:
 *   - src/pages/releases/rss.xml.ts hard-codes its own releases array; it
 *     drifted when v1.2.0 was added to src/data/releases.ts. Result:
 *       1) v1.2.0 is missing from the feed (2 <item> blocks, should be 3).
 *       2) Every <item><link> is hard-coded to https://pyaserv.com/releases/
 *          instead of the per-release URL /releases/<slug>/.
 *
 * AC-M3: each release SHALL appear in RSS within 5 min of publication;
 *        per-item link SHALL target /releases/<slug>/.
 *
 * This test MUST be RED until rss.xml.ts is rewritten to derive items
 * from the single RELEASES source of truth.
 */
import { expect, test } from '@playwright/test'

const FEED_PATH = '/releases/rss.xml'

const fetchFeed = async (request: import('@playwright/test').APIRequestContext): Promise<string> => {
  const res = await request.get(FEED_PATH)
  expect(res.status(), 'RSS feed must return 200').toBe(200)
  return await res.text()
}

const extractItems = (xml: string): ReadonlyArray<string> => {
  const matches = xml.match(/<item>[\s\S]*?<\/item>/g)
  return matches ?? []
}

const fieldOf = (itemXml: string, tag: 'title' | 'link' | 'guid'): string => {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)
  const m = itemXml.match(re)
  return m ? m[1].trim() : ''
}

test.describe('releases rss feed', () => {
  test('contains every release from data/releases.ts (v1.2.0 included)', async ({ request }) => {
    const xml = await fetchFeed(request)
    const items = extractItems(xml)

    // Single source of truth lists v1.0.0, v1.1.0, v1.2.0 → 3 items.
    expect(items.length, 'one <item> per release in RELEASES').toBeGreaterThanOrEqual(3)

    // v1.2.0 (the entry that drifted out of rss.xml.ts) MUST be present.
    const versions = items.map((i) => fieldOf(i, 'guid'))
    expect(versions, 'v1.2.0 guid present').toContain('pyaserv-v1.2.0')
  })

  test('every <item><link> targets the per-release page (/releases/<slug>/)', async ({ request }) => {
    const xml = await fetchFeed(request)
    const items = extractItems(xml)
    expect(items.length, 'feed has items').toBeGreaterThan(0)

    const links = items.map((i) => fieldOf(i, 'link'))

    // The bug: every link is the channel URL https://pyaserv.com/releases/.
    // Each item link MUST be a per-release deep link, not the index.
    for (const link of links) {
      expect(link, `per-item <link> must not be the index URL: ${link}`)
        .not.toMatch(/^https?:\/\/[^/]+\/releases\/?$/)
      expect(link, `per-item <link> must include a release slug: ${link}`)
        .toMatch(/\/releases\/[^/]+\/?$/)
    }
  })
})
