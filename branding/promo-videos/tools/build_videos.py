"""Tanıtım videolarını kareler ve ses kanallarından üretir.

Girdi (çekim klasörü, ör. scratchpad/promo/<ad>/):
  frames/0000.png ...  capture_shots.js'in çektiği kareler (30 fps)
  music.wav, sfx.wav   render_audio.js'in ürettiği ses kanalları (48 kHz)

Çıktı:
  - H.264 video: OpenCV'nin macOS AVFoundation kodlayıcısı
  - AAC ses: macOS `afconvert`
  - İkisi bu betikteki küçük MP4 birleştiricisiyle tek dosyada (ffmpeg gerekmez)

Kullanım:
  python3 build_videos.py <çekim_kökü> <çıktı_klasörü>
Harici bağımlılık: Python 3, numpy, Pillow, opencv-python (cv2), macOS afconvert.
"""
import os
import struct
import subprocess
import sys
import tempfile
import wave

import cv2
import numpy as np
from PIL import Image

FPS = 30
SECONDS = 15
FRAMES = FPS * SECONDS
SAMPLE_RATE = 48000

HERE = os.path.dirname(os.path.abspath(__file__))
BRANDING = os.path.abspath(os.path.join(HERE, "..", ".."))

# Karışım: oyundaki oranlar (müzik kanalı 0.2 x %60, efekt kanalı 0.3 zaten içinde);
# tanıtımda müzik biraz öne alınır, sonra bütün karışım tepe -1 dBFS'e getirilir.
MUSIC_GAIN = 0.2 * 0.6 * 1.35
SFX_GAIN = 1.0
TARGET_PEAK = 10 ** (-1 / 20)
FADE_OUT_SEC = 0.5

# (çekim adı, çıktı adı, açılış kapağı (CrazyGames), ses var mı)
VIDEOS = [
    ("landscape", "manufacturer-promo-landscape.mp4", None, True),
    ("portrait", "manufacturer-promo-portrait.mp4", None, True),
    ("landscape", "manufacturer-promo-landscape-crazygames.mp4", "banner_1920x1080.png", False),
    ("portrait23", "manufacturer-promo-portrait-crazygames.mp4", "cover_portrait_800x1200_base.png", False),
]
# Kapaktan oynanışa geçiş (CrazyGames: "statik kapak açılış karesi olsun")
COVER_HOLD_FRAMES = 4
COVER_FADE_FRAMES = 11


# ---------------------------------------------------------------------------- görüntü

def cover_frame(name: str, size: tuple) -> np.ndarray:
    """Kapağı video boyutuna getirir; küçük taban çizim en yakın komşuyla büyütülür."""
    img = Image.open(os.path.join(BRANDING, name)).convert("RGB")
    if img.size != size:
        img = img.resize(size, Image.NEAREST)
    return cv2.cvtColor(np.asarray(img), cv2.COLOR_RGB2BGR)


def write_video(capture_dir: str, out_path: str, cover: str | None) -> tuple:
    frames_dir = os.path.join(capture_dir, "frames")
    first = cv2.imread(os.path.join(frames_dir, "0000.png"))
    h, w = first.shape[:2]
    writer = cv2.VideoWriter(out_path, cv2.CAP_AVFOUNDATION, cv2.VideoWriter_fourcc(*"avc1"), FPS, (w, h))
    if not writer.isOpened():
        raise RuntimeError("H.264 kodlayıcı açılamadı")
    cover_img = cover_frame(cover, (w, h)) if cover else None
    for i in range(FRAMES):
        frame = cv2.imread(os.path.join(frames_dir, f"{i:04d}.png"))
        if frame is None or frame.shape[:2] != (h, w):
            raise RuntimeError(f"kare okunamadı: {i}")
        if cover_img is not None and i < COVER_HOLD_FRAMES + COVER_FADE_FRAMES:
            t = max(0.0, (i - COVER_HOLD_FRAMES + 1) / (COVER_FADE_FRAMES + 1))
            frame = cv2.addWeighted(cover_img, 1 - t, frame, t, 0)
        writer.write(frame)
    writer.release()
    return w, h


# ---------------------------------------------------------------------------- ses

def read_wav(path: str) -> np.ndarray:
    with wave.open(path, "rb") as wf:
        assert wf.getsampwidth() == 2 and wf.getframerate() == SAMPLE_RATE
        data = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        return data.reshape(-1, wf.getnchannels())


def mix_audio(capture_dir: str, out_wav: str) -> dict:
    music = read_wav(os.path.join(capture_dir, "music.wav")) * MUSIC_GAIN
    sfx = read_wav(os.path.join(capture_dir, "sfx.wav")) * SFX_GAIN
    n = SAMPLE_RATE * SECONDS
    mix = np.zeros((n, 2), dtype=np.float32)
    mix[: min(n, len(music))] += music[:n]
    mix[: min(n, len(sfx))] += sfx[:n]
    peak = float(np.abs(mix).max()) or 1.0
    mix *= TARGET_PEAK / peak
    fade = int(FADE_OUT_SEC * SAMPLE_RATE)
    mix[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)[:, None]
    mix[:240] *= np.linspace(0, 1, 240, dtype=np.float32)[:, None]
    pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
    with wave.open(out_wav, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(pcm.tobytes())
    rms = float(np.sqrt(np.mean(mix ** 2)))
    return {"gain": TARGET_PEAK / peak, "rms_dbfs": 20 * np.log10(rms + 1e-12)}


# ---------------------------------------------------------------------------- MP4 birleştirici

CONTAINERS = {b"moov", b"trak", b"mdia", b"minf", b"stbl", b"edts", b"dinf"}


def parse_boxes(data: bytes, start: int = 0, end: int | None = None) -> list:
    """[(tür, başlangıç, başlık_boyu, toplam_boy)] — yalnız bir düzey."""
    end = len(data) if end is None else end
    boxes, pos = [], start
    while pos + 8 <= end:
        size, kind = struct.unpack(">I4s", data[pos:pos + 8])
        header = 8
        if size == 1:
            size = struct.unpack(">Q", data[pos + 8:pos + 16])[0]
            header = 16
        elif size == 0:
            size = end - pos
        boxes.append((kind, pos, header, size))
        pos += size
    return boxes


class Box:
    def __init__(self, kind: bytes, payload: bytes | None = None, children: list | None = None):
        self.kind, self.payload, self.children = kind, payload, children

    @staticmethod
    def read(data: bytes, start: int, header: int, size: int, kind: bytes) -> "Box":
        body = data[start + header:start + size]
        if kind in CONTAINERS:
            return Box(kind, children=[Box.read(body, s, h, z, k) for k, s, h, z in parse_boxes(body)])
        return Box(kind, payload=body)

    def find(self, kind: bytes) -> list:
        out = []
        for child in self.children or []:
            if child.kind == kind:
                out.append(child)
            out.extend(child.find(kind))
        return out

    def encode(self) -> bytes:
        body = b"".join(c.encode() for c in self.children) if self.children is not None else self.payload
        return struct.pack(">I4s", 8 + len(body), self.kind) + body


def read_mp4(path: str) -> dict:
    data = open(path, "rb").read()
    top = parse_boxes(data)
    moov = next(Box.read(data, s, h, z, k) for k, s, h, z in top if k == b"moov")
    mdats = [(s, h, z) for k, s, h, z in top if k == b"mdat"]
    if len(mdats) != 1:
        raise RuntimeError(f"{path}: tek mdat bekleniyordu ({len(mdats)})")
    s, h, z = mdats[0]
    ftyp = next(data[s2:s2 + z2] for k, s2, h2, z2 in top if k == b"ftyp")
    return {"moov": moov, "mdat": data[s + h:s + z], "mdat_start": s + h, "ftyp": ftyp}


def mvhd_timescale_duration(mvhd: Box) -> tuple:
    p = mvhd.payload
    if p[0] == 1:
        return struct.unpack(">IQ", p[20:32])
    return struct.unpack(">II", p[12:20])


def shift_chunk_offsets(trak: Box, delta: int) -> None:
    for stco in trak.find(b"stco"):
        p = bytearray(stco.payload)
        count = struct.unpack(">I", p[4:8])[0]
        for i in range(count):
            off = 8 + i * 4
            struct.pack_into(">I", p, off, struct.unpack(">I", p[off:off + 4])[0] + delta)
        stco.payload = bytes(p)
    for co64 in trak.find(b"co64"):
        p = bytearray(co64.payload)
        count = struct.unpack(">I", p[4:8])[0]
        for i in range(count):
            off = 8 + i * 8
            struct.pack_into(">Q", p, off, struct.unpack(">Q", p[off:off + 8])[0] + delta)
        co64.payload = bytes(p)


def retime_track(trak: Box, src_scale: int, dst_scale: int, track_id: int) -> int:
    """tkhd süresini ve elst bölüm sürelerini film zaman ölçeğine çevirir; yeni süreyi döner."""
    tkhd = trak.find(b"tkhd")[0]
    p = bytearray(tkhd.payload)
    if p[0] == 1:
        dur = struct.unpack(">Q", p[28:36])[0] * dst_scale // src_scale
        struct.pack_into(">I", p, 20, track_id)
        struct.pack_into(">Q", p, 28, dur)
    else:
        dur = struct.unpack(">I", p[20:24])[0] * dst_scale // src_scale
        struct.pack_into(">I", p, 12, track_id)
        struct.pack_into(">I", p, 20, dur)
    p[3] = 0x07  # etkin, filmde, önizlemede
    tkhd.payload = bytes(p)
    for elst in trak.find(b"elst"):
        q = bytearray(elst.payload)
        version, count = q[0], struct.unpack(">I", q[4:8])[0]
        off = 8
        for _ in range(count):
            if version == 1:
                seg = struct.unpack(">Q", q[off:off + 8])[0] * dst_scale // src_scale
                struct.pack_into(">Q", q, off, seg)
                off += 20
            else:
                seg = struct.unpack(">I", q[off:off + 4])[0] * dst_scale // src_scale
                struct.pack_into(">I", q, off, seg)
                off += 12
        elst.payload = bytes(q)
    return dur


def mux(video_path: str, audio_path: str, out_path: str) -> None:
    video = read_mp4(video_path)
    audio = read_mp4(audio_path)
    v_moov, a_moov = video["moov"], audio["moov"]
    v_mvhd = next(c for c in v_moov.children if c.kind == b"mvhd")
    a_mvhd = next(c for c in a_moov.children if c.kind == b"mvhd")
    v_scale, v_dur = mvhd_timescale_duration(v_mvhd)
    a_scale, _ = mvhd_timescale_duration(a_mvhd)
    v_trak = next(c for c in v_moov.children if c.kind == b"trak")
    a_trak = next(c for c in a_moov.children if c.kind == b"trak")

    ftyp = video["ftyp"]
    mdat_payload_start = len(ftyp) + 8  # mdat başlığı 8 bayt (boyut < 4 GB)
    shift_chunk_offsets(v_trak, mdat_payload_start - video["mdat_start"])
    shift_chunk_offsets(a_trak, mdat_payload_start + len(video["mdat"]) - audio["mdat_start"])
    retime_track(v_trak, v_scale, v_scale, 1)
    a_dur = retime_track(a_trak, a_scale, v_scale, 2)

    p = bytearray(v_mvhd.payload)
    total = max(v_dur, a_dur)
    if p[0] == 1:
        struct.pack_into(">Q", p, 24, total)
        struct.pack_into(">I", p, len(p) - 4, 3)
    else:
        struct.pack_into(">I", p, 16, total)
        struct.pack_into(">I", p, len(p) - 4, 3)
    v_mvhd.payload = bytes(p)

    moov = Box(b"moov", children=[v_mvhd, v_trak, a_trak])
    mdat = video["mdat"] + audio["mdat"]
    with open(out_path, "wb") as fh:
        fh.write(ftyp)
        fh.write(struct.pack(">I4s", 8 + len(mdat), b"mdat"))
        fh.write(mdat)
        fh.write(moov.encode())


# ---------------------------------------------------------------------------- doğrulama

def describe(path: str) -> dict:
    cap = cv2.VideoCapture(path)
    info = {
        "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
        "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
        "fps": cap.get(cv2.CAP_PROP_FPS),
        "frames": 0,
    }
    while True:
        ok, _ = cap.read()
        if not ok:
            break
        info["frames"] += 1
    cap.release()
    info["duration"] = info["frames"] / info["fps"] if info["fps"] else 0
    data = open(path, "rb").read()
    moov = next(Box.read(data, s, h, z, k) for k, s, h, z in parse_boxes(data) if k == b"moov")
    info["tracks"] = [
        next(c for c in t.find(b"hdlr")).payload[8:12].decode() for t in moov.children if t.kind == b"trak"
    ]
    info["size_mb"] = round(len(data) / 1e6, 2)
    return info


def main() -> None:
    capture_root, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for capture, out_name, cover, with_audio in VIDEOS:
            capture_dir = os.path.join(capture_root, capture)
            out_path = os.path.join(out_dir, out_name)
            video_only = out_path if not with_audio else os.path.join(tmp, f"{capture}_video.mp4")
            write_video(capture_dir, video_only, cover)
            if with_audio:
                wav = os.path.join(tmp, f"{capture}.wav")
                m4a = os.path.join(tmp, f"{capture}.m4a")
                stats = mix_audio(capture_dir, wav)
                subprocess.run(
                    ["afconvert", "-f", "mp4f", "-d", "aac", "-b", "160000", wav, m4a],
                    check=True,
                )
                mux(video_only, m4a, out_path)
                print(f"  ses: kazanç {stats['gain']:.2f}, ortalama {stats['rms_dbfs']:.1f} dBFS")
            print(out_name, describe(out_path))


if __name__ == "__main__":
    main()
