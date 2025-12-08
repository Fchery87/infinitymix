"""
Demucs Stem Separation Microservice
FastAPI service that uses Facebook's Demucs for AI-powered audio stem separation.
"""

import os
import io
import uuid
import tempfile
import logging
from pathlib import Path
from typing import Optional

import torch
import torchaudio
from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
import demucs.api

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Demucs Stem Separation Service",
    description="AI-powered audio stem separation using Facebook's Demucs",
    version="1.0.0"
)

# Model cache
_separator: Optional[demucs.api.Separator] = None

def get_separator(model: str = "htdemucs") -> demucs.api.Separator:
    """Get or create the Demucs separator (cached for performance)."""
    global _separator
    if _separator is None:
        logger.info(f"Loading Demucs model: {model}")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {device}")
        _separator = demucs.api.Separator(model=model, device=device)
        logger.info("Model loaded successfully")
    return _separator

class StemInfo(BaseModel):
    name: str
    size_bytes: int

class SeparationResult(BaseModel):
    track_id: str
    stems: list[StemInfo]
    model: str
    device: str

@app.on_event("startup")
async def startup_event():
    """Pre-load the model on startup for faster first request."""
    try:
        get_separator()
    except Exception as e:
        logger.warning(f"Failed to pre-load model: {e}")

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    device = "cuda" if torch.cuda.is_available() else "cpu"
    return {
        "status": "healthy",
        "device": device,
        "cuda_available": torch.cuda.is_available(),
        "model_loaded": _separator is not None
    }

@app.post("/separate")
async def separate_audio(
    file: UploadFile = File(...),
    model: str = Query(default="htdemucs", description="Demucs model to use"),
    stem: Optional[str] = Query(default=None, description="Return only this stem (vocals, drums, bass, other)")
):
    """
    Separate audio into stems using Demucs.
    
    Returns a multipart response with all stems, or a single stem if specified.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    track_id = str(uuid.uuid4())
    
    try:
        # Read uploaded file
        content = await file.read()
        logger.info(f"Processing file: {file.filename} ({len(content)} bytes)")
        
        # Save to temp file (Demucs needs file path)
        with tempfile.NamedTemporaryFile(suffix=Path(file.filename).suffix, delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            # Get separator and process
            separator = get_separator(model)
            
            # Separate stems
            logger.info(f"Separating stems for track {track_id}")
            origin, separated = separator.separate_audio_file(tmp_path)
            
            # Get stem names from the model
            stem_names = list(separated.keys())
            logger.info(f"Separated into stems: {stem_names}")
            
            # If specific stem requested, return just that one
            if stem:
                if stem not in separated:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Stem '{stem}' not found. Available: {stem_names}"
                    )
                
                # Convert to bytes
                stem_tensor = separated[stem]
                buffer = io.BytesIO()
                torchaudio.save(buffer, stem_tensor, separator.samplerate, format="wav")
                buffer.seek(0)
                
                return StreamingResponse(
                    buffer,
                    media_type="audio/wav",
                    headers={
                        "Content-Disposition": f'attachment; filename="{stem}.wav"',
                        "X-Track-Id": track_id,
                        "X-Stem-Name": stem
                    }
                )
            
            # Return all stems as multipart or JSON with URLs
            # For simplicity, we'll return metadata and let client fetch individual stems
            stems_info = []
            for name, tensor in separated.items():
                buffer = io.BytesIO()
                torchaudio.save(buffer, tensor, separator.samplerate, format="wav")
                stems_info.append(StemInfo(name=name, size_bytes=buffer.tell()))
            
            return SeparationResult(
                track_id=track_id,
                stems=stems_info,
                model=model,
                device="cuda" if torch.cuda.is_available() else "cpu"
            )
            
        finally:
            # Cleanup temp file
            os.unlink(tmp_path)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Separation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Separation failed: {str(e)}")

@app.post("/separate/all")
async def separate_all_stems(
    file: UploadFile = File(...),
    model: str = Query(default="htdemucs", description="Demucs model to use"),
    format: str = Query(default="wav", description="Output format (wav or mp3)")
):
    """
    Separate audio and return all stems as a ZIP archive.
    """
    import zipfile
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    track_id = str(uuid.uuid4())
    
    try:
        content = await file.read()
        logger.info(f"Processing file for all stems: {file.filename}")
        
        with tempfile.NamedTemporaryFile(suffix=Path(file.filename).suffix, delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            separator = get_separator(model)
            origin, separated = separator.separate_audio_file(tmp_path)
            
            # Create ZIP with all stems
            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
                for name, tensor in separated.items():
                    stem_buffer = io.BytesIO()
                    if format == "mp3":
                        # MP3 requires additional encoding
                        torchaudio.save(stem_buffer, tensor, separator.samplerate, format="wav")
                    else:
                        torchaudio.save(stem_buffer, tensor, separator.samplerate, format="wav")
                    stem_buffer.seek(0)
                    zf.writestr(f"{name}.wav", stem_buffer.read())
            
            zip_buffer.seek(0)
            
            return StreamingResponse(
                zip_buffer,
                media_type="application/zip",
                headers={
                    "Content-Disposition": f'attachment; filename="stems_{track_id}.zip"',
                    "X-Track-Id": track_id
                }
            )
            
        finally:
            os.unlink(tmp_path)
            
    except Exception as e:
        logger.error(f"Separation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Separation failed: {str(e)}")

@app.post("/separate/stem/{stem_name}")
async def get_single_stem(
    stem_name: str,
    file: UploadFile = File(...),
    model: str = Query(default="htdemucs")
):
    """Convenience endpoint to get a single stem directly."""
    return await separate_audio(file=file, model=model, stem=stem_name)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
