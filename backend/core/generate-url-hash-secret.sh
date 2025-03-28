#!/bin/bash

SETTINGS_FILE="${DJANGO_SETTINGS_PATH:-$(pwd)/settings.py}"
ENV_FILE="${DJANGO_ENV_FILE:-$(pwd)/../.env}"

generate_new_key() {
  openssl rand -hex 32
}


if [ -n "$URL_HASH_SECRET" ]; then
  echo "Using existing URL_HASH_SECRET from environment"
  HASH_SECRET="$URL_HASH_SECRET"
else
  HASH_SECRET=$(generate_new_key)
  echo "Generated new URL_HASH_SECRET"
  
  export URL_HASH_SECRET="$HASH_SECRET"
fi


echo "URL_HASH_SECRET=$HASH_SECRET"


if [ -f "$ENV_FILE" ]; then

  if grep -q "^URL_HASH_SECRET=" "$ENV_FILE"; then

    sed -i "s/^URL_HASH_SECRET=.*/URL_HASH_SECRET=$HASH_SECRET/" "$ENV_FILE"
  else

    echo "URL_HASH_SECRET=$HASH_SECRET" >> "$ENV_FILE"
  fi
  echo "Updated URL_HASH_SECRET in $ENV_FILE"
elif [ -f "$SETTINGS_FILE" ]; then
  if grep -q "URL_HASH_SECRET = " "$SETTINGS_FILE"; then
    sed -i "s/URL_HASH_SECRET = .*/URL_HASH_SECRET = '$HASH_SECRET'/" "$SETTINGS_FILE"
  else
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
