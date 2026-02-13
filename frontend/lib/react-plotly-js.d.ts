declare module 'react-plotly.js' {
  import { ComponentType } from 'react'

  const Plot: ComponentType<any>
  export default Plot
}

declare module 'plotly.js-dist-min' {
  const Plotly: any
  export default Plotly
}
