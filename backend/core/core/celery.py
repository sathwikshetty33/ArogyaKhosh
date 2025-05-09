from __future__ import absolute_import, unicode_literals
import os
import logging
from celery import Celery
from celery.schedules import crontab
from celery.signals import task_success, task_failure, beat_init

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
)
logger = logging.getLogger(__name__)


os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')


app = Celery('core')

app.config_from_object('django.conf:settings', namespace='CELERY')


app.conf.timezone = 'Asia/Kolkata' 
logger.info(f"Celery timezone explicitly set to: {app.conf.timezone}")


app.autodiscover_tasks()


app.conf.broker_url = 'redis://localhost:6380/0'
app.conf.result_backend = 'redis://localhost:6380/0'


app.conf.task_track_started = True
app.conf.task_time_limit = 600
app.conf.broker_connection_retry_on_startup = True
app.conf.worker_hijack_root_logger = False 


from datetime import datetime
current_time = datetime.now().strftime('%H:%M')
logger.info(f"Current time when configuring beat schedule: {current_time}")


app.conf.beat_schedule = {
    'detect-suspicious-accident-patterns-daily': {
        'task': 'cronutils.task.detect_suspicious_accident_patterns',

        'schedule': crontab(hour=4, minute=00),  
        'options': {
            'queue': 'celery',
            'expires': 3600,  
        },
        'args': (),
    },
}
logger.info(f"Beat schedule configured with tasks: {list(app.conf.beat_schedule.keys())}")
logger.info(f"Schedule details: {app.conf.beat_schedule}")

@task_success.connect
def task_success_handler(sender=None, **kwargs):
    """Log successful task execution"""
    task_name = sender.name if sender else 'Unknown'
    logger.info(f"Task {task_name} completed successfully")

@task_failure.connect
def task_failure_handler(sender=None, exception=None, **kwargs):
    """Log failed task execution"""
    task_name = sender.name if sender else 'Unknown'
    logger.error(f"Task {task_name} failed: {exception}")

@beat_init.connect
def beat_init_handler(sender=None, **kwargs):
    """Log when beat scheduler starts"""
    logger.info("Beat scheduler initialized")
    if sender and hasattr(sender, 'scheduler') and hasattr(sender.scheduler, 'schedule'):
        logger.info(f"Current beat schedule: {sender.scheduler.schedule}")
    else:
        logger.warning("Beat scheduler initialized but schedule information unavailable")


@app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    logger.info("Celery app configured successfully")
    logger.info(f"Registered periodic tasks: {list(app.conf.beat_schedule.keys())}")