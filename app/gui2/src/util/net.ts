import type {
  IJSONRPCNotificationResponse,
  JSONRPCRequestData,
} from '@open-rpc/client-js/build/Request'
import { Transport } from '@open-rpc/client-js/build/transports/Transport'
import { type ArgumentsType } from '@vueuse/core'
import type { Notifications } from 'shared/languageServerTypes'
import { AbortScope, type TransportWithWebsocketEvents } from 'shared/util/net'
import ReconnectingWebSocketTransport from 'shared/util/net/ReconnectingWSTransport'
import { WebsocketClient } from 'shared/websocket'
import { onScopeDispose } from 'vue'

export { AbortScope, rpcWithRetries } from 'shared/util/net'

export function createRpcTransport(url: string): TransportWithWebsocketEvents {
  if (url.startsWith('mock://')) {
    const mockName = url.slice('mock://'.length)
    return new MockTransport(mockName)
  } else {
    const transport = new ReconnectingWebSocketTransport(url)
    return transport
  }
}

export function createWebsocketClient(
  url: string,
  abort: AbortScope,
  options?: { binaryType?: 'arraybuffer' | 'blob' | null; sendPings?: boolean },
): WebsocketClient {
  if (url.startsWith('mock://')) {
    const mockWs = new MockWebSocketClient(url, abort)
    if (options?.binaryType) mockWs.binaryType = options.binaryType
    return mockWs
  } else {
    const client = new WebsocketClient(url, abort, options)
    client.connect()
    return client
  }
}

export interface MockTransportData<Methods extends string = string> {
  (method: Methods, params: any, transport: MockTransport): Promise<any>
}

export class MockTransport extends Transport {
  static mocks: Map<string, MockTransportData> = new Map()
  constructor(public name: string) {
    super()
  }

  static addMock<Methods extends string>(name: string, data: MockTransportData<Methods>) {
    MockTransport.mocks.set(name, data as any)
  }
  connect(): Promise<any> {
    return Promise.resolve()
  }
  close(): void {}
  sendData(data: JSONRPCRequestData, timeout?: number | null): Promise<any> {
    if (Array.isArray(data)) return Promise.all(data.map((d) => this.sendData(d.request, timeout)))
    return (
      MockTransport.mocks.get(this.name)?.(data.request.method, data.request.params, this) ??
      Promise.reject()
    )
  }
  emit<N extends keyof Notifications>(method: N, params: ArgumentsType<Notifications[N]>[0]): void {
    this.transportRequestManager.transportEventChannel.emit('notification', {
      jsonrpc: '2.0',
      method,
      params,
    } as IJSONRPCNotificationResponse)
  }

  on<K extends keyof WebSocketEventMap>(
    _type: K,
    _cb: (event: WebSocketEventMap[K]) => void,
  ): void {}
  off<K extends keyof WebSocketEventMap>(
    _type: K,
    _cb: (event: WebSocketEventMap[K]) => void,
  ): void {}
}

export interface WebSocketHandler {
  (
    data: string | ArrayBufferLike | Blob | ArrayBufferView,
    send: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => void,
  ): void
}

export class MockWebSocket extends EventTarget implements WebSocket {
  static mocks: Map<string, WebSocketHandler> = new Map()
  readonly CONNECTING = WebSocket.CONNECTING
  readonly OPEN = WebSocket.OPEN
  readonly CLOSING = WebSocket.CLOSING
  readonly CLOSED = WebSocket.CLOSED
  readyState: number = WebSocket.OPEN
  binaryType: BinaryType = 'blob'
  readonly bufferedAmount = 0
  readonly extensions = ''
  readonly protocol = ''
  onopen: ((this: WebSocket, ev: Event) => any) | null = null
  onclose: ((this: WebSocket, ev: CloseEvent) => any) | null = null
  onmessage: ((this: WebSocket, ev: MessageEvent<any>) => any) | null = null
  onerror: ((this: WebSocket, ev: Event) => any) | null = null

  static addMock(name: string, data: WebSocketHandler) {
    MockWebSocket.mocks.set(name, data)
  }

  constructor(
    public url: string,
    public name: string,
  ) {
    super()
    this.addEventListener('open', (ev) => this.onopen?.(ev))
    this.addEventListener('close', (ev) => this.onclose?.(ev as CloseEvent))
    // deepcode ignore InsufficientPostmessageValidation: This is not a `postMessage`.
    this.addEventListener('message', (ev) => this.onmessage?.(ev as MessageEvent<any>))
    this.addEventListener('error', (ev) => this.onerror?.(ev))
    setTimeout(() => this.dispatchEvent(new Event('open')), 0)
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    MockWebSocket.mocks.get(this.name)?.(data, (data) =>
      this.dispatchEvent(new MessageEvent('message', { data })),
    )
  }
  close() {
    this.readyState = WebSocket.CLOSED
  }
}

export class MockWebSocketClient extends WebsocketClient {
  constructor(url: string, abort: AbortScope) {
    super(url, abort)
    super.connect(new MockWebSocket(url, url.slice('mock://'.length)))
  }
}

type QueueTask<State> = (state: State) => Promise<State>

/**
 * A serializing queue of asynchronous tasks transforming a state. Each task is a function that
 * takes the current state and produces a promise to the transformed state. Each task waits for the
 * previous task to finish before starting.
 */
export class AsyncQueue<State> {
  lastTask: Promise<State>
  taskRunning = false
  queuedTasks: QueueTask<State>[] = []

  constructor(initTask: Promise<State>) {
    this.lastTask = initTask
  }

  private run() {
    if (this.taskRunning) return
    const task = this.queuedTasks.shift()
    if (task == null) return
    this.taskRunning = true
    this.lastTask = this.lastTask
      .then(
        (state) => task(state),
        (error) => {
          console.error(
            "AsyncQueue failed to run task '" + task.toString() + "' with error:",
            error,
          )
          throw error
        },
      )
      .finally(() => {
        this.taskRunning = false
        this.run()
      })
  }

  pushTask(f: QueueTask<State>) {
    this.queuedTasks.push(f)
    this.run()
  }

  clear() {
    this.queuedTasks.length = 0
  }

  async waitForCompletion(): Promise<State> {
    let lastState: State
    do {
      lastState = await this.lastTask
    } while (this.taskRunning)
    return lastState
  }
}

/** Create an abort signal that is signalled when containing Vue scope is disposed. */
export function useAbortScope(): AbortScope {
  const scope = new AbortScope()
  onScopeDispose(() => scope.dispose('Vue scope disposed.'))
  return scope
}
