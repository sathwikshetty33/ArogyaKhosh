import base64
import os
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
from django.conf import settings

class URLCrypto:
    def __init__(self, secret_key=None):
        self.key = (secret_key or settings.URL_HASH_SECRET).encode('utf-8')
        # Ensure key is 32 bytes (256 bits) for AES-256
        if len(self.key) < 32:
            self.key = self.key.ljust(32, b'\0')
        elif len(self.key) > 32:
            self.key = self.key[:32]

    def encrypt_url(self, url):
        """Encrypt a URL and return a URL-safe string"""
        # Generate a random 16-byte IV
        iv = os.urandom(16)
        
        # Create cipher object
        cipher = AES.new(self.key, AES.MODE_CBC, iv)
        
        # Encrypt the URL
        url_bytes = url.encode('utf-8')
        ciphertext = cipher.encrypt(pad(url_bytes, AES.block_size))
        
        # Combine IV and ciphertext and encode to base64
        encrypted_data = base64.urlsafe_b64encode(iv + ciphertext).decode('utf-8')
        
        return encrypted_data

    def decrypt_url(self, encrypted_data):
        """Decrypt a URL from an encrypted string"""
        try:
            # Decode the base64 string
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_data)
            
            # Extract IV (first 16 bytes) and ciphertext
            iv = encrypted_bytes[:16]
            ciphertext = encrypted_bytes[16:]
            
            # Create cipher object with the same IV
            cipher = AES.new(self.key, AES.MODE_CBC, iv)
            
            # Decrypt and unpad
            decrypted_bytes = unpad(cipher.decrypt(ciphertext), AES.block_size)
            
            # Convert back to string
            return decrypted_bytes.decode('utf-8')
            
        except Exception as e:
            raise ValueError(f"Failed to decrypt URL: {str(e)}")


def encrypt_url(url, secret_key=None):
    """
    Encrypts a URL using AES encryption
    Returns URL-safe base64 encoded string
    """
    crypto = URLCrypto(secret_key)
    return crypto.encrypt_url(url)


def decrypt_url(encrypted_data, secret_key=None):
    """
    Decrypts an encrypted URL string back to the original URL
    """
    crypto = URLCrypto(secret_key)
    return crypto.decrypt_url(encrypted_data)