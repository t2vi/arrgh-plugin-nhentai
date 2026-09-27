import type { PluginInfo } from 'arrgh-plugin-sdk'
import { version } from '../package.json'
import { setContext } from './nhentai'
import * as n from './nhentai'
import type { PluginContext } from './nhentai'

export const info: PluginInfo = {
  id: 'nhentai',
  name: 'nhentai',
  version,
  default_explicit: true,
  content_types: ['hentai'],
}

export function init(ctx: PluginContext): void {
  setContext(ctx)
}

export const search = n.search
export const chapters = n.chapters
export const pages = n.pages
