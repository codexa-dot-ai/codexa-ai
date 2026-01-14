import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import chalk from "chalk"
import { env } from "@/lib/env.js"
import $ from "dax-sh"
import dedent from "dedent"
import { detect } from "package-manager-detector/detect"
import boxen from "boxen"

export function ensureGitIgnore() {
  const gitignorePath = join(env.cwd, ".gitignore")
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, ".coder\n")
    return
  }
  const content = readFileSync(gitignorePath, "utf8")
  if (!content.includes(".coder")) {
    appendFileSync(gitignorePath, ".coder\n")
  }
}

export async function initConfig() {
  const isTypescript = await $.confirm("Do you want to use TypeScript? (config.config.ts)", {
    default: false,
  })
  const file = isTypescript ? "config.config.ts" : "config.config.js"
  const coderConfig = join(env.cwd, file)
  if (existsSync(coderConfig)) {
    return
  }
  if (isTypescript) {
    const pm = await detect({ cwd: env.cwd })
    if (!pm) {
      throw new Error("No package manager detected")
    }
    if (pm?.name === "npm") {
      await $`npm install opencoder@latest`.printCommand().text()
    }
    if (pm?.name === "yarn") {
      await $`yarn add opencoder@latest`.printCommand().text()
    }
    if (pm?.name === "pnpm") {
      await $`pnpm add opencoder@latest`.printCommand().text()
    }
    if (pm?.name === "bun") {
      await $`bun add opencoder@latest`.printCommand().text()
    }
    writeFileSync(
      coderConfig,
      dedent`
    import { openai, type Config } from "opencoder"

    export const config = {
      // add your custom model simple like this
      // model: openai("gpt-4o")
    } satisfies Config
    `,
    )
  } else {
    writeFileSync(
      coderConfig,
      dedent`
      export default {
        // add your custom model simple like this
        // model: openai("gpt-4o")
      }
      `,
    )
  }
  console.log(
    boxen(`Coder config file created at ${chalk.magenta(join(env.cwd, file))}`, {
      padding: 1,
      borderColor: "magenta",
      borderStyle: "round",
    }),
  )
}
