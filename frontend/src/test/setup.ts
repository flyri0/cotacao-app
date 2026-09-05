import '@testing-library/jest-dom'

class MockBroadcastChannel {
  name: string
  onmessage: ((event: any) => void) | null = null
  private static channels: Map<string, Set<MockBroadcastChannel>> = new Map()

  constructor(name: string) {
    this.name = name
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, new Set())
    }
    MockBroadcastChannel.channels.get(name)!.add(this)
  }

  postMessage(data: any) {
    const list = MockBroadcastChannel.channels.get(this.name)
    if (list) {
      list.forEach((ch) => {
        if (ch !== this && ch.onmessage) {
          ch.onmessage({ data } as MessageEvent)
        }
      })
    }
  }

  close() {
    const list = MockBroadcastChannel.channels.get(this.name)
    if (list) {
      list.delete(this)
      if (list.size === 0) {
        MockBroadcastChannel.channels.delete(this.name)
      }
    }
  }
}

if (typeof window !== 'undefined') {
  ;(window as any).BroadcastChannel = MockBroadcastChannel
}
;(globalThis as any).BroadcastChannel = MockBroadcastChannel

if (typeof window !== 'undefined') {
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = () => 'blob:mock-url'
  }
  if (!window.URL.revokeObjectURL) {
    window.URL.revokeObjectURL = () => {}
  }
}
