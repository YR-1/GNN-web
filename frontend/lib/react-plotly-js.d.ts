declare module 'react-plotly.js' {
  import { ComponentType } from 'react'

  const Plot: ComponentType<any>
  export default Plot
}

declare module 'plotly.js-dist-min' {
  const Plotly: any
  export default Plotly
}

declare module 'plotly.js/lib/core' {
  const Plotly: any
  export default Plotly
}

declare module 'plotly.js/lib/heatmap' {
  const Heatmap: any
  export default Heatmap
}

declare module 'plotly.js/lib/scatter' {
  const Scatter: any
  export default Scatter
}
