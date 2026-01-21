import cv2
import numpy as np
from pythonosc import udp_client
import json
import os

# --- OSC SETUP ---
client = udp_client.SimpleUDPClient("127.0.0.1", 9000)
FT = "/FT/"
def P(name): return f"/avatar/parameters{FT}v2/{name}"

ADDR = {
    "LID_L": P("EyeLidLeft"), "LID_R": P("EyeLidRight"),
    "SQ_L":  P("EyeSquintLeft"), "SQ_R":  P("EyeSquintRight")
}

# --- CONFIG LOADING/SAVING ---
CONFIG_FILE = "lid_area_calib.json"

def save_config(data):
    with open(CONFIG_FILE, 'w') as f:
        json.dump(data, f)

# Load existing calibration or use defaults
if os.path.exists(CONFIG_FILE):
    with open(CONFIG_FILE, 'r') as f:
        calib = json.load(f)
    print("Loaded saved Eyelid Area calibration!")
else:
    calib = {
        "area_open_l": 500, "area_open_r": 500,
        "area_closed_l": 10, "area_closed_r": 10
    }
    print("No save file found. Using default area values.")

# --- SETTINGS ---
THRESHOLD_VAL = 45 
TOP_CROP, BOTTOM_CROP, SIDE_CROP = 60, 20, 30
DENOISE_STRENGTH = 3 
LID_SMOOTHING = 0.15 

last_lid_l, last_lid_r = 1.0, 1.0

def get_pupil_area(frame, window_name, is_left=True):
    if frame is None: return 0
    
    # 1. CROP
    h, w = frame.shape[:2]
    crop_frame = frame[TOP_CROP : h - BOTTOM_CROP, SIDE_CROP : w - SIDE_CROP]
    
    # 2. PROCESSING
    gray = cv2.cvtColor(crop_frame, cv2.COLOR_BGR2GRAY)
    blur = cv2.medianBlur(gray, DENOISE_STRENGTH)
    _, thresh = cv2.threshold(blur, THRESHOLD_VAL, 255, cv2.THRESH_BINARY_INV)
    
    kernel = np.ones((3,3), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
    
    # 3. AREA CALCULATION
    white_pixels = cv2.countNonZero(thresh)
    
    # Debug View
    debug_view = cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)
    cv2.putText(debug_view, f"Area: {white_pixels}", (10, 20), 1, 1, (0, 255, 0), 1)
    
    # Show current calibration range on screen
    o_val = calib["area_open_l"] if is_left else calib["area_open_r"]
    c_val = calib["area_closed_l"] if is_left else calib["area_closed_r"]
    cv2.putText(debug_view, f"O:{o_val} C:{c_val}", (10, 40), 1, 0.8, (255, 255, 0), 1)
    
    cv2.imshow(window_name, debug_view)
    return white_pixels

cap_l = cv2.VideoCapture("http://127.0.0.1:4442/left")
cap_r = cv2.VideoCapture("http://127.0.0.1:4442/right")

print("\n--- PERSISTENT EYELID CONTROLS ---")
print("C: Calibrate OPEN  (Saves to file)")
print("X: Calibrate CLOSED (Saves to file)")
print("Q: Quit")

while True:
    ret_l, frame_l = cap_l.read()
    ret_r, frame_r = cap_r.read()

    if ret_l and ret_r:
        area_l = get_pupil_area(frame_l, "L Eyelid Area", is_left=True)
        area_r = get_pupil_area(frame_r, "R Eyelid Area", is_left=False)
        
        key = cv2.waitKey(1)
        
        # --- CALIBRATE & AUTO-SAVE ---
        if key == ord('c'):
            calib["area_open_l"], calib["area_open_r"] = area_l, area_r
            save_config(calib)
            print(f"SAVED OPEN: L:{area_l} R:{area_r}")
        if key == ord('x'):
            calib["area_closed_l"], calib["area_closed_r"] = area_l, area_r
            save_config(calib)
            print(f"SAVED CLOSED: L:{area_l} R:{area_r}")

        # --- PERCENTAGE CALCULATION ---
        def get_openness(current, open_a, closed_a):
            denom = max(1, (open_a - closed_a))
            percentage = (current - closed_a) / denom
            return np.clip(percentage, 0.0, 1.0)

        target_l = get_openness(area_l, calib["area_open_l"], calib["area_closed_l"])
        target_r = get_openness(area_r, calib["area_open_r"], calib["area_closed_r"])

        # Hard Seal (The Squint Trigger)
        if target_l < 0.1: target_l = 0.0
        if target_r < 0.1: target_r = 0.0

        # Smoothing
        last_lid_l += (target_l - last_lid_l) * LID_SMOOTHING
        last_lid_r += (target_r - last_lid_r) * LID_SMOOTHING

        # OSC Send
        client.send_message(ADDR["LID_L"], float(last_lid_l))
        client.send_message(ADDR["LID_R"], float(last_lid_r))
        client.send_message(ADDR["SQ_L"], float(1.0 if target_l == 0.0 else 0.0))
        client.send_message(ADDR["SQ_R"], float(1.0 if target_r == 0.0 else 0.0))

    if key == ord('q'): break

cap_l.release()
cv2.destroyAllWindows()