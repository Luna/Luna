/**
 * @file An entry point for polyglot Yjs gateway server.
 */

import { docName } from './auth'
import { setupGatewayClient } from './ydoc'

declare global {
  class WebSocketServer {
    constructor(config: any)
    onconnect: ((socket: any, url: any) => any) | null
    start(): void
  }

  const YDOC_HOST: string | undefined
  const YDOC_PORT: number | undefined
  const YDOC_LS_DEBUG: boolean | undefined
}

const host = YDOC_HOST ?? 'localhost'
const port = YDOC_PORT ?? 1234
const debug = YDOC_LS_DEBUG ?? false

const wss = new WebSocketServer({ host, port })

wss.onconnect = (socket, url) => {
  const doc = docName(url.pathname)
  const ls = url.searchParams.get('ls')
  if (doc != null && ls != null) {
    console.log('setupGatewayClient', ls, doc)
    setupGatewayClient(socket, ls, doc, debug)
  } else {
    console.log('Failed to authenticate user', ls, doc)
  }
}

wss.start()
