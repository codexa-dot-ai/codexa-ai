import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import { useAtomValue } from "jotai"
import { toolConfirmationStateAtom } from "../lib/store/tool-confirmation.js"
import { inspect } from "node:util"
import { useTerminalSize } from "@/lib/use-terminal-size.js"

export function ToolConfirmationDialog() {
  const state = useAtomValue(toolConfirmationStateAtom)
  const [selectedButton, setSelectedButton] = useState<"confirm" | "cancel">("cancel")
  const term = useTerminalSize()

  // Handle keyboard input
  useInput((_input, key) => {
    if (!state.isOpen) return

    // Handle left/right arrow keys for button navigation
    if (key.leftArrow) {
      setSelectedButton("cancel")
    } else if (key.rightArrow) {
      setSelectedButton("confirm")
    }

    // Handle enter key for confirmation/cancellation
    if (key.return) {
      if (selectedButton === "confirm") {
        state.onConfirm()
      } else {
        state.onCancel()
      }
    }

    // Handle escape key for cancellation
    if (key.escape) {
      state.onCancel()
    }
  })

  if (!state.isOpen) return null

  // Format tool arguments for display
  const formattedArgs = inspect(state.toolArgs, {
    depth: 1,
    colors: false,
    compact: true,
    breakLength: 80,
  })

  return (
    <Box
      flexDirection="column"
      width={term.columns}
      height={term.rows}
      borderStyle="round"
      borderColor="magenta"
      padding={1}
    >
      <Box flexDirection="column" gap={1}>
        <Text bold color="magenta">
          Tool Confirmation Required
        </Text>
        <Text>Do you want to run the following tool?</Text>
        <Box flexDirection="column" marginY={1} paddingX={2}>
          <Text bold color="magenta">
            {state.toolName}
          </Text>
          <Text color="gray">Arguments:</Text>
          <Box paddingLeft={2}>
            <Text>{formattedArgs}</Text>
          </Box>
        </Box>
        <Box marginTop={1} justifyContent="center" gap={4} flexDirection="row">
          {selectedButton === "cancel" && (
            <>
              <Text backgroundColor="red" color="white" bold>
                [Cancel]
              </Text>
              <Text color="magenta" bold>
                [Confirm]
              </Text>
            </>
          )}
          {selectedButton === "confirm" && (
            <>
              <Text color="red" bold>
                [Cancel]
              </Text>
              <Text backgroundColor="magenta" color="white" bold>
                [Confirm]
              </Text>
            </>
          )}
        </Box>
        <Box marginTop={1} justifyContent="center" flexDirection="row">
          <Text color="gray" italic>
            Use ← → arrow keys to navigate, Enter to select
          </Text>
        </Box>
      </Box>
    </Box>
  )
}
