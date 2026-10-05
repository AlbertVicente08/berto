import struct
import zlib
from pathlib import Path

def create_png(width: int, height: int, rgba: bytearray) -> bytes:
    """Generates PNG file bytes from RGBA byte buffer."""
    def make_chunk(chunk_type: bytes, data: bytes) -> bytes:
        length = struct.pack(">I", len(data))
        crc = struct.pack(">I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
        return length + chunk_type + data + crc

    header = b"\x89PNG\r\n\x1a\n"
    ihdr = make_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    raw_lines = bytearray()
    row_bytes = width * 4
    for y in range(height):
        raw_lines.append(0)  # Filter byte: 0 (None)
        raw_lines.extend(rgba[y * row_bytes : (y + 1) * row_bytes])

    idat = make_chunk(b"IDAT", zlib.compress(bytes(raw_lines), 9))
    iend = make_chunk(b"IEND", b"")
    return header + ihdr + idat + iend

def create_ico(png_list: list[tuple[int, int, bytes]]) -> bytes:
    """
    Creates an ICO file embedding PNG byte streams.
    Format:
    ICONDIR header (6 bytes)
    ICONDIRENTRY records (16 bytes each)
    Image data
    """
    count = len(png_list)
    header = struct.pack("<HHH", 0, 1, count)
    entries = bytearray()
    images_data = bytearray()
    
    # Calculate offset after header and all entries
    current_offset = 6 + 16 * count

    for width, height, png_bytes in png_list:
        w_byte = 0 if width >= 256 else width
        h_byte = 0 if height >= 256 else height
        size = len(png_bytes)
        # Entry: width, height, colorCount, reserved, planes(1), bitCount(32), size, offset
        entry = struct.pack("<BBBBHHII", w_byte, h_byte, 0, 0, 1, 32, size, current_offset)
        entries.extend(entry)
        images_data.extend(png_bytes)
        current_offset += size

    return header + bytes(entries) + bytes(images_data)

def render_berto(size: int) -> bytearray:
    """
    Renders Berto's robot head at given resolution into RGBA buffer.
    White pearl head (#EDEFF5), dark visor (#141724), aqua eyes (#9AE6E0).
    """
    buf = bytearray(size * size * 4)
    scale = size / 256.0

    def put_pixel(x: int, y: int, r: int, g: int, b: int, a: float):
        if 0 <= x < size and 0 <= y < size:
            idx = (y * size + x) * 4
            src_a = a
            dst_a = buf[idx + 3] / 255.0
            out_a = src_a + dst_a * (1.0 - src_a)
            if out_a > 0.001:
                out_r = (r * src_a + buf[idx] * dst_a * (1.0 - src_a)) / out_a
                out_g = (g * src_a + buf[idx + 1] * dst_a * (1.0 - src_a)) / out_a
                out_b = (b * src_a + buf[idx + 2] * dst_a * (1.0 - src_a)) / out_a
                buf[idx] = int(round(out_r))
                buf[idx + 1] = int(round(out_g))
                buf[idx + 2] = int(round(out_b))
                buf[idx + 3] = int(round(out_a * 255.0))

    def dist_sq_rounded_rect(px, py, rx, ry, rw, rh, rad):
        # Distance from point to rounded rectangle
        cx = rx + rw / 2.0
        cy = ry + rh / 2.0
        hx = rw / 2.0 - rad
        hy = rh / 2.0 - rad
        dx = max(0.0, abs(px - cx) - hx)
        dy = max(0.0, abs(py - cy) - hy)
        return (dx * dx + dy * dy) ** 0.5 - rad

    # Subpixel sampling (3x3 grid) for ultra-crisp antialiasing
    samples = 3
    step = 1.0 / samples
    inv_samples_sq = 1.0 / (samples * samples)

    # Geometry coordinates in 256x256 space:
    # Head: 40, 36, 176, 184, radius 40
    # Visor: 58, 64, 140, 128, radius 28
    # Left Ear: 18, 96, 26, 64, radius 13
    # Right Ear: 212, 96, 26, 64, radius 13
    # Left Eye: 82, 102, 32, 52, radius 14
    # Right Eye: 142, 102, 32, 52, radius 14

    for y in range(size):
        for x in range(size):
            # Evaluate over sample grid
            # Track colors
            for sy in range(samples):
                py = (y + (sy + 0.5) * step) / scale
                for sx in range(samples):
                    px = (x + (sx + 0.5) * step) / scale
                    
                    # 1. Ears
                    d_ear_l = dist_sq_rounded_rect(px, py, 18, 96, 26, 64, 13)
                    d_ear_r = dist_sq_rounded_rect(px, py, 212, 96, 26, 64, 13)
                    if d_ear_l <= 0 or d_ear_r <= 0:
                        # Aqua ear tip inside
                        d_ear_l_in = dist_sq_rounded_rect(px, py, 24, 112, 14, 32, 7)
                        d_ear_r_in = dist_sq_rounded_rect(px, py, 218, 112, 14, 32, 7)
                        if d_ear_l_in <= 0 or d_ear_r_in <= 0:
                            put_pixel(x, y, 154, 230, 224, inv_samples_sq)
                        else:
                            put_pixel(x, y, 216, 222, 235, inv_samples_sq)

                    # 2. Main Head
                    d_head = dist_sq_rounded_rect(px, py, 38, 36, 180, 184, 42)
                    if d_head <= 0:
                        # 3. Visor
                        d_visor = dist_sq_rounded_rect(px, py, 58, 64, 140, 128, 28)
                        if d_visor <= 0:
                            # 4. Eyes
                            d_eye_l = dist_sq_rounded_rect(px, py, 82, 102, 32, 52, 14)
                            d_eye_r = dist_sq_rounded_rect(px, py, 142, 102, 32, 52, 14)
                            if d_eye_l <= 0 or d_eye_r <= 0:
                                # Eye inner color: Glowing Aqua #9AE6E0
                                put_pixel(x, y, 154, 230, 224, inv_samples_sq)
                            else:
                                # Visor background: Dark Navy #141724
                                put_pixel(x, y, 20, 23, 36, inv_samples_sq)
                        else:
                            # Head pearl white: #EDEFF5
                            # Subtle top highlight
                            if py < 50:
                                put_pixel(x, y, 255, 255, 255, inv_samples_sq)
                            else:
                                put_pixel(x, y, 237, 239, 245, inv_samples_sq)

    return buf

def main():
    root = Path(__file__).resolve().parents[1]
    icons_dir = root / "app" / "src-tauri" / "icons"
    icons_dir.mkdir(parents=True, exist_ok=True)

    sizes = [16, 24, 32, 48, 64, 128, 256]
    pngs = {}

    print("Rendering Berto robot icons...")
    for s in sizes:
        rgba = render_berto(s)
        png_data = create_png(s, s, rgba)
        pngs[s] = png_data
        print(f"  Generated {s}x{s} PNG ({len(png_data)} bytes)")

    # Write PNG files
    (icons_dir / "32x32.png").write_bytes(pngs[32])
    (icons_dir / "128x128.png").write_bytes(pngs[128])
    (icons_dir / "128x128@2x.png").write_bytes(pngs[256])
    (icons_dir / "icon.png").write_bytes(pngs[256])
    (icons_dir / "berto-tray.png").write_bytes(pngs[32])
    (icons_dir / "Square44x44Logo.png").write_bytes(pngs[48])
    (icons_dir / "Square150x150Logo.png").write_bytes(pngs[128])

    # Build multi-resolution ICO (256, 128, 64, 48, 32, 24, 16)
    ico_entries = [
        (256, 256, pngs[256]),
        (128, 128, pngs[128]),
        (64, 64, pngs[64]),
        (48, 48, pngs[48]),
        (32, 32, pngs[32]),
        (24, 24, pngs[24]),
        (16, 16, pngs[16]),
    ]
    ico_data = create_ico(ico_entries)
    (icons_dir / "icon.ico").write_bytes(ico_data)
    (icons_dir / "berto-tray.ico").write_bytes(ico_data)

    print(f"Created icon.ico and berto-tray.ico ({len(ico_data)} bytes)")
    print("Done!")

if __name__ == "__main__":
    main()
