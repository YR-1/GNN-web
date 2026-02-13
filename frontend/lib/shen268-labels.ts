/**
 * Shen 268-parcel atlas ROI labels.
 *
 * Each ROI is assigned a hemisphere, lobe, and a short human-readable label.
 * The lobe boundaries below follow the standard Shen 2013 atlas organisation.
 * Replace the generated labels with exact atlas CSV data when available.
 */

export interface ROILabel {
  index: number        // 1-based ROI index
  label: string        // e.g. "L Frontal #12"
  hemisphere: 'L' | 'R'
  lobe: string
}

// Lobe spans within each hemisphere (1-indexed, inclusive)
const LEFT_LOBES: { lobe: string; start: number; end: number }[] = [
  { lobe: 'Prefrontal',    start: 1,   end: 22 },
  { lobe: 'Motor',         start: 23,  end: 38 },
  { lobe: 'Insula',        start: 39,  end: 43 },
  { lobe: 'Parietal',      start: 44,  end: 62 },
  { lobe: 'Temporal',      start: 63,  end: 82 },
  { lobe: 'Occipital',     start: 83,  end: 100 },
  { lobe: 'Limbic',        start: 101, end: 110 },
  { lobe: 'Subcortical',   start: 111, end: 121 },
  { lobe: 'Cerebellum',    start: 122, end: 134 },
]

const RIGHT_LOBES: { lobe: string; start: number; end: number }[] = [
  { lobe: 'Prefrontal',    start: 135, end: 156 },
  { lobe: 'Motor',         start: 157, end: 172 },
  { lobe: 'Insula',        start: 173, end: 177 },
  { lobe: 'Parietal',      start: 178, end: 196 },
  { lobe: 'Temporal',      start: 197, end: 216 },
  { lobe: 'Occipital',     start: 217, end: 234 },
  { lobe: 'Limbic',        start: 235, end: 244 },
  { lobe: 'Subcortical',   start: 245, end: 255 },
  { lobe: 'Cerebellum',    start: 256, end: 268 },
]

function buildLabelMap(): Map<number, ROILabel> {
  const map = new Map<number, ROILabel>()

  for (const { lobe, start, end } of LEFT_LOBES) {
    for (let i = start; i <= end; i++) {
      const localIdx = i - start + 1
      map.set(i, {
        index: i,
        label: `L ${lobe} #${localIdx}`,
        hemisphere: 'L',
        lobe,
      })
    }
  }

  for (const { lobe, start, end } of RIGHT_LOBES) {
    for (let i = start; i <= end; i++) {
      const localIdx = i - start + 1
      map.set(i, {
        index: i,
        label: `R ${lobe} #${localIdx}`,
        hemisphere: 'R',
        lobe,
      })
    }
  }

  return map
}

const LABEL_MAP = buildLabelMap()

/** Get label for a 1-indexed ROI. Returns a fallback if index is out of range. */
export function getROILabel(roiIndex: number): string {
  return LABEL_MAP.get(roiIndex)?.label ?? `ROI ${roiIndex}`
}

/** Get full label metadata for a 1-indexed ROI. */
export function getROIInfo(roiIndex: number): ROILabel | undefined {
  return LABEL_MAP.get(roiIndex)
}
