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
    "LX": P("EyeLeftX"), "LY": P("EyeY"),
    "RX": P("EyeRightX"), "RY": P("EyeY")
}

# --- CONFIG LOADING/SAVING ---
CONFIG_FILE = "gaze_calib.json"

def save_config(data):
    with open(CONFIG_FILE, 'w') as f:
        json.dump(data, f)

# Load existing offsets or use default 0.5 (center of image)
if os.path.exists(CONFIG_FILE):
    with open(CONFIG_FILE, 'r') as f:
        offsets = json.load(f)
    print("Loaded saved Gaze offsets!")
else:
    offsets = {"lx": 0.5, "ly": 0.5, "rx": 0.5, "ry": 0.5}
    print("No gaze file found. Using default center.")

# --- TUNING ---
THRESHOLD_VAL = 45 
SENSITIVITY = 1.8   
DEADZONE = 0.10     
SMOOTH_X = 0.20     
SMOOTH_Y = 0.12     

last_vals = {"lx": 0.0, "ly": 0.0, "rx": 0.0, "ry": 0.0}

def apply_soft_deadzone(val, dz):
    if abs(val) < dz: return 0.0
    return np.sign(val) * ((abs(val) - dz) / (1.0 - dz))

def get_raw_pupil_pos(frame, window_name, off_x, off_y):
    if frame is None: return None
    
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (7, 7), 0)
    _, thresh = cv2.threshold(blur, THRESHOLD_VAL, 255, cv2.THRESH_BINARY_INV)
    
    moments = cv2.moments(thresh)
    h, w = thresh.shape
    
    pos = None
    debug_view = cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)
    
    if moments["m00"] > 100:
        cX = moments["m10"] / moments["m00"]
        cY = moments["m01"] / moments["m00"]
        pos = (cX / w, cY / h)
        
        # Draw current pupil position (Green circle)
        cv2.circle(debug_view, (int(cX), int(cY)), 5, (0, 255, 0), -1)
    
    # Draw CALIBRATED CENTER (Red crosshair)
    cv2.drawMarker(debug_view, (int(off_x * w), int(off_y * h)), (0, 0, 255), cv2.MARKER_CROSS, 20, 2)
    
    cv2.imshow(window_name, debug_view)
    return pos

# --- CAMERA INITIALIZATION ---
cap_l = cv2.VideoCapture("http://127.0.0.1:4442/left")
cap_r = cv2.VideoCapture("http://127.0.0.1:4442/right")

print("\n--- GAZE CONTROLS ---")
print("C: Center Eyes (Look straight ahead)")
print("Q: Quit")

while True:
    ret_l, frame_l = cap_l.read()
    ret_r, frame_r = cap_r.read()

    if ret_l and ret_r:
        pos_l = get_raw_pupil_pos(frame_l, "Left Eye Gaze", offsets["lx"], offsets["ly"])
        pos_r = get_raw_pupil_pos(frame_r, "Right Eye Gaze", offsets["rx"], offsets["ry"])

        key = cv2.waitKey(1)
        # --- CALIBRATE & AUTO-SAVE ---
        if key == ord('c') and pos_l and pos_r:
            offsets["lx"], offsets["ly"] = pos_l
            offsets["rx"], offsets["ry"] = pos_r
            save_config(offsets)
            print(f"SAVED CENTER: L({round(pos_l[0],2)}) R({round(pos_r[0],2)})")

        # --- PROCESS MOVEMENT ---
        if pos_l and pos_r:
            # Left Eye
            tx = (pos_l[0] - offsets["lx"]) * 2 * SENSITIVITY
            ty = (pos_l[1] - offsets["ly"]) * -2 * SENSITIVITY
            last_vals["lx"] += (apply_soft_deadzone(np.clip(tx, -1, 1), DEADZONE) - last_vals["lx"]) * SMOOTH_X
            last_vals["ly"] += (apply_soft_deadzone(np.clip(ty, -1, 1), DEADZONE) - last_vals["ly"]) * SMOOTH_Y

            # Right Eye
            trx = (pos_r[0] - offsets["rx"]) * 2 * SENSITIVITY
            try_ = (pos_r[1] - offsets["ry"]) * -2 * SENSITIVITY
            last_vals["rx"] += (apply_soft_deadzone(np.clip(trx, -1, 1), DEADZONE) - last_vals["rx"]) * SMOOTH_X
            last_vals["ry"] += (apply_soft_deadzone(np.clip(try_, -1, 1), DEADZONE) - last_vals["ry"]) * SMOOTH_Y

            avg_y = (last_vals["ly"] + last_vals["ry"]) / 2

            # --- OSC SEND ---
            client.send_message(ADDR["LX"], float(last_vals["lx"]))
            client.send_message(ADDR["LY"], float(avg_y))
            client.send_message(ADDR["RX"], float(last_vals["rx"]))
            client.send_message(ADDR["RY"], float(avg_y))

    if key == ord('q'): break

cap_l.release()
cap_r.release()
cv2.destroyAllWindows()