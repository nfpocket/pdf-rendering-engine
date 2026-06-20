// Framework-agnostic pagination core. No Vue, no DOM. Headless-testable.
// This is the layer intended to be extracted as a standalone OSS package.

export * from './geometry'
export * from './types'
export { paginate } from './fragment'
export { buildPageCss, RECOMMENDED_PRINT_OPTIONS } from './export'
