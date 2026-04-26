from PIL import Image
import uuid

def encode_image(image_path, message):
    img = Image.open(image_path).convert('RGB')
    encoded = img.copy()

    message += "###"
    data = ''.join(format(ord(i), '08b') for i in message)
    index = 0

    for y in range(img.height):
        for x in range(img.width):
            pixel = list(img.getpixel((x, y)))

            for n in range(3):
                if index < len(data):
                    pixel[n] = pixel[n] & ~1 | int(data[index])
                    index += 1

            encoded.putpixel((x, y), tuple(pixel))

            if index >= len(data):
                filename = f"encoded_{uuid.uuid4().hex}.png"
                output_path = f"uploads/{filename}"
                encoded.save(output_path)
                return filename