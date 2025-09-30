declare module "daisyui/theme/forest/index.js" {
  interface ThemeConfig {
    addBase: (
      base: Record<string, string | number | Record<string, string | number>>
    ) => void
    prefix?: string
  }
  const forest: (config: ThemeConfig) => void
  export default forest
}

// Also declare the module without the .js extension
declare module "daisyui/theme/forest/index" {
  interface ThemeConfig {
    addBase: (
      base: Record<string, string | number | Record<string, string | number>>
    ) => void
    prefix?: string
  }
  const forest: (config: ThemeConfig) => void
  export default forest
}
