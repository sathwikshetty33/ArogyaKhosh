from django.db import models
from django.contrib.auth.models import User
from home.models import patient

class chat(models.Model):
    user = models.ForeignKey(patient, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Chat with {self.user.full_name if hasattr(self.user, 'full_name') else self.user}"

class chatMessages(models.Model):
    TYPE_CHOICES = [
        ('user', 'User'),
        ('ai', 'AI')
    ]
    
    chat = models.ForeignKey(chat, on_delete=models.CASCADE)
    message = models.CharField(max_length=1000)  # Increased from 100 for longer messages
    type = models.CharField(max_length=5, choices=TYPE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.type} message in {self.chat}"

