# Reference Notebook - Correlation Analysis

## Overview
This notebook contains the original analysis code that served as the reference for the backend implementation.

## Content
The notebook demonstrates:
- Loading time series data (268 ROI Shen atlas)
- Computing correlation matrices using multiple methods
- Generating interactive Plotly heatmap visualizations
- Statistical analysis of ROI correlations

Additional preprocessing scripts:
- `step1_compute_ldw.py`: cleaning + sliding-window LDW correlation/adjacency extraction
- `step2_prepare_data.py`: sequence padding and PyG graph conversion
- `convert_txt_to_graph.py`: single-file conversion to graph windows for inference payloads

## Important Note
**The backend has extracted and integrated all logic from this notebook.** 

The main analysis functions are now implemented in:
```
backend/app/services/model_service.py
```

### Extracted Functions
- `compute_corr()` - Compute correlation matrices (Pearson, Ledoit-Wolf)
- `cov2corr()` - Convert covariance to correlation
- `create_plotly_heatmap()` - Generate interactive visualization
- `process_txt_data()` - Complete pipeline orchestration

## Running Locally
You can still run this notebook for:
- Understanding the analysis methodology
- Experimenting with different methods
- Testing locally without the full stack

## Requirements
```
python -m pip install numpy scikit-learn matplotlib plotly jupyter
```

## How to Open
```bash
# From the project root
jupyter notebook notebooks/plot_corr_matrix.ipynb
```

## Backend vs Notebook
| Aspect | Notebook | Backend |
|--------|----------|---------|
| Purpose | Reference/Learning | Production |
| Run Environment | Jupyter | FastAPI Server |
| Deployment | Local only | Docker + Cloud |
| Integration | N/A | Plotly.js Frontend |
| Data Input | Manual upload | Web UI upload |
| Data Format | .ipynb | Python functions |

The backend implementation is faster, more scalable, and production-ready.
