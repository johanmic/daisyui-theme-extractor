# DaisyUI Theme Extractor

![Test Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)

A TypeScript-based Node.js command-line tool that extracts themes from DaisyUI and converts OKLCH colors to hex format, outputting the results as JSON. Features beautiful colorful output and flexible theme extraction from both node_modules and CSS files.

## Reason for creating this tool

Sometimes we need the variables from a theme in the backend like in sending emails, generating OG images in Next or whatever reason you may have.

## Features

- ✨ Written in TypeScript with full type safety
- 🎨 Extract multiple DaisyUI themes at once
- 📄 **NEW:** Read themes directly from CSS files
- 🔄 Convert OKLCH colors to hex format automatically
- 💎 **NEW:** Support for inline theme definitions in CSS
- 🌈 **NEW:** Beautiful colorful CLI output with statistics
- 📁 Flexible output path specification
- 🛡️ Comprehensive error handling for missing themes
- 🔍 Support for various DaisyUI theme import paths

## You might not need this tool

You can simply get a theme by

```tsx
import theme from "daisyui/theme/light/index.js"
const parsedTheme = theme({
  addBase: (base: BaseStyles) => {
    console.log(base)
  },
})
```

if you however need multiple themes, custom themes etc this tool might be useful.

## Installation

1. Clone or download this project
2. Install dependencies:

```bash
npm install
# or
pnpm install
```

3. Build the TypeScript code:

```bash
npm run build
```

## Project Structure

```
.
├── src/
│   └── theme-extractor.ts    # Main TypeScript source
├── dist/                      # Compiled JavaScript output
├── types.ts                   # Type definitions & utilities
├── example-usage.ts           # Usage examples & ThemeManager
├── package.json
├── tsconfig.json
├── .gitignore
├── README.md
└── QUICKSTART.md
```

## Usage

### Development Mode (with tsx)

Run directly without building:

```bash
npm run dev -- -t forest,dark -o themes.json
```

### Production Mode

Build and run:

```bash
# Build the project
npm run build

# Run the compiled version
npm start -- -t forest,dark -o themes.json

# Or use the npm script
npm run extract -- -t forest,dark -o themes.json

# Or run directly
node dist/theme-extractor.js -t forest,dark -o themes.json
```

## Command Line Options

- `-t, --themes <themes>`: Comma-separated list of theme names (optional if using `--read-css`)
- `-o, --output <path>`: Output JSON file path (default: `./themes.json`)
- `--read-css`: Read themes from CSS file (default: `false`)
- `--css-path <path>`: Path to CSS file (default: `src/index.css`)
- `-h, --help`: Show help message

## Usage Examples

### Extract from node_modules

```bash
# Extract single theme
npm run extract -- -t forest -o themes.json

# Extract multiple themes
npm run extract -- -t forest,dark,light -o ./output/themes.json

# Using long form options
npm run extract -- --themes="cupcake,bumblebee,emerald" --output="./themes.json"
```

### Extract from CSS File

The tool can now read themes directly from your CSS file in two ways:

#### 1. Extract Theme Names from `@plugin "daisyui"` Block

If your CSS file contains:

```css
@plugin "daisyui" {
  themes: light --default, dark --prefersdark, forest;
}
```

Extract those themes:

```bash
# Reads from default path (src/index.css)
npm run extract -- --read-css -o themes.json

# Specify custom CSS path
npm run extract -- --read-css --css-path="./styles/main.css" -o themes.json
```

This will extract: `light`, `dark`, and `forest` (the `--default` and `--prefersdark` flags are automatically ignored).

#### 2. Extract Inline Theme Definitions

If your CSS file contains inline theme definitions:

```css
@plugin "daisyui/theme" {
  name: mediumseagreen;
  default: false;
  prefersdark: false;
  color-scheme: dark;
  --color-base-100: #edf7ef;
  --color-base-200: #e4f4e7;
  --color-primary: #2ade76;
  --color-secondary: #21c312;
  /* ... more properties ... */
}
```

The tool will extract these inline themes directly without needing node_modules.

#### 3. Combine Both Methods

```bash
# Extract themes from CSS AND additional themes from CLI
npm run extract -- --read-css -t cyberpunk,synthwave -o themes.json

# This will extract:
# - All themes listed in @plugin "daisyui" blocks
# - All inline themes from @plugin "daisyui/theme" blocks
# - cyberpunk and synthwave from node_modules
```

### Complete CSS Example

Given this `src/index.css`:

```css
@import "tailwindcss";

@plugin "daisyui" {
  themes: light --default, dark --prefersdark, forest;
}

@plugin "daisyui/theme" {
  name: mediumseagreen;
  color-scheme: dark;
  --color-base-100: #edf7ef;
  --color-primary: #2ade76;
  --color-secondary: #21c312;
}
```

Running:

```bash
npm run extract -- --read-css -o themes.json
```

Will extract 4 themes:

- `light` (from node_modules)
- `dark` (from node_modules)
- `forest` (from node_modules)
- `mediumseagreen` (inline from CSS)

### Available DaisyUI Themes

Common DaisyUI themes include:

- `light`, `dark`, `cupcake`, `bumblebee`, `emerald`, `corporate`, `synthwave`
- `retro`, `cyberpunk`, `valentine`, `halloween`, `garden`, `forest`, `aqua`
- `lofi`, `pastel`, `fantasy`, `wireframe`, `black`, `luxury`, `dracula`
- `cmyk`, `autumn`, `business`, `acid`, `lemonade`, `night`, `coffee`, `winter`
- `dim`, `nord`, `sunset`

## Output Format

The tool generates a JSON file with cleaned property names (removes `--` and `--color-` prefixes):

```json
{
  "forest": {
    "color-scheme": "dark",
    "base-100": "#363433",
    "base-200": "#2f2d2c",
    "base-300": "#292726",
    "primary": "#22c55e",
    "secondary": "#3b82f6",
    "radius-selector": "1rem",
    "border": "1px"
  },
  "dark": {
    "color-scheme": "dark",
    "base-100": "#2d3748",
    ...
  },
  "mediumseagreen": {
    "color-scheme": "dark",
    "base-100": "#edf7ef",
    "primary": "#2ade76",
    ...
  }
}
```

## Development Scripts

```bash
# Build the project
npm run build

# Watch mode (rebuild on changes)
npm run watch

# Run in development mode (no build needed)
npm run dev -- -t forest -o themes.json

# Run with CSS reading in dev mode
npm run dev -- --read-css --css-path="./src/styles.css"

# Clean build artifacts
npm run clean
```

## Advanced Examples

### Extract All Themes from a Project

```bash
# Extract all themes defined in your CSS plus additional themes
npm run extract -- --read-css --css-path="./app/globals.css" -t synthwave,cyberpunk -o all-themes.json
```

### Development Workflow

```bash
# Make changes to src/theme-extractor.ts
# Run immediately without building
npm run dev -- --read-css -o test.json
```

### Global Installation (Optional)

```bash
# Build first
npm run build

# Install globally
npm install -g

# Then use anywhere
extract-daisyui-themes --read-css --css-path="./src/index.css" -o themes.json
```

## Color Conversion

The tool automatically converts various color formats to hex:

- `oklch(20.84% 0.008 17.911)` → `#363433`
- `rgb(255, 0, 0)` → `#ff0000`
- `hsl(120, 100%, 50%)` → `#00ff00`

Non-color values are preserved as-is (e.g., border widths, radii).

## CSS Theme Format

### Theme Name References

When you reference theme names in `@plugin "daisyui"` blocks, they're loaded from node_modules:

```css
@plugin "daisyui" {
  themes: forest, dark, light;
}
```

### Inline Theme Definitions

When you define themes inline in `@plugin "daisyui/theme"` blocks, they're extracted directly:

```css
@plugin "daisyui/theme" {
  name: mytheme;
  color-scheme: light;
  --color-base-100: #ffffff;
  --color-primary: #570df8;
  --radius-selector: 1rem;
}
```

**Property Naming:**

- Use `--color-*` prefix for color properties (will be cleaned to just the color name)
- Use `--` prefix for other CSS variables (will be cleaned)
- Include metadata like `name`, `color-scheme`, `default`, `prefersdark`

## Type Safety

The TypeScript implementation includes full type definitions and safety features:

### Core Types

- **BaseStyles**: CSS variable structure
- **ThemeFunction**: DaisyUI theme function signature
- **ParsedArguments**: CLI argument types (includes CSS reading options)
- **ThemeError**: Error tracking types
- **ExtractedThemes**: Complete theme data structure
- **CssThemeData**: Inline CSS theme structure

### Error Handling

All errors are properly typed with type guards:

- `isError(error: unknown): error is Error` - Check if error is Error instance
- `isErrnoException(error: unknown): error is NodeJS.ErrnoException` - Check for filesystem errors
- `getErrorMessage(error: unknown): string` - Extract error messages safely

### Code Quality

- ✅ All functions use arrow syntax
- ✅ All parameters have explicit types
- ✅ No implicit `any` types
- ✅ Proper `unknown` error handling
- ✅ Full type inference support

## Error Handling

- CSS file not found errors are reported clearly
- If a theme cannot be found in node_modules, the tool tries alternative import paths
- Missing themes are skipped with error messages, but the tool continues processing other themes
- The final output shows which themes were successfully extracted and which failed
- TypeScript ensures type safety throughout the process
- Colorful error messages make issues easy to spot

## Dependencies

- **daisyui**: For accessing theme definitions
- **culori**: For color format conversion with TypeScript types
- **chalk**: For beautiful colorful CLI output
- **typescript**: TypeScript compiler
- **tsx**: TypeScript execution for development
- **@types/node**: Node.js type definitions
- **Node.js 18+**: Required for ES modules and modern features

## Troubleshooting

### TypeScript Compilation Errors

If you encounter TypeScript errors:

1. Ensure all dependencies are installed: `npm install`
2. Clean and rebuild: `npm run clean && npm run build`
3. Check your Node.js version: `node --version` (should be 18+)

### Module Import Errors

Make sure:

- You're using Node.js 18+
- The `package.json` includes `"type": "module"`
- TypeScript is configured with `"module": "ES2022"`

### Development Mode Not Working

If `npm run dev` fails:

1. Ensure `tsx` is installed: `npm install`
2. Try rebuilding: `npm run build && npm start`

## Contributing

Contributions are welcome! Please ensure:

- TypeScript compilation passes without errors
- All new features include type definitions
- Color output uses chalk appropriately
- CSS parsing handles edge cases gracefully

## License

MIT
