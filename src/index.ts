#!/usr/bin/env node

import chalk from "chalk"
import { formatHex } from "culori"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { createRequire } from "module"
import { dirname, join, relative, resolve } from "path"
import { fileURLToPath } from "url"
import { parseArgs } from "util"

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Create require to resolve node_modules paths
const require = createRequire(import.meta.url)

// Type definitions
type BaseStyles = Record<
  string,
  string | number | Record<string, string | number>
>

type ThemeFunction = (config: {
  addBase: (base: BaseStyles) => void
  prefix?: string
}) => void

interface ThemeModule {
  default: ThemeFunction
}

interface ParsedArguments {
  themes: string[]
  output: string
  readCss: boolean
  cssPath: string
}

interface ThemeError {
  theme: string
  error: string
}

interface CssThemeData {
  name: string
  styles: BaseStyles
}

/**
 * Type guard to check if error is an Error instance
 */
const isError = (error: unknown): error is Error => {
  return error instanceof Error
}

/**
 * Type guard to check if error is a NodeJS.ErrnoException
 */
const isErrnoException = (error: unknown): error is NodeJS.ErrnoException => {
  return isError(error) && "code" in error
}

/**
 * Get error message from unknown error type
 */
const getErrorMessage = (error: unknown): string => {
  if (isError(error)) {
    return error.message
  }
  return String(error)
}

/**
 * Convert absolute path to relative path for cleaner logging
 */
const getRelativePath = (absolutePath: string): string => {
  try {
    const relativePath = relative(process.cwd(), absolutePath)
    // If the relative path starts with '../', it means the file is outside the cwd
    // In that case, return the original path
    return relativePath.startsWith("../") ? absolutePath : relativePath
  } catch {
    return absolutePath
  }
}

/**
 * Parse command line arguments
 */
const parseArguments = (): ParsedArguments => {
  try {
    const options = {
      themes: {
        type: "string" as const,
        short: "t",
        default: "",
      },
      output: {
        type: "string" as const,
        short: "o",
        default: "./themes.json",
      },
      "read-css": {
        type: "boolean" as const,
        default: false,
      },
      "css-path": {
        type: "string" as const,
        default: "src/index.css",
      },
      help: {
        type: "boolean" as const,
        short: "h",
        default: false,
      },
    }

    const { values, positionals } = parseArgs({
      args: process.argv.slice(2),
      options,
      allowPositionals: true,
    })

    if (values.help) {
      console.log(`
DaisyUI Theme Extractor

Usage: extract-daisyui-themes [options]

Options:
  -t, --themes <themes>   Comma-separated list of theme names (required if not using --read-css)
  -o, --output <path>     Output JSON file path (default: ./themes.json)
  --read-css              Read themes from CSS file (default: false)
  --css-path <path>       Path to CSS file (default: src/index.css)
  -h, --help             Show this help message

Extracts DaisyUI themes and converts OKLCH colors to hex format.
Property names are cleaned (removes -- and color- prefixes).

Examples:
  extract-daisyui-themes -t forest,dark,light -o ./output/themes.json
  extract-daisyui-themes --themes="cupcake,bumblebee" --output="./themes.json"
  extract-daisyui-themes --read-css --css-path="./src/styles.css"
  extract-daisyui-themes --read-css -t additional,themes
      `)
      process.exit(0)
    }

    const readCss = values["read-css"] as boolean
    const cssPath = resolve(values["css-path"] as string)

    // Use themes from flag or first positional argument
    const themesInput: string =
      (values.themes as string) || positionals[0] || ""
    const themes: string[] = themesInput
      .split(",")
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0)

    if (!readCss && themes.length === 0) {
      console.error(
        chalk.red("Error: No themes specified and --read-css not enabled.")
      )
      console.error(
        chalk.yellow("Use -t or --themes flag, or enable --read-css.")
      )
      console.error(chalk.dim("Run with --help for usage information."))
      process.exit(1)
    }

    return {
      themes,
      output: resolve(values.output as string),
      readCss,
      cssPath,
    }
  } catch (error: unknown) {
    console.error(chalk.red("Error parsing arguments:"), getErrorMessage(error))
    process.exit(1)
  }
}

/**
 * Convert any color format to Hex using culori
 */
const convertToHex = (colorString: string): string => {
  try {
    const hex = formatHex(colorString)
    return hex || colorString
  } catch {
    return colorString
  }
}

/**
 * Convert CSS variables to Hex and clean property names
 */
const convertStyles = (styles: BaseStyles): BaseStyles => {
  const converted: BaseStyles = {}

  for (const [key, value] of Object.entries(styles)) {
    // Clean up the property name
    let cleanKey = key
    // Remove --color- prefix
    if (cleanKey.startsWith("--color-")) {
      cleanKey = cleanKey.replace("--color-", "")
    }
    // Remove remaining -- prefix
    else if (cleanKey.startsWith("--")) {
      cleanKey = cleanKey.replace("--", "")
    }

    // Convert colors to hex (handles oklch, rgb, hsl, etc.)
    if (
      typeof value === "string" &&
      (value.includes("oklch(") ||
        value.includes("rgb(") ||
        value.includes("hsl(") ||
        value.includes("lch("))
    ) {
      converted[cleanKey] = convertToHex(value)
    } else {
      converted[cleanKey] = value
    }
  }

  return converted
}

/**
 * Parse CSS file to extract theme names from @plugin "daisyui" blocks
 */
const extractThemeNamesFromCss = (cssContent: string): string[] => {
  const themeNames: string[] = []

  // Match @plugin "daisyui" { themes: ... };
  const pluginRegex = /@plugin\s+["']daisyui["']\s*\{[^}]*themes:\s*([^;]+);/gs

  let match
  while ((match = pluginRegex.exec(cssContent)) !== null) {
    const themesString = match[1]
    // Split by comma and extract theme names, ignoring --flags
    const themes = themesString
      .split(",")
      .map((t) => {
        // Remove whitespace and everything after --
        const cleaned = t.trim().split(/\s+--/)[0].trim()
        return cleaned
      })
      .filter((t) => t.length > 0)

    themeNames.push(...themes)
  }

  return [...new Set(themeNames)] // Remove duplicates
}

/**
 * Parse CSS file to extract inline theme definitions from @plugin "daisyui/theme" blocks
 */
const extractInlineThemesFromCss = (cssContent: string): CssThemeData[] => {
  const themes: CssThemeData[] = []

  // Match @plugin "daisyui/theme" { ... }
  // Use [\s\S]*? for non-greedy match of any character including newlines
  const pluginRegex = /@plugin\s+["']daisyui\/theme["']\s*\{([\s\S]*?)\}/g

  let match
  while ((match = pluginRegex.exec(cssContent)) !== null) {
    const blockContent = match[1]
    const styles: BaseStyles = {}
    let themeName = ""

    // Parse each line in the block
    const lines = blockContent.split("\n")
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*"))
        continue

      // Match property: value; pattern (semicolon optional)
      const propMatch = trimmed.match(/^([^:]+):\s*([^;]+);?\s*$/)
      if (propMatch) {
        const [, key, value] = propMatch
        const cleanKey = key.trim()
        const cleanValue = value.trim()

        // Extract theme name
        if (cleanKey === "name") {
          themeName = cleanValue
        } else if (cleanKey.startsWith("--")) {
          // Store CSS variables
          styles[cleanKey] = cleanValue
        } else if (cleanKey === "color-scheme") {
          styles["color-scheme"] = cleanValue
        }
        // Skip other properties like default, prefersdark
      }
    }

    if (themeName && Object.keys(styles).length > 0) {
      themes.push({
        name: themeName,
        styles: convertStyles(styles),
      })
    }
  }

  return themes
}

/**
 * Read and parse CSS file
 */
const readCssFile = (
  cssPath: string
): { themeNames: string[]; inlineThemes: CssThemeData[] } => {
  if (!existsSync(cssPath)) {
    throw new Error(`CSS file not found: ${cssPath}`)
  }

  const cssContent = readFileSync(cssPath, "utf8")
  const themeNames = extractThemeNamesFromCss(cssContent)
  const inlineThemes = extractInlineThemesFromCss(cssContent)

  return { themeNames, inlineThemes }
}

/**
 * Import and extract theme data from DaisyUI
 */
const extractThemeData = async (themeName: string): Promise<BaseStyles> => {
  // Build a list of all possible paths to check
  const allPossiblePaths: string[] = []

  // Strategy 1: Direct paths from current working directory
  const cwdPaths = [
    join(
      process.cwd(),
      "node_modules",
      "daisyui",
      "theme",
      themeName,
      "index.js"
    ),
    join(
      process.cwd(),
      "node_modules",
      "daisyui",
      "dist",
      "theme",
      themeName,
      "index.js"
    ),
    join(
      process.cwd(),
      "node_modules",
      "daisyui",
      "src",
      "theming",
      "themes",
      `${themeName}.js`
    ),
    join(
      process.cwd(),
      "node_modules",
      "daisyui",
      "dist",
      "themes",
      `${themeName}.js`
    ),
  ]
  allPossiblePaths.push(...cwdPaths)

  // Strategy 2: Check parent directory (in case we're in a subdirectory)
  const parentPaths = [
    join(
      process.cwd(),
      "..",
      "node_modules",
      "daisyui",
      "theme",
      themeName,
      "index.js"
    ),
    join(
      process.cwd(),
      "..",
      "node_modules",
      "daisyui",
      "dist",
      "theme",
      themeName,
      "index.js"
    ),
  ]
  allPossiblePaths.push(...parentPaths)

  // Strategy 3: Try to resolve using require from cwd
  try {
    const cwdRequire = createRequire(join(process.cwd(), "package.json"))
    const daisyuiPath = dirname(cwdRequire.resolve("daisyui/package.json"))
    allPossiblePaths.push(
      join(daisyuiPath, "theme", themeName, "index.js"),
      join(daisyuiPath, "dist", "theme", themeName, "index.js"),
      join(daisyuiPath, "src", "theming", "themes", `${themeName}.js`),
      join(daisyuiPath, "dist", "themes", `${themeName}.js`)
    )
  } catch {}

  // Strategy 4: Try to resolve from script location
  try {
    const scriptDaisyuiPath = dirname(require.resolve("daisyui/package.json"))
    allPossiblePaths.push(
      join(scriptDaisyuiPath, "theme", themeName, "index.js"),
      join(scriptDaisyuiPath, "dist", "theme", themeName, "index.js"),
      join(scriptDaisyuiPath, "src", "theming", "themes", `${themeName}.js`),
      join(scriptDaisyuiPath, "dist", "themes", `${themeName}.js`)
    )
  } catch {}

  // Remove duplicates and check which paths exist
  const uniquePaths = [...new Set(allPossiblePaths)]
  const existingPaths = uniquePaths.filter((p) => existsSync(p))

  // Try each path
  for (const themePath of existingPaths) {
    try {
      // Use file:// protocol for absolute path imports
      const themeModule: ThemeModule = (await import(
        `file://${themePath}`
      )) as ThemeModule
      const theme: ThemeFunction = themeModule.default

      if (typeof theme !== "function") {
        continue
      }

      // Extract base styles by calling the theme function
      let extractedStyles: BaseStyles = {}

      theme({
        addBase: (base: BaseStyles): void => {
          extractedStyles = { ...extractedStyles, ...base }
        },
      })

      // Convert colors to Hex and clean keys
      const convertedStyles: BaseStyles = convertStyles(extractedStyles)

      console.log(chalk.green(`✓ Extracted theme: ${chalk.bold(themeName)}`))
      return convertedStyles
    } catch (error: unknown) {
      // Try next path
      continue
    }
  }

  throw new Error(
    `Could not import theme '${themeName}' from any known path in node_modules`
  )
}

/**
 * Main function
 */
const main = async (): Promise<void> => {
  const { themes, output, readCss, cssPath }: ParsedArguments = parseArguments()

  const result: Record<string, BaseStyles> = {}
  const errors: ThemeError[] = []
  let allThemes: string[] = [...themes]
  const inlineThemeMap = new Map<string, BaseStyles>()

  // Read CSS file if enabled
  if (readCss) {
    try {
      console.log(
        chalk.cyan(
          `📄 Reading CSS file: ${chalk.bold(getRelativePath(cssPath))}`
        )
      )
      const { themeNames, inlineThemes } = readCssFile(cssPath)

      if (themeNames.length > 0) {
        console.log(
          chalk.blue(
            `   Found ${chalk.bold(
              themeNames.length
            )} theme name(s): ${chalk.magenta(themeNames.join(", "))}`
          )
        )
        allThemes = [...new Set([...allThemes, ...themeNames])]
      }

      if (inlineThemes.length > 0) {
        console.log(
          chalk.blue(
            `   Found ${chalk.bold(
              inlineThemes.length
            )} inline theme(s): ${chalk.magenta(
              inlineThemes.map((t) => t.name).join(", ")
            )}`
          )
        )
        const inlineThemeNames = inlineThemes.map((t) => t.name)
        allThemes = [...new Set([...allThemes, ...inlineThemeNames])]
        inlineThemes.forEach((theme) => {
          inlineThemeMap.set(theme.name, theme.styles)
        })
      }

      console.log("")
    } catch (error: unknown) {
      console.error(
        chalk.red(`Error reading CSS file: ${getErrorMessage(error)}`)
      )
      process.exit(1)
    }
  }

  console.log(
    chalk.cyan(
      `🎨 Extracting ${chalk.bold(allThemes.length)} theme(s): ${chalk.magenta(
        allThemes.join(", ")
      )}`
    )
  )
  console.log(
    chalk.cyan(`📦 Output file: ${chalk.bold(getRelativePath(output))}`)
  )
  console.log("")

  // Process each theme
  for (const theme of allThemes) {
    try {
      // Check if we have inline theme data first
      if (inlineThemeMap.has(theme)) {
        result[theme] = inlineThemeMap.get(theme)!
        console.log(
          chalk.green(`✓ Using inline CSS theme: ${chalk.bold(theme)}`)
        )
      } else {
        const themeData: BaseStyles = await extractThemeData(theme)
        result[theme] = themeData
      }
    } catch (error: unknown) {
      errors.push({ theme, error: getErrorMessage(error) })
      console.error(
        chalk.red(
          `✗ Skipping theme '${chalk.bold(theme)}': ${getErrorMessage(error)}`
        )
      )
    }
  }

  // Create output directory if it doesn't exist
  try {
    mkdirSync(dirname(output), { recursive: true })
  } catch (error: unknown) {
    if (isErrnoException(error) && error.code !== "EEXIST") {
      console.error(
        chalk.red("Error creating output directory:"),
        getErrorMessage(error)
      )
      process.exit(1)
    }
  }

  // Write results to file
  try {
    writeFileSync(output, JSON.stringify(result, null, 2), "utf8")
    console.log("")
    console.log(
      chalk.green.bold(
        `✨ Successfully wrote ${chalk.yellow(
          Object.keys(result).length
        )} theme(s) to ${chalk.cyan(getRelativePath(output))}`
      )
    )

    // Show theme statistics
    if (Object.keys(result).length > 0) {
      console.log("")
      console.log(chalk.cyan.bold("📊 Theme Statistics:"))
      Object.entries(result).forEach(([name, styles]) => {
        const propCount = Object.keys(styles).length
        console.log(
          chalk.dim(
            `   ${chalk.magenta(name)}: ${chalk.yellow(propCount)} properties`
          )
        )
      })
    }

    if (errors.length > 0) {
      console.log("")
      console.log(
        chalk.yellow.bold(`⚠️  Errors encountered (${errors.length}):`)
      )
      errors.forEach(({ theme, error }: ThemeError): void => {
        console.log(chalk.red(`  • ${chalk.bold(theme)}: ${chalk.dim(error)}`))
      })
    }
  } catch (error: unknown) {
    console.error(
      chalk.red("Error writing output file:"),
      getErrorMessage(error)
    )
    process.exit(1)
  }
}

// Run the CLI
main().catch((error: unknown): void => {
  console.error(chalk.red.bold("Unexpected error:"), getErrorMessage(error))
  process.exit(1)
})
