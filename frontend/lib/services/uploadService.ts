import { api } from '@/lib/api'
import { handleServiceError } from './baseService'

export interface UploadResponse {
  upload_id: string
  execution_id: string
  file_name: string
  status: string
}

export const uploadService = {
  async uploadFile(
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<UploadResponse> {
    try {
      const response = await api.uploadFile(file, onProgress)
      return response.data as UploadResponse
    } catch (error) {
      return handleServiceError(error)
    }
  },

  validateFile(file: File, allowedExtensions: Set<string>): { valid: boolean; error?: string } {
    const ext = file.name.toLowerCase().split('.').pop()

    if (!ext || !allowedExtensions.has(ext)) {
      return {
        valid: false,
        error: `Invalid file type. Allowed: ${Array.from(allowedExtensions).join(', ')}`,
      }
    }

    return { valid: true }
  },

  validateFiles(
    files: File[],
    allowedExtensions: Set<string>
  ): { valid: File[]; invalid: { file: File; reason: string }[] } {
    const valid: File[] = []
    const invalid: { file: File; reason: string }[] = []

    for (const file of files) {
      const validation = this.validateFile(file, allowedExtensions)
      if (validation.valid) {
        valid.push(file)
      } else {
        invalid.push({ file, reason: validation.error || 'Invalid file' })
      }
    }

    return { valid, invalid }
  },
}
