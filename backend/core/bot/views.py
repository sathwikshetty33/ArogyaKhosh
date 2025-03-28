
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import render
from django.http import JsonResponse
from django.db.models import Q
import json
from rest_framework.authentication import TokenAuthentication
import requests
from .models import chat, chatMessages
from home.models import patient

class ChatView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Get patient associated with the current user
        try:
            patient_obj = patient.objects.get(user=request.user)
        except patient.DoesNotExist:
            return Response({"error": "Patient profile not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Get all chats for this patient
        user_chats = chat.objects.filter(user=patient_obj).order_by('-created_at')
        
        chats_data = []
        for chat_obj in user_chats:
            # Get first message in chat for preview
            first_message = chatMessages.objects.filter(chat=chat_obj).order_by('created_at').first()
            preview = first_message.message[:30] + "..." if first_message else "Empty chat"
            
            chats_data.append({
                'id': chat_obj.id,
                'created_at': chat_obj.created_at.strftime("%Y-%m-%d %H:%M"),
                'preview': preview
            })
        
        return Response(chats_data)
    
    def post(self, request):
    # Create a new chat session
        try:
            patient_obj = patient.objects.get(user=request.user)
            new_chat = chat.objects.create(user=patient_obj)
            print(1)
            # Add welcome message from Dr. Dhoomkethu
            welcome_message = "Hello, I'm Dr. Dhoomkethu. Welcome to your virtual consultation. How may I assist you with your health concerns today?"
            print(11)
            # Create the first message in the chat (assuming you have a message model)
            # Update this part based on your actual message model structure
            chat_message = chatMessages.objects.create(
                chat=new_chat,
                type="ai",  # or whatever field you use to identify the sender
                message=welcome_message,
            )
            print(1111)
            return Response({"chat_id": new_chat.id}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class ChatMessageView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, chat_id):
        # Verify chat belongs to current user
        try:
            patient_obj = patient.objects.get(user=request.user)
            chat_obj = chat.objects.get(id=chat_id, user=patient_obj)
        except (patient.DoesNotExist, chat.DoesNotExist):
            return Response({"error": "Chat not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Get all messages for this chat
        messages = chatMessages.objects.filter(chat=chat_obj).order_by('created_at')
        
        messages_data = []
        for msg in messages:
            messages_data.append({
                'id': msg.id,
                'message': msg.message,
                'type': msg.type,
                'created_at': msg.created_at.strftime("%Y-%m-%d %H:%M")
            })
        
        return Response(messages_data)
    
    def post(self, request, chat_id):
        # Add a message to the chat and get AI response
        try:
            patient_obj = patient.objects.get(user=request.user)
            chat_obj = chat.objects.get(id=chat_id, user=patient_obj)
            
            user_message = request.data.get('message')
            if not user_message:
                return Response({"error": "Message is required"}, status=status.HTTP_400_BAD_REQUEST)
            
            # Save user message
            chatMessages.objects.create(
                chat=chat_obj,
                message=user_message,
                type='user'
            )
            
            # Get last 10 messages for context
            recent_messages = chatMessages.objects.filter(chat=chat_obj).order_by('-created_at')[:10]
            conversation_history = []
            
            for msg in reversed(list(recent_messages)):
                role = "user" if msg.type == "user" else "assistant"
                conversation_history.append({"role": role, "content": msg.message})
            
            # Call Groq API
            ai_response = self.get_ai_response(conversation_history)
            
            # Save AI response
            ai_message = chatMessages.objects.create(
                chat=chat_obj,
                message=ai_response,
                type='ai'
            )
            
            return Response({
                'user_message': {
                    'id': chatMessages.objects.filter(chat=chat_obj, type='user').latest('created_at').id,
                    'message': user_message,
                    'type': 'user',
                    'created_at': chatMessages.objects.filter(chat=chat_obj, type='user').latest('created_at').created_at.strftime("%Y-%m-%d %H:%M")
                },
                'ai_message': {
                    'id': ai_message.id,
                    'message': ai_response,
                    'type': 'ai',
                    'created_at': ai_message.created_at.strftime("%Y-%m-%d %H:%M")
                }
            })
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def get_ai_response(self, conversation_history):
    # Configure your Groq API call here
        GROQ_API_KEY = "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" # Store this in environment variables for security
        
        # If conversation is empty, initialize with a system message and welcome message
        if not conversation_history:
            system_message = {
                "role": "system",
                "content": "You are Dhoomkethu, a professional virtual doctor. Maintain a formal, medical professional tone. Provide clear and accurate medical information when possible, but always remind patients to seek in-person medical care for serious conditions. Never diagnose specific conditions without proper examination. Use medical terminology appropriately but explain concepts in patient-friendly language. Begin the conversation with a warm welcome introducing yourself as Dr. Dhoomkethu."
            }
            
            welcome_message = {
                "role": "assistant",
                "content": "Hello, I'm Dr. Dhoomkethu. Welcome to your virtual consultation. How may I assist you with your health concerns today?"
            }
            
            conversation_history = [system_message, welcome_message]
        # If conversation exists but doesn't have a system message, add it at the beginning
        elif conversation_history and conversation_history[0]["role"] != "system":
            system_message = {
                "role": "system",
                "content": "You are Dhoomkethu, a professional virtual doctor. Maintain a formal, medical professional tone. Provide clear and accurate medical information when possible, but always remind patients to seek in-person medical care for serious conditions. Never diagnose specific conditions without proper examination. Use medical terminology appropriately but explain concepts in patient-friendly language."
            }
            
            conversation_history.insert(0, system_message)
        
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": "llama3-70b-8192",  # or your preferred model
            "messages": conversation_history,
            "temperature": 0.7,
            "max_tokens": 1024
        }
        
        try:
            response = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=data
            )
            response_data = response.json()
            return response_data['choices'][0]['message']['content']
        except Exception as e:
            return f"I apologize, but I'm unable to respond at the moment. Please try again later."