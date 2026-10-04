"""
BlindSpot AI Services Layer
Encapsulates integrations with external providers, including Google Cloud & Google Gemini AI.
"""
from .google_services import GoogleGeminiService, get_gemini_service

__all__ = ["GoogleGeminiService", "get_gemini_service"]
