/**
 * Løser importer uten filending til `.ts`.
 *
 * Node kan stripe typer fra en .ts-fil selv, men den innebygde løseren
 * gjetter ikke på filendingen slik en bundler gjør. Kildekoden vår skriver
 * `from './scoring'`, og uten denne kroken finner Node ingenting.
 */
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    try {
      return await next(`${specifier}.ts`, context)
    } catch {
      // ikke en TypeScript-fil likevel — la Node prøve som vanlig
    }
  }
  return next(specifier, context)
}
