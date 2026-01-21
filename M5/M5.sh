#!/bin/bash

# CALL VARIABLES

SOURCE_URL="$1"
TYPE="$2"
FINAL_DIR="$3"
lineFour="$4"
lineFive="$5"
lineSix="$6"
CHECKCOUNT=""
openDirAfter=0


# CONFIG lOCATION

# will ask if you want to double-check input
# input values below are "0"-false or "1"-true
comformationPrompt=0

# output format
audioFormat=""

# directory where addURLTag is located
# exanple dir: "/usr/bin/addURLTag"
addURLTagLocation="/usr/bin/addURLTag"

# directory where you want to put the final created folder
# example dir: "/home/user/Music/"
dirLocation="/home/nulxhor/Music/"


if [[ -z "$dirLocation" ]]; then
    echo "SET A FINAL DIR LOCATION. EDIT THE SCRIPT"
    exit 0
fi



if [[ "$lineFour" == "-t" ]]; then
    audioFormat="$5"
fi

if [[ "$lineFive" == "-t" ]]; then
    audioFormat="$6"
fi

if [[ "$lineSix" == "-t" ]]; then
    audioFormat="$7"
fi


if [[ "$lineFour" == "-o" ]]; then
    openDirAfter=1
    echo "[Extra] will open directory when finished"
fi

if [[ "$lineFive" == "-o" ]]; then
    openDirAfter=1
    echo "[Extra] will open directory when finished"
fi

if [[ "$lineSix" == "-o" ]]; then
    openDirAfter=1
    echo "[Extra] will open directory when finished"
fi



if [[ "$TYPE" == "help" || "$TYPE" == "-help" || "$TYPE" == "--help" ]] \
   || [[ -z "$TYPE" || -z "$SOURCE_URL" || -z "$FINAL_DIR" ]]; then
    cat << EOF
Usage: M5 <url> <type> <artist> [options]

ARGUMENTS:
  <url>      YouTube Music link (Wrap in "quotes")
  <type>     Type of release: Single, EP, or Album
  <artist>   Artist name (Wrap in "quotes" if it has spaces)

OPTIONS:
  -t <ext>   REQUIRED: Specify file format (flac, mp3, etc.)
             (To set a permanent default, edit the M5 script)
  -o         Open the destination folder after download

EXAMPLES:
  M5 "https://music.youtube.com..." Album "nothing, nowhere"
  M5 "https://music.youtube.com..." Single keshi -t mp3 -o

Note: Options -t and -o can be used in any order at the end.
EOF
    exit 0
fi

if [[ -z "$TYPE" ]]; then
    echo "-- ERROR - ALBUM TYPES: 'Album | Single | EP' --"
    exit
fi

if [[ -z "$FINAL_DIR" ]]; then
    echo "-- ERROR - FINAL_DIR UNDEFINED --"
    exit
fi

case "$TYPE" in
    Album|Single|EP) ;;
    *) 
        echo "-- ERROR - INVALID ALBUM TYPE: '$TYPE'. PLEASE USE: 'Album | Single | EP' --"
        exit
        ;;
esac

if [[ -z "$audioFormat" ]]; then
    echo "please set an audioFormat!"
    echo "if you'd like to set a default, find this line and comment out the bottom line in this script"
    echo ""
    echo "how to set example:"
    echo "-t \"mp3\" OR -t \"flac\""
    echo ""
    echo "in a full example:"
    echo "M5 \"https://music.youtube.com/playlist?list=OLAK5uy_njhMKBnoa0tKJC2-t25rwuv1UZdD7Y7z0&si=7LjwUIqO8smRG77U\" Album \"nothing, nowhere\" -t mp3"
    echo "simpler:"
    echo "M5 [url] [Album/Single/EP] [aritst] [options: -t mp3/flac/etc.. || -o]"
    # audioFormat="mp3"
    exit
fi


echo "[Song Information] Artist: $FINAL_DIR"
echo "[Song Information] Type: $TYPE"
echo "[Song Information] saveDirectory: '$dirLocation$FINAL_DIR'"
echo "[Song Information] audioFormat: .$audioFormat"
echo "this looks okay right? right?!"

if [[ "$comformationPrompt" = 1 ]]; then

    read -r -p "does this look correct? (y/Y)-(n/N):" inputDir

    if [[ "$inputDir" == "Y" || "$inputDir" == "y" ]]; then
        echo "[valid input] Continuing service"
    else
        echo "[invalid input] Stopping service"
        echo "(you can disable this check)"
        exit
    fi
fi


# ensure target directory exists
mkdir -p "$dirLocation$FINAL_DIR" || { echo "Failed to create directory"; return 1; }
cd "$dirLocation$FINAL_DIR" || { echo "Failed to cd into directory"; return 1; }

# sudo echo "[sudo] sudo (check 1) is enabled" # logging
echo "please administrate us!"
sudo -v # no logging
echo "thanks for administring us!"

# seperation -----


TOTAL_TRACKS=$(yt-dlp --flat-playlist --get-id "$SOURCE_URL" | wc -l)
declare -A URLMAP

while IFS= read -r line; do
    if [[ "$line" =~ "Destination: " ]]; then
        FILE=$(echo "$line" | sed 's/.*Destination: //')
        FILE=$(basename "$FILE")
        URLMAP["$FILE"]="$LAST_URL"
    fi
    if [[ "$line" =~ "https://www.youtube.com/watch" ]]; then
        LAST_URL="$line"
    fi
    echo "$line"
done < <(
    yt-dlp -f "bestaudio" \
        --write-thumbnail \
        --yes-playlist \
        --write-playlist-metafiles \
        --extract-audio \
        --audio-format "$audioFormat" \
        --audio-quality 0 \
        --embed-metadata \
        --embed-thumbnail \
        -o "%(playlist_title)s/%(playlist_index)02d - %(title)s.%(ext)s" \
        "$SOURCE_URL"
)

PLAYLIST_DIR=$(yt-dlp --get-filename -o "%(playlist_title)s" "$SOURCE_URL" | head -n 1)

CLEAN_PLAYLIST_DIR=$(echo "$PLAYLIST_DIR" | sed -E 's/^(Album|Single|EP) - //')
NEW_DIR="${TYPE} - ${CLEAN_PLAYLIST_DIR}"

if [[ "$PLAYLIST_DIR" != "$NEW_DIR" ]]; then
    mv "$PLAYLIST_DIR" "$NEW_DIR"
fi
PLAYLIST_DIR="$NEW_DIR"

sudo chown -R nulxhor:nulxhor "$dirLocation"*

sudo echo "[sudo] sudo (check $CHECKCOUNT) still enabled"
((CHECKCOUNT++))

case "$audioFormat" in
    mp3)
        FF_CODEC="-acodec libmp3lame -aq 0"
        FF_TAGS="-id3v2_version 3 -write_id3v1 1"
        ;;
    flac)
        FF_CODEC="-c:a flac"
        FF_TAGS="-map_metadata 0"
        ;;
    opus)
        FF_CODEC="-c:a libopus -b:a 192k"
        FF_TAGS="-map_metadata 0"
        ;;
    aac|m4a)
        FF_CODEC="-c:a aac -b:a 256k"
        FF_TAGS="-map_metadata 0"
        ;;
    *)
        echo "Unsupported audio format: $audioFormat"
        exit 1
        ;;
esac

for FILE in "$PLAYLIST_DIR"/*.${audioFormat}; do
    BASENAME=$(basename "$FILE")
    TRACKNUM=$(echo "$BASENAME" | cut -d'-' -f1 | tr -d ' ')
    TRACK_URL="${URLMAP[$BASENAME]}"
    [[ -z "$TRACK_URL" ]] && TRACK_URL="$SOURCE_URL"

    ffmpeg -i "$FILE" \
        $FF_CODEC \
        -metadata track="$TRACKNUM/$TOTAL_TRACKS" \
        -metadata comment="$TRACK_URL" \
        -metadata purl="$TRACK_URL" \
        $FF_TAGS \
        "${FILE%.${audioFormat}}_tmp.${audioFormat}" \
    && mv "${FILE%.${audioFormat}}_tmp.${audioFormat}" "$FILE"
done

# this make sure no symbols are in the filename.
for FILE in "$PLAYLIST_DIR"/*; do
    BASE=$(basename "$FILE")
    NEW=$(echo "$BASE" | sed -E 's/^[0-9]{2} - //')
    [[ "$NEW" != "$BASE" ]] && mv "$FILE" "$PLAYLIST_DIR/$NEW"
done

# writing the json file. SUPER USEFUL.
JSON_FILE="$PLAYLIST_DIR/playlist_metadata.json"
echo "[" > "$JSON_FILE"

FIRST=true
for FILE in "$PLAYLIST_DIR"/*.${audioFormat}; do
    BASENAME=$(basename "$FILE")
    TRACKNUM=$(echo "$BASENAME" | cut -d'-' -f1 | tr -d ' ')
    TRACK_URL="${URLMAP[$BASENAME]}"
    [[ -z "$TRACK_URL" ]] && TRACK_URL="$SOURCE_URL"

    METADATA=$(ffprobe -v quiet -print_format json -show_format "$FILE" | jq '.format.tags')

    [[ "$FIRST" == true ]] && FIRST=false || echo "," >> "$JSON_FILE"

    jq -n \
        --arg file "$BASENAME" \
        --arg track "$TRACKNUM/$TOTAL_TRACKS" \
        --arg url "$SOURCE_URL" \
        --argjson ffmetadata "$METADATA" \
        '{file: $file, track: $track, url: $url, ffmetadata: $ffmetadata}' >> "$JSON_FILE"
done
echo "]" >> "$JSON_FILE"

cd "$PLAYLIST_DIR" || exit
bash "$addURLTagLocation"
cd ..

if [[ -n "$FINAL_DIR" ]]; then
    mkdir -p "$dirLocation$FINAL_DIR"
    mv "$PLAYLIST_DIR" "$dirLocation$FINAL_DIR"
    echo "Moved $PLAYLIST_DIR to $FINAL_DIR/"
fi

if [[ "$openDirAfter" == "1" || "$openDirAfter" == 1 ]]; then
    xdg-open "$dirLocation$FINAL_DIR"
    echo "----------------------------------------"
    echo "opened folder for u! thanks for using M5!"
else
    echo "----------------------------------------"
    echo "thanks for using M5!"
fi