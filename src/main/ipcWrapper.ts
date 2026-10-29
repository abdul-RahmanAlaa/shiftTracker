export interface IpcError {
  field: string
  message: string
}

export type IpcResult = { ok: true; data: unknown } | { ok: false; errors: IpcError[] }

export function wrapHandler<Args extends unknown[], Result>(
  fn: (...args: Args) => Result | Promise<Result>,
  log: (error: unknown) => void = console.error
): (...args: Args) => Promise<Result | { ok: false; errors: IpcError[] }> {
  return async (...args: Args) => {
    try {
      const result = await fn(...args)
      return result
    } catch (error) {
      log(error)
      return { ok: false, errors: [{ field: '_form', message: 'UNEXPECTED_ERROR' }] }
    }
  }
}
