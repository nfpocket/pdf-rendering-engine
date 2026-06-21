/**
 * @nfpocket/pdf-rendering-engine — public entry.
 *
 * A live-preview pagination engine for Vue 3 + Tailwind documents. The
 * framework-agnostic core (`paginate`, geometry, the Atom/Fragment contract)
 * and the Vue binding (`PaginatedDocument`, `usePagination`, the print export)
 * are re-exported here.
 *
 * Consumers must also import the stylesheet ONCE, anywhere in their app:
 *
 *   import '@nfpocket/pdf-rendering-engine/style.css'
 */
import './engine-vue/engine.css'

// Framework-agnostic core (no Vue, no DOM).
export * from './core'

// Vue 3 binding (the only Vue/DOM-aware layer).
export * from './engine-vue'
