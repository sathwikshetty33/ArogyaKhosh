import requests
from io import BytesIO
from django.core.files.base import ContentFile
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import *

@receiver(post_save, sender=patient)
def generate_qr_code(sender, instance, created, **kwargs):
    if created:  # Only when a new patient is created
        qr_url = f"http://localhost:8000/patient-dashboard/{instance.id}"
        qr_api_url = f"https://api.qrserver.com/v1/create-qr-code/?size=200x200&data={qr_url}"

        response = requests.get(qr_api_url)
        if response.status_code == 200:
            instance.qr.save(f'qr_{instance.id}.png', ContentFile(response.content), save=True)
