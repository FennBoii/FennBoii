import cv2
import time

# Use /dev/video0
cap = cv2.VideoCapture(0, cv2.CAP_V4L2)

# IMPORTANT: The tracker often fails to start if the resolution isn't exactly right
# It usually wants 960x640 (split) or 480x480
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 960)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 640)

print("Starting camera... if the feed is black, the IR LEDs are off.")
time.sleep(2) # Give the hardware a second to power the LEDs

while True:
    ret, frame = cap.read()
    if not ret:
        print("Wait... trying to grab frame again...")
        continue

    # If it's too dark, we can artificially brighten it to see if there's ANY image
    debug_frame = cv2.convertScaleAbs(frame, alpha=1.5, beta=50)

    cv2.imshow('Vive Face Tracker (Press Q to quit)', debug_frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()