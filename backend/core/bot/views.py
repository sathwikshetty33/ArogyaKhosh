from django.conf import settings
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

# Updated Langchain imports
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_groq import ChatGroq  # Correct import for Groq
from langchain.schema import SystemMessage, HumanMessage, AIMessage
from langchain.text_splitter import CharacterTextSplitter
from langchain_community.document_loaders import TextLoader
from langchain.memory import ConversationBufferMemory

# Constants
GROQ_API_KEY = settings.GROQ_API_KEY# Should be in environment variables


def initialize_rag_system(documents_path="medical_knowledge_base/"):
    """Initialize the RAG system with medical documents"""
    try:
        # Load documents - replace with your actual document loading logic
        text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        # This is a placeholder - you'd need to implement actual document loading
        # Example: documents = TextLoader(documents_path).load_and_split(text_splitter)
        
        # For demo purposes, we'll create a simple document list
        documents = [
            "Common cold: Symptoms include runny nose, sore throat, cough, and mild fever.",
            "Hypertension: High blood pressure, often asymptomatic but can lead to heart disease.",
            "Diabetes: A condition characterized by high blood glucose levels.",
            # Add more medical information as needed
        ]
        
        # Convert to Langchain document format
        from langchain.schema import Document
        docs = [Document(page_content=text) for text in documents]
        
        # Create embeddings and vector store
        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        vector_store = FAISS.from_documents(docs, embeddings)
        
        return vector_store
    except Exception as e:
        print(f"Error initializing RAG system: {e}")
        return None

# Initialize vector store
vector_store = initialize_rag_system()

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
            
            # Add welcome message from Dr. Dhoomkethu
            welcome_message = "Hello, I'm Dr. Dhoomkethu. Welcome to your virtual consultation. How may I assist you with your health concerns today?"
            
            # Create the first message in the chat
            chat_message = chatMessages.objects.create(
                chat=new_chat,
                type="ai",
                message=welcome_message,
            )
            
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
            
            # Convert to langchain message format
            langchain_messages = []
            for msg in reversed(list(recent_messages)):
                if msg.type == "user":
                    langchain_messages.append(HumanMessage(content=msg.message))
                else:
                    langchain_messages.append(AIMessage(content=msg.message))
            
            # Get patient summary for context
            patient_summary = patient_obj.summary
            
            # Get AI response using RAG
            ai_response = self.get_rag_response(user_message, langchain_messages, patient_summary)
            
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
    
    def get_rag_response(self, query, conversation_history, patient_summary):
        """Use RAG to generate a response based on the query and retrieved documents"""
        try:
            # Create system message with patient context
            system_message = SystemMessage(
                content=f"You are Dhoomkethu, a professional virtual doctor. Maintain a formal, medical professional tone. "
                        f"Provide clear and accurate medical information when possible, but always remind patients to seek "
                        f"in-person medical care for serious conditions. Never diagnose specific conditions without proper examination. "
                        f"Use medical terminology appropriately but explain concepts in patient-friendly language. "
                        f"This contains the brief context of the patient's health: {patient_summary}"
            )
            
            # If vector store is available, use RAG
            if vector_store:
                # Retrieve relevant documents
                retriever = vector_store.as_retriever(search_kwargs={"k": 3})
                relevant_docs = retriever.get_relevant_documents(query)
                
                # Extract the content from relevant documents
                retrieved_content = "\n".join([doc.page_content for doc in relevant_docs])
                
                # Add retrieved context to the prompt
                context_message = SystemMessage(
                    content=f"Based on medical literature, here is some relevant information that might help with your response: {retrieved_content}"
                )
                
                # Combine messages: system message, context, conversation history
                messages = [system_message, context_message] + conversation_history
            else:
                # Fallback if vector store is not available
                messages = [system_message] + conversation_history
            
            # Initialize the Groq chat model
            chat_model = ChatGroq(
                api_key=GROQ_API_KEY,
                model_name="llama3-70b-8192",
                temperature=0.7,
                max_tokens=1024
            )
            
            # Generate response
            response = chat_model.invoke(messages)
            return response.content
        
        except Exception as e:
            print(f"Error in RAG response generation: {e}")
            return "I apologize, but I'm unable to respond at the moment. Please try again later."