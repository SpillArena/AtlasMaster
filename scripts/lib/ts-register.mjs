/**
 * Slår på TypeScript-løysaren for sjekkeskripta.
 *
 *   node --experimental-strip-types --import ./scripts/lib/ts-register.mjs …
 */
import { register } from 'node:module'

register('./ts-hooks.mjs', import.meta.url)
