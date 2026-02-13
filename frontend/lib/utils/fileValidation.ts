export const ALLOWED_EXTENSIONS = new Set(['txt', 'csv', 'tsv'])

export interface FileValidationResult {
  validFiles: File[]
  invalidFiles: Array<{ file: File; reason: string }>
}

export function validateFileExtension(file: File, allowedExtensions: Set<string> = ALLOWED_EXTENSIONS): boolean {
  const ext = file.name.toLowerCase().split('.').pop()
  return ext ? allowedExtensions.has(ext) : false
}

export function validateFiles(files: File[], allowedExtensions: Set<string> = ALLOWED_EXTENSIONS): FileValidationResult {
  const validFiles: File[] = []
  const invalidFiles: Array<{ file: File; reason: string }> = []

  for (const file of files) {
    if (validateFileExtension(file, allowedExtensions)) {
      validFiles.push(file)
    } else {
      const allowed = Array.from(allowedExtensions).join(', ')
      invalidFiles.push({
        file,
        reason: `Invalid file type. Allowed extensions: ${allowed}`,
      })
    }
  }

  return { validFiles, invalidFiles }
}

export function deduplicateFiles(existingFiles: File[], newFiles: File[]): File[] {
  const existingNames = new Set(existingFiles.map((f) => f.name))
  return newFiles.filter((f) => !existingNames.has(f.name))
}

export function addAndDeduplicateFiles(existingFiles: File[], incomingFiles: File[]): {
  allFiles: File[]
  addedFiles: File[]
  duplicateCount: number
} {
  const deduplicated = deduplicateFiles(existingFiles, incomingFiles)
  const duplicateCount = incomingFiles.length - deduplicated.length

  return {
    allFiles: [...existingFiles, ...deduplicated],
    addedFiles: deduplicated,
    duplicateCount,
  }
}
