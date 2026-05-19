FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ .

# Copy notebooks for Papermill execution
COPY notebooks/ /app/notebooks/

# copy root-level Shen atlas files
COPY shen_2mm_268.nii.gz /app/
COPY shen_268_networklabels.csv /app/
COPY shen_raw.json /app/
COPY shen268_centroids_mni.csv /app/
COPY shen268_mni_centroids_user_order.csv /app/

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# HF Spaces need writable cache directories
RUN mkdir -p /tmp/cache && chmod 777 /tmp/cache
ENV HF_HOME=/tmp/cache
ENV MPLCONFIGDIR=/tmp/cache
ENV TRANSFORMERS_CACHE=/tmp/cache

# Expose port
EXPOSE 8000

# Run application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
