#!/bin/bash
# setup-url-hash.sh - Script to set up URL hash secret key for Django

# Default locations - override these with environment variables if needed
SETTINGS_FILE="${DJANGO_SETTINGS_PATH:-$(pwd)/settings.py}"
ENV_FILE="${DJANGO_ENV_FILE:-$(pwd)/../.env}"

# Function to generate a new secret key
generate_new_key() {
  openssl rand -hex 32
}

# Check if URL_HASH_SECRET is already in the environment
if [ -n "$URL_HASH_SECRET" ]; then
  echo "Using existing URL_HASH_SECRET from environment"
  HASH_SECRET="$URL_HASH_SECRET"
else
  # Generate a new key
  HASH_SECRET=$(generate_new_key)
  echo "Generated new URL_HASH_SECRET"
  
  # Export it for this session
  export URL_HASH_SECRET="$HASH_SECRET"
fi

# Always show the current key (useful for manual configuration)
echo "URL_HASH_SECRET=$HASH_SECRET"

# Try to save to configuration files
if [ -f "$ENV_FILE" ]; then
  # Check if URL_HASH_SECRET already exists in the env file
  if grep -q "^URL_HASH_SECRET=" "$ENV_FILE"; then
    # Replace existing value
    sed -i "s/^URL_HASH_SECRET=.*/URL_HASH_SECRET=$HASH_SECRET/" "$ENV_FILE"
  else
    # Add new value
    echo "URL_HASH_SECRET=$HASH_SECRET" >> "$ENV_FILE"
  fi
  echo "Updated URL_HASH_SECRET in $ENV_FILE"
elif [ -f "$SETTINGS_FILE" ]; then
  # Check if URL_HASH_SECRET already exists in the settings file
  if grep -q "URL_HASH_SECRET = " "$SETTINGS_FILE"; then
    # Replace existing value
    sed -i "s/URL_HASH_SECRET = .*/URL_HASH_SECRET = '$HASH_SECRET'/" "$SETTINGS_FILE"
  else
    # Add new value before the last line
    sed -i "$ i\URL_HASH_SECRET = '$HASH_SECRET'" "$SETTINGS_FILE"
  fi
  echo "Updated URL_HASH_SECRET in $SETTINGS_FILE"
else
  echo "Warning: Neither settings file nor .env file found at the default paths."
  echo "The secret key is available in the URL_HASH_SECRET environment variable for this session."
  echo ""
  echo "To save it permanently, create either file and add:"
  echo "In .env:    URL_HASH_SECRET=$HASH_SECRET"
  echo "In settings.py: URL_HASH_SECRET = '$HASH_SECRET'"
fi
