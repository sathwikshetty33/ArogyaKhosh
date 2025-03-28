import base64
import os
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
from django.conf import settings

class URLCrypto:
    def __init__(self, secret_key=None):
        self.key = (secret_key or settings.URL_HASH_SECRET).encode('utf-8')
        if len(self.key) < 32:
            self.key = self.key.ljust(32, b'\0')
        elif len(self.key) > 32:
            self.key = self.key[:32]

    def encrypt_url(self, url):
        iv = os.urandom(16)
        
        cipher = AES.new(self.key, AES.MODE_CBC, iv)
        
        url_bytes = url.encode('utf-8')
        ciphertext = cipher.encrypt(pad(url_bytes, AES.block_size))
        
        encrypted_data = base64.urlsafe_b64encode(iv + ciphertext).decode('utf-8')
        
        return encrypted_data

    def decrypt_url(self, encrypted_data):
        try:
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_data)
            
            iv = encrypted_bytes[:16]
            ciphertext = encrypted_bytes[16:]
            
            cipher = AES.new(self.key, AES.MODE_CBC, iv)
            
            decrypted_bytes = unpad(cipher.decrypt(ciphertext), AES.block_size)
            
            return decrypted_bytes.decode('utf-8')
            
        except Exception as e:
            raise ValueError(f"Failed to decrypt URL: {str(e)}")


def encrypt_url(url, secret_key=None):

    crypto = URLCrypto(secret_key)
    return crypto.encrypt_url(url)


def decrypt_url(encrypted_data, secret_key=None):

    crypto = URLCrypto(secret_key)
    return crypto.decrypt_url(encrypted_data)