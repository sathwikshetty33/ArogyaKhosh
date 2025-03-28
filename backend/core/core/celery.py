from __future__ import absolute_import, unicode_literals
import os
from celery import Celery  # ✅ Corrected import


# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

# Create Celery app
app = Celery('core')

# Use a string here so the worker doesn't serialize the object
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps
app.autodiscover_tasks()

# Optional Redis broker configuration
app.conf.broker_url = 'redis://localhost:6380/0'
app.conf.result_backend = 'redis://localhost:6380/0'

# Optional Celery configurations
app.conf.task_track_started = True
app.conf.task_time_limit = 600  # 10 minutes max runtime