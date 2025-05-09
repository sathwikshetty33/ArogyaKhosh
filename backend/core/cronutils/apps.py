from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)

class CronutilsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'cronutils'
    
    def ready(self):
        logger.info("CronutilsConfig ready method called - loading tasks")
        # Import celery tasks to ensure they're registered
        try:
            import cronutils.task
            logger.info("Successfully imported cronutils tasks")
        except Exception as e:
            logger.error(f"Error importing cronutils tasks: {e}")