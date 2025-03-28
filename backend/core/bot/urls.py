# urls.py
from django.urls import path
from .views import *
urlpatterns = [
    path('chats/', ChatView.as_view(), name='chats'),
    path('chats/<int:chat_id>/messages/', ChatMessageView.as_view(), name='chat_messages'),
   
]