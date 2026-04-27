import React from 'react'

type TableProps = React.TableHTMLAttributes<HTMLTableElement>
type SectionProps = React.HTMLAttributes<HTMLTableSectionElement>
type RowProps = React.HTMLAttributes<HTMLTableRowElement>
type CellProps = React.ThHTMLAttributes<HTMLTableCellElement>
type DataCellProps = React.TdHTMLAttributes<HTMLTableCellElement>

export function Table({ className = '', ...props }: TableProps) {
  return <table className={`w-full caption-bottom text-sm ${className}`} {...props} />
}

export function TableHeader({ className = '', ...props }: SectionProps) {
  return <thead className={className} {...props} />
}

export function TableBody({ className = '', ...props }: SectionProps) {
  return <tbody className={className} {...props} />
}

export function TableRow({ className = '', ...props }: RowProps) {
  return <tr className={`border-b ${className}`} {...props} />
}

export function TableHead({ className = '', ...props }: CellProps) {
  return (
    <th
      className={`h-10 px-2 text-left align-middle font-medium text-ink-700 [&:has([role=checkbox])]:pr-0 ${className}`}
      {...props}
    />
  )
}

export function TableCell({ className = '', ...props }: DataCellProps) {
  return <td className={`p-2 align-middle [&:has([role=checkbox])]:pr-0 ${className}`} {...props} />
}
