# serializers.py
from rest_framework import serializers
from .models import chat, chatMessages
from home.models import patient

class ChatMessageSerializer(serializers.ModelSerializer):
    message_type = serializers.CharField(source='type')
    
    class Meta:
        model = chatMessages
        fields = ['id', 'message', 'message_type', 'created_at']

class ChatSerializer(serializers.ModelSerializer):
    messages = ChatMessageSerializer(many=True, read_only=True, source='chatmessages_set')
    patient_name = serializers.CharField(source='user.full_name', read_only=True)
    
    class Meta:
        model = chat
        fields = ['id', 'patient_name', 'created_at', 'messages']