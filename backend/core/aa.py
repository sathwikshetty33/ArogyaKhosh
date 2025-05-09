"""
Run this script to manually trigger the task and verify it works correctly.
This will help isolate whether the problem is with the task itself or with Celery beat scheduling.
"""
import os
import django
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
)
logger = logging.getLogger(__name__)

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

# Import the task
logger.info("Importing the task...")
try:
    from cronutils.task import detect_suspicious_accident_patterns
    logger.info("Task imported successfully")
except ImportError as e:
    logger.error(f"Failed to import task: {e}")
    raise

# Execute the task manually
logger.info("Running the task manually...")
try:
    result = detect_suspicious_accident_patterns.delay()
    logger.info(f"Task submitted with id: {result.id}")
    logger.info("Waiting for task result...")
    task_result = result.get(timeout=10)
    logger.info(f"Task completed with result: {task_result}")
except Exception as e:
    logger.error(f"Error during task execution: {e}")
    raise

logger.info("Script execution completed")