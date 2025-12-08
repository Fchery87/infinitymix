# Demucs Stem Separation Service

AI-powered audio stem separation using Facebook's Demucs model.

## Overview

This microservice provides real AI stem separation (vocals, drums, bass, other) for InfinityMix. It uses Facebook's Demucs model which is the current state-of-the-art for music source separation.

## Features

- **Real AI Separation**: Actual neural network-based stem isolation (not frequency filters)
- **4 Stems**: Vocals, Drums, Bass, Other (instruments)
- **GPU Acceleration**: Automatically uses CUDA if available
- **Model Caching**: Loads model once, reuses for all requests
- **ZIP Output**: Returns all stems in a single ZIP archive

## Requirements

- Python 3.10+
- 8GB+ RAM (16GB recommended)
- Optional: NVIDIA GPU with CUDA for faster processing

## Quick Start

### Local Development

```bash
cd services/demucs

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Run service
python main.py
```

Service runs at `http://localhost:8001`

### Docker

```bash
# Build and run
docker-compose up --build

# Or build manually
docker build -t demucs-service .
docker run -p 8001:8001 demucs-service
```

### GPU Support (Docker)

For NVIDIA GPU acceleration:

```bash
docker-compose up --build
```

The docker-compose.yml includes NVIDIA runtime configuration.

## API Endpoints

### Health Check
```
GET /health
```

Returns service status and GPU availability.

### Separate All Stems
```
POST /separate/all
Content-Type: multipart/form-data

file: <audio file>
model: htdemucs (optional)
format: wav (optional)
```

Returns: ZIP file containing `vocals.wav`, `drums.wav`, `bass.wav`, `other.wav`

### Separate Single Stem
```
POST /separate/stem/{stem_name}
Content-Type: multipart/form-data

file: <audio file>
```

Returns: Single WAV file for requested stem

### Get Separation Info
```
POST /separate
Content-Type: multipart/form-data

file: <audio file>
stem: vocals (optional - return specific stem)
```

Returns: JSON with stem info, or single stem if specified

## Models

Available models (via `model` parameter):
- `htdemucs` (default) - Best quality, slower
- `htdemucs_ft` - Fine-tuned version
- `mdx_extra` - Alternative model

## Performance

Typical processing times (4-minute song):
- **GPU (RTX 3080)**: ~15-30 seconds
- **CPU (8-core)**: ~2-5 minutes

## Integration with InfinityMix

The main app automatically detects if Demucs is running:

1. Set `DEMUCS_SERVICE_URL=http://localhost:8001` in `.env.local`
2. Start the Demucs service
3. Stem separation will use AI instead of FFmpeg filters

If Demucs is unavailable, falls back to FFmpeg frequency-based filters.

## Deployment Options

### Railway/Render
- Use the Dockerfile
- Set `PORT` environment variable
- Allocate 2GB+ memory

### Replicate
Can also run as a Replicate model for serverless inference.

### Self-hosted
For production, deploy with:
- Kubernetes with GPU nodes
- Docker Swarm with NVIDIA plugin
- Bare metal with CUDA

## Troubleshooting

**Out of Memory**
- Reduce audio length or use CPU mode
- Increase container memory limits

**Slow Processing**
- Ensure CUDA is properly configured
- Check GPU utilization with `nvidia-smi`

**Model Download Fails**
- Check internet connectivity
- Pre-download model: `python -c "import demucs.api; demucs.api.Separator()"`
