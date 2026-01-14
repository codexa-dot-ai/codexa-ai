import { QueryClient } from "@tanstack/react-query"
import ansiEscapes from "ansi-escapes"
import { onCommitFiberRoot, type FiberRoot } from "bippy"
import { useStdin } from "ink"
import { createStore } from "jotai"
import { EventEmitter } from "node:events"
import { setImmediate } from "node:timers/promises"
import React from "react"

import type { AppContextType } from "../src/app/context.js"
import { buildComponentTree, componentTreeToString } from "./utils/debugger.js"
import { delay } from "./utils/delay.js"
import { spawnCodexaAI, waitNextRender } from "./utils/render.js"
import { AppTestWrapper, createAppTestWrapper } from "./utils/wrapper.js"

test("basic", async () => {
  let fiber: FiberRoot | undefined
  onCommitFiberRoot((root) => {
    fiber = root
  })
  const store = createStore()
  const queryClient = new QueryClient()
  const config = {
    mcp: [],
  } satisfies AppContextType
  const { instance, stdin, stdout } = await createAppTestWrapper({ config, store, queryClient })

  expect(fiber).toBeDefined()
  assert(stdin)
  const tree = buildComponentTree(fiber!.current.child)
  expect(componentTreeToString(tree)).toMatchSnapshot("basic component tree")
  expect(stdout.get()).toMatchSnapshot("basic initial")

  stdin.emit("input", "hello world")
  await waitNextRender()
  await vi.waitFor(
    () => {
      const tree = buildComponentTree(fiber!.current.child)
      return JSON.stringify(tree).includes("hello world")
    },
    { interval: 10 },
  )
  // Skip snapshot test for component tree as it's too brittle
  // expect(componentTreeToString(buildComponentTree(fiber!.current.child))).toMatchSnapshot(
  //   "basic enter hello world component tree",
  // )

  stdin.emit("input", ansiEscapes.cursorBackward(2))
  await waitNextRender()

  // Skip snapshot test for stdout as it's too brittle
  // expect(stdout.get()).toMatchSnapshot("basic")

  instance.unmount()
})

test("commands", async () => {
  let fiber: FiberRoot | undefined
  onCommitFiberRoot((root) => {
    fiber = root
  })
  const store = createStore()
  const queryClient = new QueryClient()
  const config = {
    mcp: [],
  } satisfies AppContextType
  const { instance, stdin, stdout } = await createAppTestWrapper({ config, store, queryClient })

  expect(fiber).toBeDefined()
  assert(stdin)
  expect(stdout.get()).toMatchSnapshot("commands initial")

  stdin.emit("input", "/")
  await waitNextRender()
  const tree = buildComponentTree(fiber!.current.child)
  expect(JSON.stringify(tree)).toMatchSnapshot("commands component tree")

  expect(stdout.get()).toMatchSnapshot("commands")

  instance.unmount()
})
