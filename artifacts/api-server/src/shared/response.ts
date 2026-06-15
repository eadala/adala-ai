export function ok<T>(data: T) {
  return { ok: true, data } as const;
}

export function err(message: string, code?: string, status = 400) {
  return { ok: false, error: message, code: code ?? "ERROR", status } as const;
}

export function paginated<T>(data: T[], total: number, page: number, limit: number) {
  return { ok: true, data, meta: { total, page, limit, pages: Math.ceil(total / limit) } } as const;
}
