import { Spinner } from "@inkjs/ui"
import { Box, Text, useInput } from "ink";
import { memo, Suspense, useCallback, useEffect, useMemo, useState } from "react"
import path from "path"
import { embed, type LanguageModelUsage, type Message } from "ai"
import { AutoUpdater } from "@/components/auto-updater.js"
import { formatDurationMilliseconds } from "../lib/duration.js"
import { getTheme } from "../lib/theme.js"
import { useArrowKeyHistory } from "../lib/use-arrow-key-history.js"
import { useCommandAutocomplete } from "../lib/use-command-autocomplete.js"
import { useTerminalSize } from "../lib/use-terminal-size.js"
import TextInput from "./text-input.js"
import React from "react";
import { useMutation } from "@tanstack/react-query"
import { globbyStream } from "globby"
import { useAppContext } from "@/app/context.js"
import lancedb, { type Table } from "@lancedb/lancedb"
import { env } from "@/lib/env.js"
import { messageStorage } from "@/lib/storage.js"

export type Command = {
  name: string
  type?: "prompt"
  description: string
  argNames?: string[]
  aliases?: string[]
  userFacingName: () => string
}

type Props = {
  commands: Command[]
  isDisabled: boolean
  isLoading: boolean
  messages: Message[]
  input: string
  usage: LanguageModelUsage
  onInputChange: (value: string) => void
  onStop: () => void
  onSubmit: () => void
  setMessages: (messages: Message[]) => void
}

function getPastedTextPrompt(text: string): string {
  const newlineCount = (text.match(/\r\n|\r|\n/g) || []).length
  return `[Pasted text +${newlineCount} lines] `
}

export const AIInput = memo(
  ({
    commands,
    isDisabled,
    isLoading,
    messages,
    input,
    usage,
    onInputChange,
    onSubmit: onChatSubmit,
    setMessages,
    onStop,
  }: Props): React.ReactNode => {
    const [exitMessage, setExitMessage] = useState<{
      show: boolean
      key?: string
    }>({ show: false })
    const [message, setMessage] = useState<{
      show: boolean
      text?: string
    }>({ show: false })
    const [placeholder, setPlaceholder] = useState("")
    const [cursorOffset, setCursorOffset] = useState<number>(input.length)
    const [pastedText, setPastedText] = useState<string | null>(null)
    const [timer, setTimer] = useState(0)
    const { model, experimental } = useAppContext()
    const index = useMutation({
      mutationFn: async ({}: any) => {
        if (!experimental?.codeBaseIndex?.enabled) {
          throw new Error("Codebase indexing is not enabled")
        }
        const embeddingModel =
          experimental?.codeBaseIndex?.model || (model as any).embedding("text-embedding-ada-002")
        async function getVector(text: string) {
          const { embedding } = await embed({
            model: embeddingModel,
            value: text,
          })
          return embedding
        }
        const db = await lancedb.connect(path.join(env.cwd, ".coder/embeddings"))

        let table: Table | undefined

        const files = globbyStream("**/*.{js,ts,jsx,tsx,md,css,html,py,go,rs}", {
          cwd: env.cwd,
          gitignore: true,
          ignoreFiles: [
            ".eslintignore",
            ".gitignore",
            ".prettierrc",
            ".prettierignore",
            ".coderignore",
          ],
        })
        for await (const file of files) {
          const data = [
            {
              id: file,
              vector: await getVector(await Bun.file(file as string).text()),
              content: file,
            },
          ]
          if (!table) {
            table = await db.createTable("codebase_index", data, { existOk: true })
            continue
          }
          await table.add(data)
        }
      },
    })

    useEffect(() => {
      if (exitMessage.key === "Ctrl-C") {
        onStop()
      }
    }, [exitMessage.key, onStop])

    useEffect(() => {
      const interval = setInterval(() => {
        if (isLoading) {
          setTimer((timer) => timer + 1e3)
        }
      }, 1000)
      return () => {
        clearInterval(interval)
        setTimer(0)
      }
    }, [isLoading])
    const { columns } = useTerminalSize()

    const commandWidth = useMemo(
      () => Math.max(...commands.map((cmd) => cmd.userFacingName().length)) + 5,
      [commands],
    )

    const { suggestions, selectedSuggestion, updateSuggestions, clearSuggestions } =
      useCommandAutocomplete({
        commands,
        onInputChange,
        onSubmit,
        setCursorOffset,
      })

    const onChange = useCallback(
      (value: string) => {
        updateSuggestions(value)
        onInputChange(value)
      },
      [onInputChange, updateSuggestions],
    )

    const { resetHistory, onHistoryUp, onHistoryDown } = useArrowKeyHistory((value: string) => {
      onChange(value)
    }, input)

    // Only use history navigation when there are 0 or 1 slash command suggestions
    const handleHistoryUp = () => {
      if (suggestions.length <= 1) {
        onHistoryUp()
      }
    }

    const handleHistoryDown = () => {
      if (suggestions.length <= 1) {
        onHistoryDown()
      }
    }

    async function onSubmit(input: string, isSubmittingSlashCommand = false) {
      if (input === "") {
        return
      }
      if (isDisabled) {
        return
      }
      if (isLoading) {
        return
      }
      if (suggestions.length > 0 && !isSubmittingSlashCommand) {
        return
      }

      // Handle exit commands
      if (["exit", "quit", ":q", ":q!", ":wq", ":wq!"].includes(input.trim())) {
        exit()
      }

      let finalInput = input
      if (pastedText) {
        const pastedPrompt = getPastedTextPrompt(pastedText)
        if (finalInput.includes(pastedPrompt)) {
          finalInput = finalInput.replace(pastedPrompt, pastedText)
        }
      }
      import.meta.env.MODE !== "test" &&
        (await messageStorage.setItem("/history", [
          ...((await messageStorage.getItem<string[]>("/history")) || []),
          input,
        ]))
      onInputChange("")
      clearSuggestions()
      setPastedText(null)

      if (finalInput.startsWith("/")) {
        const commandParts = finalInput.slice(1).trim().split(/\s+/)
        const commandName = commandParts[0]
        const args = commandParts.slice(1)
        const command = commands.find((cmd) => cmd.userFacingName() === commandName)
        
        if (command?.name === "sync") {
          index.mutate({})
          return
        }
        if (command?.name === "clear") {
          await messageStorage.del("/messages")
          await messageStorage.del("/tools")
          setMessages([])
          return
        }
        if (command?.name === "help") {
          // Enhanced help will be shown via AI response
          onInputChange("")
          setMessages([
            ...messages,
            {
              id: `help-${Date.now()}`,
              role: "user",
              content: "Show me help for Codexa AI, including crypto development commands and examples",
            },
          ])
          onChatSubmit()
          return
        }
        if (command?.name === "gas") {
          // Show gas prices via AI response
          onInputChange("")
          setMessages([
            ...messages,
            {
              id: `gas-${Date.now()}`,
              role: "user",
              content: "What are the current Ethereum gas prices? Show me current gas prices for mainnet.",
            },
          ])
          onChatSubmit()
          return
        }
        if (command?.name === "network") {
          // Show network config via AI response
          onInputChange("")
          setMessages([
            ...messages,
            {
              id: `network-${Date.now()}`,
              role: "user",
              content: "Show me the current network configuration and RPC endpoints being used",
            },
          ])
          onChatSubmit()
          return
        }
        if (command?.name === "balance") {
          if (args.length === 0) {
            onInputChange("")
            setMessages([
              ...messages,
              {
                id: `balance-help-${Date.now()}`,
                role: "user",
                content: "How do I check a balance? Show me examples for checking Ethereum and Solana balances",
              },
            ])
            onChatSubmit()
            return
          }
          const address = args[0]
          const network = args[1] || "mainnet"
          // Determine if Ethereum or Solana address and call appropriate tool
          onInputChange("")
          const isEthereum = /^0x[a-fA-F0-9]{40}$/.test(address)
          const isSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
          
          if (isEthereum) {
            setMessages([
              ...messages,
              {
                id: `balance-${Date.now()}`,
                role: "user",
                content: `Check the balance of Ethereum address ${address} on ${network}. Use the read-contract-state tool if needed.`,
              },
            ])
          } else if (isSolana) {
            setMessages([
              ...messages,
              {
                id: `balance-${Date.now()}`,
                role: "user",
                content: `Check the balance of Solana account ${address} on ${network}. Use the read-program-account tool.`,
              },
            ])
          } else {
            setMessages([
              ...messages,
              {
                id: `balance-error-${Date.now()}`,
                role: "user",
                content: `Invalid address format: ${address}. Please provide a valid Ethereum (0x...) or Solana (Base58) address.`,
              },
            ])
          }
          onChatSubmit()
          return
        }
        if (command?.name === "verify") {
          if (args.length === 0) {
            onInputChange("")
            setMessages([
              ...messages,
              {
                id: `verify-help-${Date.now()}`,
                role: "user",
                content: "How do I check contract verification status? Show me examples.",
              },
            ])
            onChatSubmit()
            return
          }
          const address = args[0]
          const network = args[1] || "mainnet"
          onInputChange("")
          setMessages([
            ...messages,
            {
              id: `verify-${Date.now()}`,
              role: "user",
              content: `Check verification status for contract ${address} on ${network}. Provide the Etherscan/Solscan link and verification status.`,
            },
          ])
          onChatSubmit()
          return
        }
        if (command?.name === "explorer") {
          if (args.length === 0) {
            onInputChange("")
            setMessages([
              ...messages,
              {
                id: `explorer-help-${Date.now()}`,
                role: "user",
                content: "How do I generate explorer links? Show me examples for Ethereum and Solana.",
              },
            ])
            onChatSubmit()
            return
          }
          const value = args[0]
          const network = args[1] || "mainnet"
          onInputChange("")
          const isEthereum = /^0x[a-fA-F0-9]{40}$/.test(value)
          const isSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)
          const isTxHash = /^0x[a-fA-F0-9]{64}$/.test(value)
          
          if (isEthereum || isTxHash) {
            setMessages([
              ...messages,
              {
                id: `explorer-${Date.now()}`,
                role: "user",
                content: `Generate Etherscan explorer link for ${isTxHash ? "transaction" : "address"} ${value} on ${network}`,
              },
            ])
          } else if (isSolana) {
            setMessages([
              ...messages,
              {
                id: `explorer-${Date.now()}`,
                role: "user",
                content: `Generate Solscan explorer link for account ${value} on ${network}`,
              },
            ])
          } else {
            setMessages([
              ...messages,
              {
                id: `explorer-error-${Date.now()}`,
                role: "user",
                content: `Invalid format: ${value}. Please provide a valid Ethereum address/tx hash (0x...) or Solana address (Base58).`,
              },
            ])
          }
          onChatSubmit()
          return
        }
        // Unknown command - let it fall through to normal chat
      }

      onChatSubmit()
    }

    function onTextPaste(rawText: string) {
      const text = rawText.replace(/\r/g, "\n")
      const pastedPrompt = getPastedTextPrompt(text)

      const newInput = input.slice(0, cursorOffset) + pastedPrompt + input.slice(cursorOffset)
      onInputChange(newInput)

      setCursorOffset(cursorOffset + pastedPrompt.length)

      setPastedText(text)
    }

    const textInputColumns = useTerminalSize().columns - 6
    const theme = getTheme()

    return (
      <Box flexDirection="column">
        <Box
          alignItems="flex-start"
          justifyContent="flex-start"
          borderColor={isLoading ? "cyan" : theme.secondaryBorder}
          borderDimColor
          borderStyle="round"
          marginTop={1}
          width="100%"
          flexDirection="row"
        >
          <Box
            alignItems="center"
            alignSelf="flex-start"
            flexWrap="nowrap"
            justifyContent="center"
            width={3}
          >
            {isLoading ? (
              <Spinner label="" />
            ) : (
              <Text color={isLoading ? theme.secondaryText : undefined}>{">"}</Text>
            )}
          </Box>
          <Box paddingRight={1}>
            <TextInput
              multiline
              onSubmit={onSubmit}
              onChange={onChange}
              value={input}
              onHistoryUp={handleHistoryUp}
              onHistoryDown={handleHistoryDown}
              onHistoryReset={() => resetHistory()}
              placeholder={placeholder}
              onExit={() => process.exit(0)}
              onExitMessage={(show, key) => setExitMessage({ show, key })}
              onMessage={(show, text) => setMessage({ show, text })}
              columns={textInputColumns}
              isDimmed={isDisabled || isLoading}
              disableCursorMovementForUpDownKeys={suggestions.length > 0}
              cursorOffset={cursorOffset}
              onChangeCursorOffset={setCursorOffset}
              onPaste={onTextPaste}
            />
          </Box>
        </Box>
        {suggestions.length === 0 && (
          <Box flexDirection="row" justifyContent="space-between" paddingX={2} paddingY={0}>
            <Box justifyContent="flex-start" gap={1} flexDirection="row">
              {index.variables && (
                <Box>
                  <Text color={index.isError ? "red" : "gray"} dimColor>
                    {index.isPending
                      ? "Indexing..."
                      : index.isSuccess
                        ? "Indexing complete"
                        : "Indexing failed: " + index.error?.message}
                  </Text>
                </Box>
              )}
              {!index.variables &&
                (exitMessage.show ? (
                  <Text dimColor>Press {exitMessage.key} again to exit</Text>
                ) : message.show ? (
                  <Text dimColor>{message.text}</Text>
                ) : (
                  <>
                    <Text dimColor>/ for commands</Text>
                  </>
                ))}
            </Box>
            <Box justifyContent="flex-end" gap={1} flexDirection="row">
              {timer > 0 && (
                <Text dimColor>
                  {formatDurationMilliseconds(timer, {
                    style: "short",
                    maxDecimalPoints: 0,
                  })}{" "}
                  ·
                </Text>
              )}
              <Text dimColor>alt + ⏎ for newline</Text>
              <Text dimColor>
                ·
                {`${new Intl.NumberFormat("en", {
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(usage.totalTokens)} tokens`}
              </Text>
            </Box>
          </Box>
        )}
        {suggestions.length > 0 && (
          <Box flexDirection="row" justifyContent="space-between" paddingX={2} paddingY={0}>
            <Box flexDirection="column">
              {suggestions.map((suggestion, index) => {
                const command = commands.find(
                  (cmd) => cmd.userFacingName() === suggestion.replace("/", ""),
                )
                return (
                  <Box key={suggestion} flexDirection={columns < 80 ? "column" : "row"}>
                    <Box width={columns < 80 ? undefined : commandWidth}>
                      <Text
                        color={index === selectedSuggestion ? theme.suggestion : undefined}
                        dimColor={index !== selectedSuggestion}
                      >
                        /{suggestion}
                        {command?.aliases && command.aliases.length > 0 && (
                          <Text dimColor> ({command.aliases.join(", ")})</Text>
                        )}
                      </Text>
                    </Box>
                    {command && (
                      <Box
                        width={columns - (columns < 80 ? 4 : commandWidth + 4)}
                        paddingLeft={columns < 80 ? 4 : 0}
                      >
                        <Text
                          color={index === selectedSuggestion ? theme.suggestion : undefined}
                          dimColor={index !== selectedSuggestion}
                          wrap="wrap"
                        >
                          <Text dimColor={index !== selectedSuggestion}>
                            {command.description}
                            {command.type === "prompt" && command.argNames?.length
                              ? ` (arguments: ${command.argNames.join(", ")})`
                              : null}
                          </Text>
                        </Text>
                      </Box>
                    )}
                  </Box>
                )
              })}
            </Box>
          </Box>
        )}
        <Suspense fallback={null}>
          <AutoUpdater />
        </Suspense>
      </Box>
    )
  },
)

function exit(): never {
  // setTerminalTitle("")
  process.exit(0)
}
