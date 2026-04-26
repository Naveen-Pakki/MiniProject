from PIL import Image

def decode_image(image_path):
    img = Image.open(image_path).convert('RGB')
    data = ""

    for y in range(img.height):
        for x in range(img.width):
            pixel = img.getpixel((x, y))
            for n in range(3):
                data += str(pixel[n] & 1)

    chars = [data[i:i+8] for i in range(0, len(data), 8)]
    message = ""

    for c in chars:
        message += chr(int(c, 2))
        if message.endswith("###"):
            return message[:-3]

    return ""