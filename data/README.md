# Test Data - ROI Time Series (268 ROI Shen Atlas)

## Overview
This directory contains test data for the ROI (Region of Interest) correlation analysis pipeline.

## Files
- `100610_MOVIE1_7T_AP_shen268_roi_ts_gsr.txt` - Sample time series data with GSR (Global Signal Regression) applied

## Data Format
- **Dimensions:** 268 timepoints × 268 ROIs (Shen atlas parcellation)
- **Format:** Tab-separated text file
- **Content:** BOLD signal time series from fMRI data
- **Processing:** GSR (Global Signal Regression) applied

## Usage
Upload this file through the web UI to test the correlation matrix analysis pipeline:
1. Go to `http://localhost:3000/dashboard/upload`
2. Select this file
3. View the resulting correlation matrix heatmap

## Reference
- Atlas: Shen et al. 2013 (268 regions)
- Imaging: 7T fMRI
- Processing: AP phase encoding, GSR applied
