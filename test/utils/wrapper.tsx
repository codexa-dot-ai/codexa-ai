import { Provider, createStore } from "jotai"
import { App } from "../../src/app.js"
import { type AppContextType, AppProvider } from "../../src/app/context.js"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import { EventEmitter } from "node:stream"
import { useStdin } from "ink"
import { spawnCodexaAI } from "./render.js"
import { vi } from "vitest"

export async function createAppTestWrapper({
  store,
  queryClient,
  config,
}: Parameters<typeof AppTestWrapper>[0]) {
  let stdin: EventEmitter | undefined
  function App() {
    const { internal_eventEmitter } = useStdin()
    stdin = internal_eventEmitter
    return <AppTestWrapper store={store} queryClient={queryClient} config={config} />
  }
  const { instance, stdout } = await spawnCodexaAI(<App />)

  await vi.waitUntil(
    () => {
      return !!stdin
    },
    { interval: 10 },
  )

  return { instance, stdin, stdout }
}

export function AppTestWrapper({
  store,
  queryClient,
  config,
}: {
  store: ReturnType<typeof createStore>
  queryClient: QueryClient
  config: AppContextType
}) {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <AppProvider {...config} mcp={config.mcp} customTools={config.customTools || {}}>
          <App />
        </AppProvider>
      </QueryClientProvider>
    </Provider>
  )
}
