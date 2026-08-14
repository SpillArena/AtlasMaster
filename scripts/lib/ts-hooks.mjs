/**
 * Løyser importar utan filending til `.ts`.
 *
 * Node kan stripe typar frå ei .ts-fil sjølv, men den innebygde løysaren
 * gjettar ikkje på filendinga slik ein bundler gjer. Kjeldekoden vår skriv
 * `from './scoring'`, og utan denne kroken finn Node ingenting.
 */
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    try {
      return await next(`${specifier}.ts`, context)
    } catch {
      // ikkje ei TypeScript-fil likevel — la Node prøve som vanleg
    }
  }
  return next(specifier, context)
}
