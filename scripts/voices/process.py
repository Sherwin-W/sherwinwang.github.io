"""Prepare one voice clip for /public/voices: decode (macOS afconvert) -> trim silence -> loudness-normalise
(voiced RMS -20 dBFS, look-ahead peak limit -1.5 dBFS) -> 15 ms fades -> mono AAC 64 kb/s .m4a.
Usage: python3 scripts/voices/process.py <source audio> public/voices/<scene>-<part>.m4a  (prints duration as JSON)
No pitch or speed changes; no splicing."""
import subprocess, sys, wave, json, tempfile, os
import numpy as np
src, out = sys.argv[1], sys.argv[2]
TARGET_RMS_DB = -20.0   # speech RMS of the voiced part
PEAK_DB = -1.5
tmp = tempfile.mkdtemp()
wav = os.path.join(tmp, 'in.wav')
subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@44100', '-c', '1', src, wav], check=True)
with wave.open(wav) as w: sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32768
# Voiced region: 20 ms frames above -45 dBFS or 30 dB under the loudest frame.
f = int(sr * 0.02); n = len(x) // f
frames = x[: n * f].reshape(n, f); rms = np.sqrt((frames ** 2).mean(1)) + 1e-9; db = 20 * np.log10(rms)
thr = max(-45, db.max() - 30); on = np.where(db > thr)[0]
a, b = max(0, on[0] - 6) * f, min(len(x), (on[-1] + 9) * f)   # keep 120 ms before, 180 ms after
y = x[a:b]
voiced = np.concatenate([frames[i] for i in on]) if len(on) else y
gain = 10 ** ((TARGET_RMS_DB - 20 * np.log10(np.sqrt((voiced ** 2).mean()) + 1e-9)) / 20)
y = y * gain
lim = 10 ** (PEAK_DB / 20)
if np.abs(y).max() > lim:
    # Look-ahead limiter: gain dips only around peaks (5 ms window, 20 ms smoothing), not the whole clip.
    w = int(sr * 0.005); a_ = np.abs(y)
    env = np.lib.stride_tricks.sliding_window_view(np.pad(a_, w), 2 * w + 1).max(1)
    g = np.minimum(1.0, lim / np.maximum(env, 1e-9))
    k = int(sr * 0.02); kern = np.ones(k) / k
    g = np.minimum(g, np.convolve(g, kern, mode='same'))
    y = y * g
    y = np.clip(y, -lim, lim)
fade = int(sr * 0.015); ramp = np.linspace(0, 1, fade); y[:fade] *= ramp; y[-fade:] *= ramp[::-1]
# Remove DC.
y = y - y.mean()
w2 = os.path.join(tmp, 'out.wav')
with wave.open(w2, 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())
subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '64000', '-c', '1', w2, out], check=True)
print(json.dumps({'durationMs': round(len(y) / sr * 1000), 'gainDb': round(20 * np.log10(gain), 1), 'trimmedMs': [round(a / sr * 1000), round((len(x) - b) / sr * 1000)], 'bytes': os.path.getsize(out)}))
