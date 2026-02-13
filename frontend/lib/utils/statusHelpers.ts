export type ExecutionStatus = 'completed' | 'processing' | 'queued' | 'failed'

export function getStatusPillClass(status: string): string {
  switch (status) {
    case 'completed':
      return 'status-pill-completed'
    case 'processing':
      return 'status-pill-processing'
    case 'queued':
      return 'status-pill-queued'
    case 'failed':
      return 'status-pill-failed'
    default:
      return 'bg-slate-100 text-slate-700 border border-slate-300/70'
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'completed':
      return 'Completed'
    case 'processing':
      return 'Processing'
    case 'queued':
      return 'Queued'
    case 'failed':
      return 'Failed'
    default:
      return 'Unknown'
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'text-green-600'
    case 'processing':
      return 'text-blue-600'
    case 'queued':
      return 'text-yellow-600'
    case 'failed':
      return 'text-red-600'
    default:
      return 'text-gray-600'
  }
}

export const STATUS_FILTERS = ['all', 'completed', 'processing', 'queued', 'failed'] as const
export type StatusFilter = typeof STATUS_FILTERS[number]

export function filterByStatus<T extends { status: string }>(
  items: T[],
  filter: StatusFilter
): T[] {
  if (filter === 'all') {
    return items
  }
  return items.filter((item) => item.status === filter)
}
