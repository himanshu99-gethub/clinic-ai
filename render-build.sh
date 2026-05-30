#!/usr/bin/env bash
# exit on error
set -o errexit

STORAGE_DIR=/opt/render/project/.render

# Create cache directory if it doesn't exist
mkdir -p $STORAGE_DIR

# Download Chrome if not present in the cache
if [[ ! -d $STORAGE_DIR/chrome ]]; then
  echo "...Downloading Google Chrome"
  mkdir -p $STORAGE_DIR/chrome
  cd $STORAGE_DIR/chrome
  wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  dpkg -x google-chrome-stable_current_amd64.deb $STORAGE_DIR/chrome
  rm google-chrome-stable_current_amd64.deb
  cd /opt/render/project/src
else
  echo "...Using Chrome from cache"
fi

# Install Python requirements
echo "...Installing Python dependencies"
pip install -r requirements.txt

# Frontend files are pre-built and committed to Git under frontend/dist, so no npm build is required on Render.

echo "✓ Build script completed successfully!"
