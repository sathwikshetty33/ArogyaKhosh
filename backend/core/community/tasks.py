import logging
import re
import requests
import traceback
import sys
from celery import shared_task
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.conf import settings
import json
from .models import *

# Set up a file handler for logging
def setup_logging():
    """Set up logging to both console and file"""
    # Create a custom logger
    harassment_logger = logging.getLogger('harassment_detection')
    harassment_logger.setLevel(logging.DEBUG)
    
    # Create handlers
    console_handler = logging.StreamHandler(sys.stdout)
    file_handler = logging.FileHandler('harassment_detection.log')
    
    # Set levels
    console_handler.setLevel(logging.DEBUG)
    file_handler.setLevel(logging.DEBUG)
    
    # Create formatters and add them to handlers
    format_str = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    formatter = logging.Formatter(format_str)
    console_handler.setFormatter(formatter)
    file_handler.setFormatter(formatter)
    
    # Add handlers to the logger
    harassment_logger.addHandler(console_handler)
    harassment_logger.addHandler(file_handler)
    
    return harassment_logger

# Set up the logger
logger = setup_logging()

# Write an initial log entry to verify logging is working
logger.info("Harassment detection module initialized")

# Comprehensive list of harassment terms and patterns
HARASSMENT_TERMS = [
    # Explicit insults
    "idiot", "stupid", "dumb", "moron", "loser",
    "worthless", "pathetic", "useless", "failure",
    
    # Discriminatory terms (partial list)
    "retard", "retarded", "spastic", "cripple",
    
    # Threats and violence
    "kill yourself", "kys", "kill you", "hurt you", "beat you",
    "die", "death", "suicide", "hang yourself", "cut yourself",
    
    # Sexual harassment
    "slut", "whore", "bitch", "cunt", "dick", "pussy",
    
    # Health-related insults (especially relevant for health chat)
    "fatty", "anorexic", "crazy", "mental", "psycho",
    
    # Personal attacks
    "ugly", "fat", "disgusting", "gross",
    
    # Patterns for doxxing or privacy invasion
    r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b",  # Phone numbers
    r"\b\d{5}(?:[-]\d{4})?\b",  # ZIP codes
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",  # Email addresses
]

# Debug the pattern compilation
logger.info("Compiling harassment detection patterns")
try:
    # Simple string matching for exact phrases
    EXACT_MATCH_PHRASES = [
        "kill yourself", "kys", "kill you", "hurt you", "beat you",
        "hang yourself", "cut yourself","you are mental", "you are crazy",
    ]
    
    # Compile regex patterns
    COMPILED_PATTERNS = []
    for pattern in HARASSMENT_TERMS:
        try:
            if isinstance(pattern, str):
                if pattern.startswith(r"\b"):
                    # This is already a regex pattern
                    COMPILED_PATTERNS.append(re.compile(pattern, re.IGNORECASE))
                else:
                    # This is a simple string, convert to word boundary regex
                    COMPILED_PATTERNS.append(re.compile(r'\b' + re.escape(pattern) + r'\b', re.IGNORECASE))
            else:
                logger.error(f"Invalid pattern type: {type(pattern)}")
        except Exception as e:
            logger.error(f"Failed to compile pattern '{pattern}': {str(e)}")
            # Add a simple fallback pattern that won't cause errors
            COMPILED_PATTERNS.append(re.compile(re.escape(str(pattern)), re.IGNORECASE))
    
    logger.info(f"Successfully compiled {len(COMPILED_PATTERNS)} patterns")
except Exception as e:
    logger.error(f"Fatal error compiling patterns: {str(e)}")
    logger.error(traceback.format_exc())
    # Create an empty list as fallback to avoid crashing
    COMPILED_PATTERNS = []

@shared_task
def broadcast_message(message_id):
    """
    Celery task to process and broadcast messages with harassment detection
    """
    try:
        logger.info(f"[START] Processing message {message_id}")
        
        channel_layer = get_channel_layer()
        
        try:
            message = Message.objects.get(id=message_id)
            logger.info(f"Retrieved message {message_id}: {message.content[:50]}...")
        except Message.DoesNotExist:
            logger.error(f"Message with ID {message_id} not found")
            return f"Error: Message {message_id} not found"
        except Exception as e:
            logger.error(f"Error retrieving message {message_id}: {str(e)}")
            logger.error(traceback.format_exc())
            return f"Error retrieving message: {str(e)}"
        
        # IMPORTANT: Check if message contains harassing content
        logger.info(f"Checking message {message_id} for harassment: '{message.content}'")
        is_harassing, reason = check_for_harassment(message.content)
        
        logger.info(f"Harassment check result for message {message_id}: {is_harassing}, reason: {reason}")
        
        if is_harassing:
            # Log the blocked message
            logger.warning(f"BLOCKED HARASSING MESSAGE {message_id}: {reason}")
            logger.warning(f"Blocked message content: {message.content}")
            
            # Get data before deletion
            created_at = message.created_at
            
            try:
                # Delete the message
                logger.info(f"Deleting message {message_id}")
                message.delete()
                logger.info(f"Successfully deleted message {message_id}")
            except Exception as e:
                logger.error(f"Failed to delete message {message_id}: {str(e)}")
                logger.error(traceback.format_exc())
            
            logger.info(f"[END] Message {message_id} blocked due to harassment")
            return f"Message {message_id} blocked due to harassment detection: {reason}"
        
        # If message passes checks, broadcast it
        logger.info(f"Broadcasting message {message_id}")
        try:
            # CRITICAL SECTION: This is where the message actually gets broadcast
            async_to_sync(channel_layer.group_send)(
                'community_chat',
                {
                    'type': 'chat_message',
                    'message': message.content,
                    'message_id': str(message.id),
                    'timestamp': message.created_at.isoformat(),
                }
            )
            logger.info(f"Successfully broadcast message {message_id}")
        except Exception as e:
            logger.error(f"Failed to broadcast message {message_id}: {str(e)}")
            logger.error(traceback.format_exc())
        
        logger.info(f"[END] Message {message_id} processed successfully")
        return f"Message {message_id} processed and broadcast to community chat"
    
    except Exception as e:
        logger.error(f"Unhandled exception in broadcast_message task: {str(e)}")
        logger.error(traceback.format_exc())
        return f"Error processing message {message_id}: {str(e)}"

def check_for_harassment(text):
    """
    Check if message content contains harassing elements
    Returns a tuple of (is_harassing, reason)
    """
    if not text:
        logger.warning("Empty text passed to harassment check")
        return (False, "")
    
    # DEBUG OUTPUT: Print the actual text being checked
    logger.debug(f"Checking text for harassment: '{text}'")
    
    # FIRST CHECK: Direct string matching for critical phrases (most reliable)
    text_lower = text.lower().strip()
    
    # Check for exact phrases
    for phrase in EXACT_MATCH_PHRASES:
        if phrase in text_lower:
            logger.info(f"MATCH FOUND! Direct match: '{phrase}' in '{text_lower}'")
            return (True, f"Contains harmful phrase: {phrase}")
    
    # SECOND CHECK: Word boundary regex matching
    pattern_result = pattern_based_harassment_check(text)
    if pattern_result[0]:
        return pattern_result
    
    # THIRD CHECK: AI-based checking if enabled
    if getattr(settings, 'USE_AI_CONTENT_MODERATION', False):
        return ai_based_harassment_check(text)
    
    logger.debug("No harassment detected in text")
    return (False, "")

def pattern_based_harassment_check(text):
    """
    Use regex patterns to check for harassment terms
    """
    if not COMPILED_PATTERNS:
        logger.warning("No compiled patterns available for harassment checking")
        return (False, "")
    
    # Check each pattern
    for i, pattern in enumerate(COMPILED_PATTERNS):
        if i >= len(HARASSMENT_TERMS):
            continue  # Skip if index is out of range
            
        try:
            if pattern.search(text):
                term = HARASSMENT_TERMS[i]
                logger.info(f"MATCH FOUND! Pattern match: '{term}' in '{text}'")
                return (True, f"Contains harmful term or pattern: {term}")
        except Exception as e:
            logger.error(f"Error checking pattern {i}: {str(e)}")
    
    return (False, "")

def ai_based_harassment_check(text):
    """
    Use Groq API to check for harassment
    """
    try:
        logger.debug("Attempting AI-based harassment check")
        if not hasattr(settings, 'GROQ_API_KEY') or not settings.GROQ_API_KEY:
            logger.warning("GROQ_API_KEY not set in settings")
            return (False, "")
            
        headers = {
            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "llama3-8b-8192",
            "messages": [
                {"role": "system", "content": "You are a content moderation AI. Analyze the following text and determine if it contains harassment, threats, hate speech, or inappropriate content for a health-related community chat. Respond with JSON: {\"is_harassment\": true/false, \"reason\": \"explanation if harassment detected\"}"},
                {"role": "user", "content": text}
            ],
            "response_format": {"type": "json_object"}
        }
        
        logger.debug(f"Sending request to Groq API")
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=5
        )
        
        if response.status_code == 200:
            result = response.json()
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "{}")
            logger.debug(f"Groq API response: {content}")
            
            try:
                moderation_result = json.loads(content)
                is_harassment = moderation_result.get("is_harassment", False)
                reason = moderation_result.get("reason", "AI detected potential harassment")
                logger.info(f"AI moderation result: {is_harassment}, reason: {reason}")
                return (is_harassment, reason)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse AI moderation response: {content}")
        else:
            logger.error(f"Groq API returned status code {response.status_code}: {response.text}")
        
    except Exception as e:
        logger.error(f"Error using AI moderation: {str(e)}")
        logger.error(traceback.format_exc())
    
    return (False, "")

