import cv2
import numpy as np
from pythonosc import udp_client
import json
import os

# --- OSC SETUP ---
client = udp_client.SimpleUDPClient("127.0.0.1", 9000)
FT = "/FT/"
def P(name): return f"/avatar/parameters{FT}v2/{name}"
ADDR_DIL = P("PupilDilation")

# --- CONFIG LOADING/SAVING ---
CONFIG_FILE = "dilation_calib.json"

def save_config(data):
    with open(CONFIG_FILE, 'w') as f:
        json.dump(data, f)

if os.path.exists(CONFIG_FILE):
    with open(CONFIG_FILE, 'r') as f:
        cal = json.load(f)
    print("Loaded saved Dilation settings!")
else:
    # Default fallback values
    cal = {"min_area": 100.0, "max_area": 1000.0}
    print("No save file found. Using defaults.")

# --- SETTINGS ---
DIL_THRESHOLD = 25
TOP_CROP, BOTTOM_CROP, SIDE_CROP = 60, 20, 30
DIL_SMOOTH = 0.1  # Lower = slower/more organic
last_dil = 0.5

def get_dilation_area(frame, window_name):
    if frame is None: return None
    
    # 1. CROP
    h, w = frame.shape[:2]
    crop = frame[TOP_CROP : h - BOTTOM_CROP, SIDE_CROP : w - SIDE_CROP]
    
    # 2. PROCESSING (Deep Threshold for Pupil Core)
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (11, 11), 0)
    _, thresh = cv2.threshold(blur, DIL_THRESHOLD, 255, cv2.THRESH_BINARY_INV)
    
    # 3. CLEANUP
    kernel = np.ones((5,5), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    
    # 4. AREA
    area = cv2.countNonZero(thresh)
    
    # Visual Feedback
    debug_view = cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)
    cv2.putText(debug_view, f"Area: {area}", (10, 30), 1, 1, (0, 255, 0), 1)
    cv2.imshow(window_name, debug_view)
    
    return area if area > 10 else None

cap_l = cv2.VideoCapture("http://127.0.0.1:4442/left")
cap_r = cv2.VideoCapture("http://127.0.0.1:4442/right")

print("\n--- DILATION ONLY CONTROLS ---")
print("G: Set Small Pupil (Bright Light)")
print("B: Set Big Pupil (Darkness)")
print("Q: Quit")

while True:
    ret_l, frame_l = cap_l.read()
    ret_r, frame_r = cap_r.read()

    if ret_l and ret_r:
        a_l = get_dilation_area(frame_l, "L Dilation")
        a_r = get_dilation_area(frame_r, "R Dilation")
        
        if a_l and a_r:
            avg_area = (a_l + a_r) / 2
            
            key = cv2.waitKey(1)
            # --- CALIBRATE & AUTO-SAVE ---
            if key == ord('g'):
                cal["min_area"] = avg_area
                save_config(cal)
                print(f"SAVED SMALL: {avg_area}")
            if key == ord('b'):
                cal["max_area"] = avg_area
                save_config(cal)
                print(f"SAVED BIG: {avg_area}")

            # --- MATH ---
            denom = max(1, cal["max_area"] - cal["min_area"])
            target = np.clip((avg_area - cal["min_area"]) / denom, 0.0, 1.0)
            
            # Smooth interpolation
            last_dil += (target - last_dil) * DIL_SMOOTH
            
            client.send_message(ADDR_DIL, float(round(last_dil, 3)))

    if cv2.waitKey(1) == ord('q'): break

cap_l.release()
cv2.destroyAllWindows()