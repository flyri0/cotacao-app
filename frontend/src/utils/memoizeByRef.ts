/**
 * Memoiza o resultado de uma função pura por identidade (===) dos argumentos,
 * guardando o cache em escopo de módulo (fora de qualquer componente).
 *
 * `useMemo` só evita recálculo entre re-renders da MESMA instância de componente —
 * ao trocar de tela e voltar, o componente é desmontado e remontado do zero, o que
 * descarta qualquer cache do `useMemo` junto com o restante do estado do hook.
 *
 * Como o proxy de `apiCache` (`services/apiCache.ts`) devolve a MESMA referência de
 * array em cada leitura em cache, uma junção pesada (`.filter/.map/.sort`) que dependa
 * só desses arrays crus pode reaproveitar o resultado do mount anterior sem refazer
 * o trabalho, desde que os dados de origem não tenham mudado (nesse caso o cache do
 * `apiCache` já teria sido invalidado e a referência seria outra).
 *
 * Guarda apenas a última chamada — não é um cache multi-entrada — o que é suficiente
 * aqui porque cada view só tem uma "rodada ativa" por vez.
 */
export function memoizeByRef<Args extends readonly unknown[], R>(
  compute: (...args: Args) => R,
): (...args: Args) => R {
  let cachedArgs: Args | null = null
  let cachedResult: R | undefined

  return (...args: Args): R => {
    if (
      cachedArgs !== null &&
      cachedArgs.length === args.length &&
      cachedArgs.every((prev, i) => Object.is(prev, args[i]))
    ) {
      return cachedResult as R
    }
    cachedResult = compute(...args)
    cachedArgs = args
    return cachedResult
  }
}
