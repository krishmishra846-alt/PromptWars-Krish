# Google Cloud Run Optimized Production Container
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application source
COPY backend/ .

# Expose standard port for Google Cloud Run ($PORT defaults to 8000)
ENV PORT=8000
ENV ENVIRONMENT=production

EXPOSE 8000

# Run FastAPI with uvicorn
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 2
