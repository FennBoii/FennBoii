<h1>vive pro eye tracking with opencv AND reVision!</h1>
sadly face tracking doesnt exist here BUT you can get babble!: https://babble.diy/
(might make a script that works with it too and put it here.)
<br />
<br />
reVision github project!: https://github.com/Blue-Doggo/ReVision

THANK YOU BLUE-DOGGO FOR THIS REPO! I COULDN'T HAVE DONE THIS WITHOUT YOU <3

<h4>hehh sorry i just LOVE this project and it was fun to make and see working! yeah there are a few flaws but in due time they will be fixed. lets start off by mentioning what this script <u>DOES</u> and <u>IS</u>:</h4>

<h3>description:</h3>

this script captures your eyes from your vive pro eye headset and translates them from images to positions for your osc application needs! HUGE thanks for Blue-Doggo for this repo. it was like 60% of the whole project and to be honest i dont really know how it works.

The whole reason WHY i made 3 different script is because each one captures something different AND if i were to merge them they would only bet capturing from ONE KIND of camera stream which would be inefficnet and would also break some of these. <br />
for example eyeBlink and eyeDilation both use greyscale while eyeMovement uses color of sorts. so technically those could be merged but i prefer to have more control for each script.

<h3>scripts</h3>

<h4>[ eyeMovement.py ]

<br />
functionality:
- gets your eye movment from left and right.
- gets your eye movement from up and down.

lacking: actually this is really nice to use! except that when you look left and right, up and down, it doesnt translate that value to fully left or fully right. same for up and down. works well though!

this script is SIMPLY a movement catcher, tracking x AND y but NOT z though hehh, your eyes dont pop out silly.

instructions: you must set the center for your eye as if its offset your eyes will be offset!

setting center (center as in reset current position AS 0) - z

(can only set these by selecting the window)

<hr />

<h4>[ eyeBlink.py ]

<br />
functionality:
- gets your eye close-ness.
- sets your eye as closed beyond a certain threshold (0.10)

lacking: precision, it gets the job done well! but not very well.

this script is SIMPLY checking if your eye is closed and WHEN it is close to fully closed.

instructions: you must set the times your eye is CLOSED and OPENED, this will create a custom range for you!

setting opened eye - x
setting closed eye - z

(can only set these by selecting the window)

<hr />

<h4>[ eyeDilation.py ]

<br />
functionality:
- gets your eye pupil dilation. i think this is REALLY cute especially if you set the diameter to something where your eye gets big when the light isnt around. suuuuper cute.

lacking: eye diameter is more unseen after your eye closes so its harder to calculate but DOES reset after you blink or open your eye again.

this script is SIMPLY checking the diameter of your pupul.

instructions: you must set the threshold by looking at something super bright and something super dark.

setting big pupil (NO LIGHT AT ALL) - z
setting small pupil (STRONG LIGHT) - x

(can only set these by selecting the window)

<hr />

<h3>setup</h3>

how to setup full project!

run the reVision package locally! once you see something like this:


```[11:49:00 INF] Loaded ReVision.Vive.VivePlugin
[11:49:00 INF] Loaded ReVision.EyeDevice.EyeDevicePlugin
[11:49:00 INF] Using image provider ReVision.EyeDevice.EyeDevicePlugin
 11:49:00.573 INF >> [WebServer] Running HTTPListener: Microsoft HTTP Listener
 11:49:00.594 INF >> [WebServer] Web server prefix 'http://127.0.0.1:4442/' added.
 11:49:00.622 INF >> WebServer New State - Loading
 11:49:00.626 INF >> [WebServer] Started HTTP Listener
 11:49:00.626 INF >> WebServer New State - Listening
[11:49:00 INF] Loaded ReVision.MJPEG.MJPEGPlugin
[11:49:00 INF] Using image streamer ReVision.MJPEG.MJPEGPlugin
```
this is great news! but now, when a device is added like:<br />

```VRU02-5A0B3AX00314```

this is PERFECT! it means it loaded properly! <br />
(this may or may not be helpful but when i was first getting started with this i needed to "touch" my lenses to enable eye tracking for some reason. try this if its not showing up.)

fun thing to do is to go the local port on your browser and touch the lenses to see it live hehe this was fun: LEFT: `http://127.0.0.1:4442/left` or RIGHT: `http://127.0.0.1:4442/right`

then all you have to do is setup the virtual environment with python3! 

clone this folder. move into it.

source it by running:

`source venv/bin/activate`

(you will have to source this file EVERY TIME you run these scripts.) <br />
(dependencies are "python-osc, numpy, and opencv-python")

now simply run those scripts with vrchat open or resonite or whatever your use is. have fun!

remember! you'll need to click on the "view" that is created when you run each of these scripts (left OR right window) to set the values using z or x! i like to move both of the view windows over the terminal i run it from so i know where each one goes.

have fun floof!