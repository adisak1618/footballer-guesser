import type { SupabaseClient } from "@supabase/supabase-js"

export class GameRpcError extends Error {
  public code: string
  public context: Record<string, unknown>

  constructor(
    code: string,
    message: string,
    context: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = "GameRpcError"
    this.code = code
    this.context = context
  }
}

export function parsePgErrCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code
    if (typeof code === "string" && code.length > 0) return code
  }
  return "UNKNOWN"
}

export async function dispatch<TArgs = unknown, TResult = unknown>(
  supabase: SupabaseClient,
  rpcName: string,
  args: TArgs,
): Promise<TResult> {
  const { data, error } = await supabase.rpc(
    rpcName,
    args as Record<string, unknown>,
  )

  if (error) {
    const code = parsePgErrCode(error)
    const message =
      (error as { message?: unknown }).message &&
      typeof (error as { message?: unknown }).message === "string"
        ? ((error as { message: string }).message)
        : `RPC ${rpcName} failed`
    throw new GameRpcError(code, message, { rpc: rpcName, args })
  }

  if (Array.isArray(data)) {
    return (data as TResult[])[0] as TResult
  }
  return data as TResult
}
