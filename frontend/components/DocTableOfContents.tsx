'use client'

import { useEffect, useState } from 'react'
import { DOC_SECTIONS } from '@/lib/doc-sections'

/**
 * Sticky "On this page" navigation for the Documentation page.
 *
 * Uses a single IntersectionObserver (no scroll listener) to highlight the
 * section currently in view, so the scroll-spy stays cheap and does not cause
 * layout thrashing on scroll.
 */
export function DocTableOfContents() {
  const [activeId, setActiveId] = useState<string>(DOC_SECTIONS[0].id)

  useEffect(() => {
    const sections = DOC_SECTIONS.map((section) => document.getElementById(section.id)).filter(
      (element): element is HTMLElement => element !== null,
    )

    if (sections.length === 0) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // Activate the topmost section currently inside the upper viewport band.
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      // Treat a section as "current" once it passes below the sticky top nav.
      { rootMargin: '-84px 0px -68% 0px', threshold: 0 },
    )

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])

  return (
    <nav className='doc-toc' aria-label='Documentation sections'>
      <p className='doc-toc-title'>On this page</p>
      <ul className='doc-toc-list'>
        {DOC_SECTIONS.map((section) => {
          const isActive = section.id === activeId
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className={isActive ? 'doc-toc-link-active' : 'doc-toc-link'}
                aria-current={isActive ? 'true' : undefined}
              >
                {section.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
