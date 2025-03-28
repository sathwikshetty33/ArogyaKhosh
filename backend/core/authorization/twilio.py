from twilio.rest import Client
from django.conf import settings

def send_twilio_message(to_number, message_body):
    account_sid = settings.account_sid
    auth_token = settings.auth_token
    from_number = '+14155238886'
    
    client = Client(account_sid, auth_token)
    
    try:
        message = client.messages.create(
            body=message_body,
            from_=from_number,
            to='whatsapp:'+to_number
        )
        return True
    except Exception as e:
        print(f"Error sending Twilio message: {e}")
        return False