#!/usr/bin/env bash

# Script: readdCoverArt
# Purpose: Reset cover art on all MP3s in current directory
# Looks for: ./reCover.png

# The image is the 1st argument, the extension is the 2nd
IMAGE="$1"
defaultType="$2"

if [[ -z "$1" ]]; then
    echo "you didnt add a file silly"
    echo "add a type:"
    echo ""
    echo "reCoverArt image.png mp3" 
    exit 1
fi

if [[ -z "$2" ]]; then
    echo "please add a type floof!:"
    echo ""
    echo "reCoverArt -t mp3 || flac || etc.." 
    echo ""
    echo "if you'd like to set a default value edit the script!"
    # To use a hardcoded default, uncomment the line below:
    # defaultType="mp3"
    
    # We only exit if defaultType is STILL empty after checking the hardcoded line
    if [[ -z "$defaultType" ]]; then exit 1; fi
fi

echo "outputType: '"$defaultType"'"

shopt -s nullglob

files=(*."$defaultType")
if [ ${#files[@]} -eq 0 ]; then 
    echo "type ($defaultType) doesnt exist here silly"
fi

for f in *."$defaultType"; do

    eyeD3 --remove-all-images "$f"
    eyeD3 --add-image "$IMAGE:FRONT_COVER" "$f"
    echo "uwu"
done

shopt -u nullglob
