import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Message
from .tasks import broadcast_message

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = 'community_chat'

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # Receive message from WebSocket
    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message = text_data_json['message']

        # Save message to database
        saved_message = await self.save_message(message)
        
        # Send message to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': message,
                'message_id': str(saved_message.id),
                'timestamp': saved_message.created_at.isoformat()
            }
        )

    # Receive message from room group
    async def chat_message(self, event):
        message = event['message']
        message_id = event['message_id']
        timestamp = event['timestamp']

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'message': message,
            'message_id': message_id,
            'timestamp': timestamp
        }))

    @database_sync_to_async
    def save_message(self, message):
        new_message = Message.objects.create(content=message)
        # Trigger Celery task for additional processing if needed
        broadcast_message.delay(str(new_message.id))
        return new_message
