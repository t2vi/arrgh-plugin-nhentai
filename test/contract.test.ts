import { pluginContractTests } from 'arrgh-plugin-sdk/testing'
import * as plugin from '../src/index'
import pkg from '../package.json'

pluginContractTests(plugin, { id: 'nhentai', version: pkg.version })
