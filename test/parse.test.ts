// Behavior tests, moved from arrgh's plugin-host/src/behavior.new-plugins.test.ts
// (ADR 0031) when this plugin split into its own repo (spec 031 phase C).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as nhentai from '../src/nhentai'

function mockFetch(responses: Record<string, { ok?: boolean; text?: string; json?: unknown }>) {
  return vi.fn().mockImplementation((url: string) => {
    const key = Object.keys(responses).find((k) => url.toString().includes(k))
    const resp = key ? responses[key] : { ok: false, text: '', json: {} }
    return Promise.resolve({
      ok: resp.ok ?? true,
      text: async () => resp.text ?? '',
      json: async () => resp.json ?? {},
    })
  })
}

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { vi.unstubAllGlobals() })

// ═══════════════════════════════════════════════════════════════════════════════
// nhentai — direct v2 API first, CloakBrowser fallback on challenge (spec 023)
// ═══════════════════════════════════════════════════════════════════════════════

// Live captures 2026-09-26 (plain HTTP, no browser): search trimmed to 2 results,
// gallery trimmed to id/media_id/title/num_pages + 3 pages.
const NH_SEARCH_JSON = {
  "result": [
    {
      "id": 675926,
      "media_id": "4139058",
      "english_title": "[Tadaichidono (Haiboku)] Ground Berserker Minamoto no Raikou /  Ground Berserker Minamoto no Raikou ~ What Happened When I Started Using My Command Seal Willy Nillym on Minamoto no Raikou [SHORTENED] (FGO) [English] {Doujins.com}",
      "japanese_title": "[ただ一度の (敗北)] グラウンドバーサーカー源頼光~源頼光に軽率に令呪を使ってみた結果 (Fate/Grand Order) [DL版] [英訳]",
      "thumbnail": "galleries/4139058/thumb.webp",
      "thumbnail_width": 250,
      "thumbnail_height": 351,
      "num_pages": 28,
      "num_favorites": 2335,
      "tag_ids": [
        2937,
        12227,
        13989,
        16828,
        17249,
        33172,
        35605,
        35762,
        35763,
        50981,
        50982,
        51810,
        71442,
        122908
      ],
      "blacklisted": false
    },
    {
      "id": 653307,
      "media_id": "3962988",
      "english_title": "[Neko Plus] Berserk Grandma ENG",
      "japanese_title": "",
      "thumbnail": "galleries/3962988/thumb.webp",
      "thumbnail_width": 250,
      "thumbnail_height": 383,
      "num_pages": 41,
      "num_favorites": 924,
      "tag_ids": [
        2937,
        8653,
        12227,
        20905,
        33172,
        80718,
        90671,
        150201
      ],
      "blacklisted": false
    }
  ],
  "num_pages": 2,
  "per_page": 25,
  "total": 28
}
const NH_GALLERY_JSON = {
  "id": 675926,
  "media_id": "4139058",
  "title": {
    "english": "[Tadaichidono (Haiboku)] Ground Berserker Minamoto no Raikou /  Ground Berserker Minamoto no Raikou ~ What Happened When I Started Using My Command Seal Willy Nillym on Minamoto no Raikou [SHORTENED] (FGO) [English] {Doujins.com}",
    "japanese": "[ただ一度の (敗北)] グラウンドバーサーカー源頼光~源頼光に軽率に令呪を使ってみた結果 (Fate/Grand Order) [DL版] [英訳]",
    "pretty": "Ground Berserker Minamoto no Raikou /  Ground Berserker Minamoto no Raikou ~ What Happened When I Started Using My Command Seal Willy Nillym on Minamoto no Raikou"
  },
  "num_pages": 28,
  "pages": [
    {
      "number": 1,
      "path": "galleries/4139058/1.webp",
      "width": 1280,
      "height": 1797,
      "thumbnail": "galleries/4139058/1t.webp",
      "thumbnail_width": 200,
      "thumbnail_height": 281
    },
    {
      "number": 2,
      "path": "galleries/4139058/2.webp",
      "width": 1280,
      "height": 1864,
      "thumbnail": "galleries/4139058/2t.webp.webp",
      "thumbnail_width": 200,
      "thumbnail_height": 291
    },
    {
      "number": 3,
      "path": "galleries/4139058/3.webp",
      "width": 1280,
      "height": 1864,
      "thumbnail": "galleries/4139058/3t.webp",
      "thumbnail_width": 200,
      "thumbnail_height": 291
    }
  ]
}
const NH_SEARCH_URL = 'https://nhentai.net/api/v2/search?query=berserk%20language%3Aenglish&page=1'

function nhFetch(res: { status?: number; contentType?: string; body: unknown }) {
  const status = res.status ?? 200
  return vi.fn().mockImplementation(() => Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? res.contentType ?? 'application/json' : null) },
    json: async () => res.body,
    text: async () => (typeof res.body === 'string' ? res.body : JSON.stringify(res.body)),
  }))
}

function nhBrowser(evaluateResult: unknown) {
  const getBrowser = vi.fn().mockImplementation(async () => {
    const page = {
      goto: async () => {},
      content: async () => '',
      evaluate: async () => evaluateResult,
      close: async () => {},
    }
    return { isConnected: () => true, newContext: async () => ({ newPage: async () => page, close: async () => {} }) }
  })
  return getBrowser
}

const noBrowser = () => vi.fn().mockRejectedValue(new Error('browser must not be used'))

describe('nhentai — direct API (spec 023)', () => {
  it('search: direct v2 call, no browser, virtual result id = encoded query', async () => {
    const f = nhFetch({ body: NH_SEARCH_JSON })
    vi.stubGlobal('fetch', f)
    const getBrowser = noBrowser()
    nhentai.setContext({ getBrowser, logger: console })
    const results = await nhentai.search('berserk')
    expect(results).toEqual([{ id: 'berserk', title: 'berserk', status: 'complete' }])
    expect(f.mock.calls[0][0]).toBe(NH_SEARCH_URL)
    expect(getBrowser).not.toHaveBeenCalled()
  })

  it('chapters: galleries sorted by id, titled', async () => {
    vi.stubGlobal('fetch', nhFetch({ body: NH_SEARCH_JSON }))
    nhentai.setContext({ getBrowser: noBrowser(), logger: console })
    const chs = await nhentai.chapters('berserk')
    expect(chs.map((c) => c.source_id)).toEqual(['653307', '675926'])
    expect(chs.map((c) => c.number)).toEqual([1, 2])
    expect(chs[0].title).toBe('[Neko Plus] Berserk Grandma ENG')
  })

  it('pages: image URLs from gallery JSON, no browser', async () => {
    const f = nhFetch({ body: NH_GALLERY_JSON })
    vi.stubGlobal('fetch', f)
    const getBrowser = noBrowser()
    nhentai.setContext({ getBrowser, logger: console })
    const urls = await nhentai.pages('675926')
    expect(f.mock.calls[0][0]).toBe('https://nhentai.net/api/v2/galleries/675926')
    expect(urls).toEqual([
      'https://i.nhentai.net/galleries/4139058/1.webp',
      'https://i.nhentai.net/galleries/4139058/2.webp',
      'https://i.nhentai.net/galleries/4139058/3.webp',
    ])
    expect(getBrowser).not.toHaveBeenCalled()
  })

  it('empty result is a real "no results" — no browser fallback', async () => {
    vi.stubGlobal('fetch', nhFetch({ body: { result: [] } }))
    const getBrowser = noBrowser()
    nhentai.setContext({ getBrowser, logger: console })
    expect(await nhentai.search('zzzznothing')).toEqual([])
    expect(getBrowser).not.toHaveBeenCalled()
  })

  it('403 challenge page → falls back to the browser once', async () => {
    vi.stubGlobal('fetch', nhFetch({ status: 403, contentType: 'text/html', body: '<title>Just a moment...</title>' }))
    const getBrowser = nhBrowser(NH_SEARCH_JSON)
    nhentai.setContext({ getBrowser, logger: console })
    expect(await nhentai.search('berserk')).toHaveLength(1)
    expect(getBrowser).toHaveBeenCalledTimes(1)
  })

  it('200 HTML (non-JSON) is treated as a challenge too', async () => {
    vi.stubGlobal('fetch', nhFetch({ contentType: 'text/html', body: '<html></html>' }))
    const getBrowser = nhBrowser(NH_SEARCH_JSON)
    nhentai.setContext({ getBrowser, logger: console })
    expect(await nhentai.search('berserk')).toHaveLength(1)
    expect(getBrowser).toHaveBeenCalledTimes(1)
  })

  it('challenge + browser failure → search rejects', async () => {
    vi.stubGlobal('fetch', nhFetch({ status: 403, contentType: 'text/html', body: '' }))
    nhentai.setContext({ getBrowser: vi.fn().mockRejectedValue(new Error('CLOAKBROWSER_WS_URL is not set')), logger: console })
    await expect(nhentai.search('berserk')).rejects.toThrow()
  })

  it('404 JSON is a genuine API error — no browser fallback', async () => {
    vi.stubGlobal('fetch', nhFetch({ status: 404, body: { error: 'not found' } }))
    const getBrowser = noBrowser()
    nhentai.setContext({ getBrowser, logger: console })
    await expect(nhentai.pages('1')).rejects.toThrow(/404/)
    expect(getBrowser).not.toHaveBeenCalled()
  })
})
