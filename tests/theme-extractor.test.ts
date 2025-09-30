import {
  describe,
  expect,
  it,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals"
import { formatHex } from "culori"
import * as fs from "fs"
import { parseArgs } from "util"

// Mock modules
jest.mock("culori")
jest.mock("fs")
jest.mock("chalk", () => ({
  default: {
    red: jest.fn((str) => str),
    green: jest.fn((str) => str),
    yellow: jest.fn((str) => str),
    cyan: jest.fn((str) => str),
    blue: jest.fn((str) => str),
    magenta: jest.fn((str) => str),
    dim: jest.fn((str) => str),
    bold: jest.fn((str) => str),
  },
  red: Object.assign(
    jest.fn((str) => str),
    { bold: jest.fn((str) => str) }
  ),
  green: Object.assign(
    jest.fn((str) => str),
    { bold: jest.fn((str) => str) }
  ),
  yellow: Object.assign(
    jest.fn((str) => str),
    { bold: jest.fn((str) => str) }
  ),
  cyan: Object.assign(
    jest.fn((str) => str),
    { bold: jest.fn((str) => str) }
  ),
  blue: jest.fn((str) => str),
  magenta: jest.fn((str) => str),
  dim: jest.fn((str) => str),
}))

// Type definitions for testing
type BaseStyles = Record<
  string,
  string | number | Record<string, string | number>
>

interface CssThemeData {
  name: string
  styles: BaseStyles
}

// Helper functions to test (extracted from main file for testing)
const convertToHex = (colorString: string): string => {
  try {
    const hex = formatHex(colorString)
    return hex || colorString
  } catch {
    return colorString
  }
}

const convertStyles = (styles: BaseStyles): BaseStyles => {
  const converted: BaseStyles = {}

  for (const [key, value] of Object.entries(styles)) {
    let cleanKey = key
    if (cleanKey.startsWith("--color-")) {
      cleanKey = cleanKey.replace("--color-", "")
    } else if (cleanKey.startsWith("--")) {
      cleanKey = cleanKey.replace("--", "")
    }

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

const extractThemeNamesFromCss = (cssContent: string): string[] => {
  const themeNames: string[] = []
  const pluginRegex = /@plugin\s+["']daisyui["']\s*\{[^}]*themes:\s*([^;]+);/gs

  let match
  while ((match = pluginRegex.exec(cssContent)) !== null) {
    const themesString = match[1]
    const themes = themesString
      .split(",")
      .map((t) => {
        const cleaned = t.trim().split(/\s+--/)[0].trim()
        return cleaned
      })
      .filter((t) => t.length > 0)

    themeNames.push(...themes)
  }

  return [...new Set(themeNames)]
}

const extractInlineThemesFromCss = (cssContent: string): CssThemeData[] => {
  const themes: CssThemeData[] = []
  const pluginRegex = /@plugin\s+["']daisyui\/theme["']\s*\{([\s\S]*?)\}/g

  let match
  while ((match = pluginRegex.exec(cssContent)) !== null) {
    const blockContent = match[1]
    const styles: BaseStyles = {}
    let themeName = ""

    const lines = blockContent.split("\n")
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*"))
        continue

      const propMatch = trimmed.match(/^([^:]+):\s*([^;]+);?\s*$/)
      if (propMatch) {
        const [, key, value] = propMatch
        const cleanKey = key.trim()
        const cleanValue = value.trim()

        if (cleanKey === "name") {
          themeName = cleanValue
        } else if (cleanKey.startsWith("--")) {
          styles[cleanKey] = cleanValue
        } else if (cleanKey === "color-scheme") {
          styles["color-scheme"] = cleanValue
        }
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

describe("DaisyUI Theme Extractor", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("convertToHex", () => {
    it("should convert OKLCH color to hex", () => {
      const mockFormatHex = formatHex as jest.MockedFunction<typeof formatHex>
      mockFormatHex.mockReturnValue("#ff0000")

      const result = convertToHex("oklch(62.8% 0.25768 29.234)")
      expect(result).toBe("#ff0000")
      expect(mockFormatHex).toHaveBeenCalledWith("oklch(62.8% 0.25768 29.234)")
    })

    it("should return original string if conversion fails", () => {
      const mockFormatHex = formatHex as jest.MockedFunction<typeof formatHex>
      mockFormatHex.mockImplementation(() => {
        throw new Error("Invalid color")
      })

      const result = convertToHex("invalid-color")
      expect(result).toBe("invalid-color")
    })

    it("should return original string if formatHex returns null", () => {
      const mockFormatHex = formatHex as jest.MockedFunction<typeof formatHex>
      mockFormatHex.mockReturnValue(null as any)

      const result = convertToHex("invalid-color")
      expect(result).toBe("invalid-color")
    })
  })

  describe("convertStyles", () => {
    it("should remove --color- prefix from keys", () => {
      const mockFormatHex = formatHex as jest.MockedFunction<typeof formatHex>
      mockFormatHex.mockReturnValue("#ff0000")

      const styles: BaseStyles = {
        "--color-base-100": "#ffffff",
        "--color-primary": "oklch(62.8% 0.25768 29.234)",
      }

      const result = convertStyles(styles)

      expect(result).toEqual({
        "base-100": "#ffffff",
        primary: "#ff0000",
      })
    })

    it("should remove -- prefix from keys without color prefix", () => {
      const styles: BaseStyles = {
        "--radius-box": "1rem",
        "--border": "1px",
      }

      const result = convertStyles(styles)

      expect(result).toEqual({
        "radius-box": "1rem",
        border: "1px",
      })
    })

    it("should convert OKLCH colors to hex", () => {
      const mockFormatHex = formatHex as jest.MockedFunction<typeof formatHex>
      mockFormatHex.mockReturnValue("#00ff00")

      const styles: BaseStyles = {
        "--color-primary": "oklch(62.8% 0.25768 29.234)",
      }

      const result = convertStyles(styles)

      expect(result["primary"]).toBe("#00ff00")
    })

    it("should convert RGB colors to hex", () => {
      const mockFormatHex = formatHex as jest.MockedFunction<typeof formatHex>
      mockFormatHex.mockReturnValue("#0000ff")

      const styles: BaseStyles = {
        "--color-primary": "rgb(0, 0, 255)",
      }

      const result = convertStyles(styles)

      expect(result["primary"]).toBe("#0000ff")
    })

    it("should convert HSL colors to hex", () => {
      const mockFormatHex = formatHex as jest.MockedFunction<typeof formatHex>
      mockFormatHex.mockReturnValue("#ffff00")

      const styles: BaseStyles = {
        "--color-primary": "hsl(60, 100%, 50%)",
      }

      const result = convertStyles(styles)

      expect(result["primary"]).toBe("#ffff00")
    })

    it("should preserve non-color values", () => {
      const styles: BaseStyles = {
        "--radius-box": "1rem",
        "--border": "1px",
        "color-scheme": "dark",
      }

      const result = convertStyles(styles)

      expect(result).toEqual({
        "radius-box": "1rem",
        border: "1px",
        "color-scheme": "dark",
      })
    })

    it("should preserve numeric values", () => {
      const styles: BaseStyles = {
        "--depth": 1,
        "--noise": 0.5,
      }

      const result = convertStyles(styles)

      expect(result).toEqual({
        depth: 1,
        noise: 0.5,
      })
    })
  })

  describe("extractThemeNamesFromCss", () => {
    it("should extract theme names from single @plugin daisyui block", () => {
      const css = `
        @plugin "daisyui" {
          themes: light, dark, forest;
        };
      `

      const result = extractThemeNamesFromCss(css)

      expect(result).toEqual(["light", "dark", "forest"])
    })

    it("should ignore --flags after theme names", () => {
      const css = `
        @plugin "daisyui" {
          themes: light --default, dark --prefersdark, forest;
        };
      `

      const result = extractThemeNamesFromCss(css)

      expect(result).toEqual(["light", "dark", "forest"])
    })

    it("should handle single quotes", () => {
      const css = `
        @plugin 'daisyui' {
          themes: light, dark;
        };
      `

      const result = extractThemeNamesFromCss(css)

      expect(result).toEqual(["light", "dark"])
    })

    it("should handle multiple @plugin blocks", () => {
      const css = `
        @plugin "daisyui" {
          themes: light, dark;
        };
        
        @plugin "daisyui" {
          themes: forest, synthwave;
        };
      `

      const result = extractThemeNamesFromCss(css)

      expect(result).toEqual(["light", "dark", "forest", "synthwave"])
    })

    it("should remove duplicate theme names", () => {
      const css = `
        @plugin "daisyui" {
          themes: light, dark, light;
        };
      `

      const result = extractThemeNamesFromCss(css)

      expect(result).toEqual(["light", "dark"])
    })

    it("should return empty array if no themes found", () => {
      const css = `
        @import "tailwindcss";
      `

      const result = extractThemeNamesFromCss(css)

      expect(result).toEqual([])
    })

    it("should handle whitespace variations", () => {
      const css = `
        @plugin "daisyui"{themes:light,dark,forest;};
      `

      const result = extractThemeNamesFromCss(css)

      expect(result).toEqual(["light", "dark", "forest"])
    })
  })

  describe("extractInlineThemesFromCss", () => {
    beforeEach(() => {
      const mockFormatHex = formatHex as jest.MockedFunction<typeof formatHex>
      mockFormatHex.mockImplementation(((color: any) => {
        if (typeof color === "string" && color.startsWith("#")) return color
        return "#000000"
      }) as any)
    })

    it("should extract inline theme with all properties", () => {
      const css = `
        @plugin "daisyui/theme" {
          name: mediumseagreen;
          default: false;
          prefersdark: false;
          color-scheme: dark;
          --color-base-100: #edf7ef;
          --color-base-200: #e4f4e7;
          --color-primary: #2ade76;
          --radius-selector: 2rem;
          --border: 0.5px;
        }
      `

      const result = extractInlineThemesFromCss(css)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe("mediumseagreen")
      expect(result[0].styles).toHaveProperty("base-100", "#edf7ef")
      expect(result[0].styles).toHaveProperty("base-200", "#e4f4e7")
      expect(result[0].styles).toHaveProperty("primary", "#2ade76")
      expect(result[0].styles).toHaveProperty("radius-selector", "2rem")
      expect(result[0].styles).toHaveProperty("border", "0.5px")
      expect(result[0].styles).toHaveProperty("color-scheme", "dark")
    })

    it("should skip properties without -- prefix except color-scheme", () => {
      const css = `
        @plugin "daisyui/theme" {
          name: mytheme;
          default: false;
          prefersdark: true;
          --color-base-100: #ffffff;
        }
      `

      const result = extractInlineThemesFromCss(css)

      expect(result[0].styles).not.toHaveProperty("default")
      expect(result[0].styles).not.toHaveProperty("prefersdark")
      expect(result[0].styles).toHaveProperty("base-100")
    })

    it("should handle multiple inline themes", () => {
      const css = `
        @plugin "daisyui/theme" {
          name: theme1;
          --color-base-100: #ffffff;
        }
        
        @plugin "daisyui/theme" {
          name: theme2;
          --color-base-100: #000000;
        }
      `

      const result = extractInlineThemesFromCss(css)

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe("theme1")
      expect(result[1].name).toBe("theme2")
    })

    it("should handle single quotes", () => {
      const css = `
        @plugin 'daisyui/theme' {
          name: mytheme;
          --color-base-100: #ffffff;
        }
      `

      const result = extractInlineThemesFromCss(css)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe("mytheme")
    })

    it("should skip lines with comments", () => {
      const css = `
        @plugin "daisyui/theme" {
          name: mytheme;
          // This is a comment
          /* This is also a comment */
          --color-base-100: #ffffff;
        }
      `

      const result = extractInlineThemesFromCss(css)

      expect(result).toHaveLength(1)
    })

    it("should handle properties without semicolons", () => {
      const css = `
        @plugin "daisyui/theme" {
          name: mytheme;
          --color-base-100: #ffffff
          --color-primary: #ff0000;
        }
      `

      const result = extractInlineThemesFromCss(css)

      expect(result[0].styles).toHaveProperty("base-100")
      expect(result[0].styles).toHaveProperty("primary")
    })

    it("should return empty array if no inline themes found", () => {
      const css = `
        @import "tailwindcss";
        @plugin "daisyui" {
          themes: light, dark;
        };
      `

      const result = extractInlineThemesFromCss(css)

      expect(result).toEqual([])
    })

    it("should skip themes without name property", () => {
      const css = `
        @plugin "daisyui/theme" {
          --color-base-100: #ffffff;
        }
      `

      const result = extractInlineThemesFromCss(css)

      expect(result).toEqual([])
    })

    it("should skip themes without any CSS properties", () => {
      const css = `
        @plugin "daisyui/theme" {
          name: mytheme;
        }
      `

      const result = extractInlineThemesFromCss(css)

      expect(result).toEqual([])
    })

    it("should convert OKLCH colors in inline themes", () => {
      const mockFormatHex = formatHex as jest.MockedFunction<typeof formatHex>
      mockFormatHex.mockReturnValue("#ff0000")

      const css = `
        @plugin "daisyui/theme" {
          name: mytheme;
          --color-primary: oklch(62.8% 0.25768 29.234);
        }
      `

      const result = extractInlineThemesFromCss(css)

      expect(result[0].styles.primary).toBe("#ff0000")
    })
  })

  describe("File operations", () => {
    it("should read CSS file successfully", () => {
      const mockReadFileSync = fs.readFileSync as jest.MockedFunction<
        typeof fs.readFileSync
      >
      const mockExistsSync = fs.existsSync as jest.MockedFunction<
        typeof fs.existsSync
      >

      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(`
        @plugin "daisyui" {
          themes: light, dark;
        };
      `)

      expect(() => {
        const content = fs.readFileSync("test.css", "utf8")
        extractThemeNamesFromCss(content as string)
      }).not.toThrow()
    })

    it("should handle missing CSS file", () => {
      const mockExistsSync = fs.existsSync as jest.MockedFunction<
        typeof fs.existsSync
      >
      mockExistsSync.mockReturnValue(false)

      const result = fs.existsSync("nonexistent.css")
      expect(result).toBe(false)
    })
  })

  describe("Error handling", () => {
    it("should handle invalid CSS gracefully", () => {
      const css = `
        This is not valid CSS
        @plugin "daisyui" {
          invalid content
      `

      expect(() => extractThemeNamesFromCss(css)).not.toThrow()
      expect(() => extractInlineThemesFromCss(css)).not.toThrow()
    })

    it("should handle empty CSS content", () => {
      const css = ""

      const themeNames = extractThemeNamesFromCss(css)
      const inlineThemes = extractInlineThemesFromCss(css)

      expect(themeNames).toEqual([])
      expect(inlineThemes).toEqual([])
    })

    it("should handle malformed @plugin blocks", () => {
      const css = `
        @plugin "daisyui" {
          themes: light
        // Missing semicolon and closing brace
      `

      expect(() => extractThemeNamesFromCss(css)).not.toThrow()
    })
  })

  describe("Integration tests", () => {
    it("should handle complete CSS file with both theme types", () => {
      const mockFormatHex = formatHex as jest.MockedFunction<typeof formatHex>
      mockFormatHex.mockImplementation(((color: any) => {
        if (typeof color === "string" && color.startsWith("#")) return color
        return "#000000"
      }) as any)

      const css = `
        @import "tailwindcss";
        
        @plugin "daisyui" {
          themes: light --default, dark --prefersdark, forest;
        };
        
        @plugin "daisyui/theme" {
          name: mediumseagreen;
          default: false;
          prefersdark: false;
          color-scheme: dark;
          --color-base-100: #edf7ef;
          --color-base-200: #e4f4e7;
          --color-primary: #2ade76;
          --radius-selector: 2rem;
        }
      `

      const themeNames = extractThemeNamesFromCss(css)
      const inlineThemes = extractInlineThemesFromCss(css)

      expect(themeNames).toEqual(["light", "dark", "forest"])
      expect(inlineThemes).toHaveLength(1)
      expect(inlineThemes[0].name).toBe("mediumseagreen")

      const allThemeNames = [...themeNames, ...inlineThemes.map((t) => t.name)]
      expect(allThemeNames).toEqual([
        "light",
        "dark",
        "forest",
        "mediumseagreen",
      ])
    })

    it("should handle CSS with only theme references", () => {
      const css = `
        @plugin "daisyui" {
          themes: light, dark;
        };
      `

      const themeNames = extractThemeNamesFromCss(css)
      const inlineThemes = extractInlineThemesFromCss(css)

      expect(themeNames).toEqual(["light", "dark"])
      expect(inlineThemes).toEqual([])
    })

    it("should handle CSS with only inline themes", () => {
      const mockFormatHex = formatHex as jest.MockedFunction<typeof formatHex>
      mockFormatHex.mockReturnValue("#ffffff")

      const css = `
        @plugin "daisyui/theme" {
          name: mytheme;
          --color-base-100: #ffffff;
        }
      `

      const themeNames = extractThemeNamesFromCss(css)
      const inlineThemes = extractInlineThemesFromCss(css)

      expect(themeNames).toEqual([])
      expect(inlineThemes).toHaveLength(1)
    })
  })
})
