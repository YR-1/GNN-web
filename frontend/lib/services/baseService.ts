import { AxiosError } from 'axios'

export class ServiceError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public isAuthError: boolean = false
  ) {
    super(message)
    this.name = 'ServiceError'
  }
}

export function handleServiceError(error: unknown): never {
  if (error instanceof AxiosError) {
    const statusCode = error.response?.status
    const message = error.response?.data?.detail || error.message || 'An error occurred'

    const isAuthError = statusCode === 401 || statusCode === 403

    throw new ServiceError(message, statusCode, isAuthError)
  }

  if (error instanceof Error) {
    throw new ServiceError(error.message)
  }

  throw new ServiceError('An unexpected error occurred')
}
