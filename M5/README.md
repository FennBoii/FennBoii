<h3>M5 music download script</h3>

<h4>this script downloads music asyncronously using yt-dlp, ffmpeg, and few more packages!<h3>

<h4>dependencies are: yt-dlp, ffmpeg, ffprobe, jq, sudo -v, xdg-open, aaaaaand a custom script using eyeD3 and jq.

put the <u>custom script</u> in '/usr/bin/addURLTag' and make sure you can access it from a new terminal.

if you rename the custom script, MAKE SURE TO RENAME IT also in the M5 script, its close to the top. to get useage help, run the command with zero inputs!

<h2>extra</h2>

WARNING

This script may break and NOT work if you DO use a VPN. Change your location to different places until you find a proper location where you can download the album. THIS ONLY AFFECTS YT-DLP AS ITS DOWNLOADING THE ALBUM. KEEP THIS IN MIND.

IF YOU DO re-download the same album, DELETE THE OLD FOLDER. this script moves the new downloded folder into the same folder of where the original is again but inside of it again. so it can become:

```
~/Music/heylog/Single - hair$ tree
.
├── Album - hair.jpg
├── hair.mp3
├── hair.webp
├── playlist_metadata.json
└── Single - hair
    ├── Album - hair.jpg
    ├── hair.mp3
    ├── hair.webp
    └── playlist_metadata.json
```

keep this in mind.

i added an extra script in here that is SUPER helpful! once you run M5 it sometimes DOES put the image in the mp3 or whatever format BUT it seems that the image is in a rectangle or doesnt even fully look square. thats where THIS script comes in! just run: `reCoverImage -t [mp3] [Album -.jpg]` this will take that one image you find and replace ALL of that same type in the same folder with that same image. THE IMAGE IS GENERATED IN THE SAME FOLDER THANKS TO yt-dlp. an example image could be named: 
`Album - hair.jpg`