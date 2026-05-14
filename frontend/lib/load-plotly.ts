let plotlyPromise: Promise<any> | null = null

export function loadPlotly() {
  if (!plotlyPromise) {
    plotlyPromise = Promise.all([
      import('plotly.js/lib/core'),
      import('plotly.js/lib/heatmap'),
      import('plotly.js/lib/scatter'),
    ]).then(([coreModule, heatmapModule, scatterModule]) => {
      const Plotly = coreModule.default ?? coreModule
      Plotly.register([
        heatmapModule.default ?? heatmapModule,
        scatterModule.default ?? scatterModule,
      ])
      return Plotly
    })
  }

  return plotlyPromise
}
