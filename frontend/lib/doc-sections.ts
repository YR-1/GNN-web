/**
 * Shared section list for the Documentation page.
 *
 * Imported by both the server-rendered content (`DocumentationContent`) and the
 * client-side sticky navigation (`DocTableOfContents`) so the table of contents
 * and the section anchors can never drift out of sync.
 */

export interface DocSection {
  /** Anchor id applied to the matching <section> element. */
  id: string
  /** Label shown in the sidebar table of contents. */
  label: string
}

export const DOC_SECTIONS: DocSection[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'data-format', label: 'Data Format' },
  { id: 'brain-atlas', label: 'Brain Atlas & Networks' },
  { id: 'results', label: 'Understanding Results' },
  { id: 'limitations', label: 'Limitations' },
  { id: 'faq', label: 'FAQ' },
  { id: 'references', label: 'References' },
]
