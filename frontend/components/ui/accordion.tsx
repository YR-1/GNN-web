'use client'

import React, { createContext, useContext, useMemo, useState } from 'react'

type AccordionType = 'single'

interface AccordionContextValue {
  openItem: string | null
  toggleItem: (value: string) => void
}

const AccordionContext = createContext<AccordionContextValue | null>(null)

interface AccordionProps {
  children: React.ReactNode
  className?: string
  type?: AccordionType
  collapsible?: boolean
}

interface AccordionItemContextValue {
  value: string
  isOpen: boolean
}

const AccordionItemContext = createContext<AccordionItemContextValue | null>(null)

export function Accordion({
  children,
  className = '',
  type = 'single',
  collapsible = false,
}: AccordionProps) {
  const [openItem, setOpenItem] = useState<string | null>(null)

  const toggleItem = (value: string) => {
    setOpenItem((current) => {
      if (current === value) {
        return collapsible ? null : current
      }
      return value
    })
  }

  const contextValue = useMemo(
    () => ({
      openItem,
      toggleItem,
    }),
    [openItem]
  )

  if (type !== 'single') {
    throw new Error('Only single accordion type is supported.')
  }

  return (
    <AccordionContext.Provider value={contextValue}>
      <div className={className}>{children}</div>
    </AccordionContext.Provider>
  )
}

interface AccordionItemProps {
  children: React.ReactNode
  value: string
  className?: string
}

export function AccordionItem({ children, value, className = '' }: AccordionItemProps) {
  const accordionContext = useContext(AccordionContext)
  if (!accordionContext) {
    throw new Error('AccordionItem must be used inside Accordion.')
  }

  const isOpen = accordionContext.openItem === value
  const itemContextValue = useMemo(
    () => ({
      value,
      isOpen,
    }),
    [value, isOpen]
  )

  return (
    <AccordionItemContext.Provider value={itemContextValue}>
      <div className={className}>{children}</div>
    </AccordionItemContext.Provider>
  )
}

interface AccordionTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

export function AccordionTrigger({ children, className = '', ...props }: AccordionTriggerProps) {
  const accordionContext = useContext(AccordionContext)
  const itemContext = useContext(AccordionItemContext)

  if (!accordionContext || !itemContext) {
    throw new Error('AccordionTrigger must be used inside AccordionItem.')
  }

  return (
    <button
      type='button'
      className={`w-full text-left flex items-center justify-between gap-3 py-4 ${className}`}
      aria-expanded={itemContext.isOpen}
      onClick={() => accordionContext.toggleItem(itemContext.value)}
      {...props}
    >
      <span>{children}</span>
      <span className='text-sm text-slate-500'>{itemContext.isOpen ? '-' : '+'}</span>
    </button>
  )
}

interface AccordionContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function AccordionContent({ children, className = '', ...props }: AccordionContentProps) {
  const itemContext = useContext(AccordionItemContext)
  if (!itemContext) {
    throw new Error('AccordionContent must be used inside AccordionItem.')
  }

  if (!itemContext.isOpen) {
    return null
  }

  return (
    <div className={`pb-4 ${className}`} {...props}>
      {children}
    </div>
  )
}
