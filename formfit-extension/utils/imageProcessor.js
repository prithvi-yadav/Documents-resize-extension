function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image."));
    image.src = src;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to create image blob."));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

export async function resizeAndCompress(
  file,
  width,
  height,
  maxSizeKB,
  format
) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas rendering is not supported.");
  }

  ctx.drawImage(image, 0, 0, width, height);

  const isJpeg = format === "image/jpeg";
  const maxBytes = maxSizeKB ? maxSizeKB * 1024 : null;

  let quality = 0.9;
  let blob = await canvasToBlob(canvas, format, quality);

  console.log('[FormFit ImageProcessor] Initial compression at quality 0.9:', (blob.size/1024).toFixed(2), 'KB');

  if (maxBytes && isJpeg) {
    // Aggressively compress until under size limit
    let iterations = 0;
    while (blob.size > maxBytes && quality > 0.01) {
      quality = Math.max(quality - 0.02, 0.01); // Smaller steps for finer control
      blob = await canvasToBlob(canvas, format, quality);
      iterations++;
      
      console.log(`[FormFit ImageProcessor] Compression step ${iterations}: quality=${quality.toFixed(2)}, size=${(blob.size/1024).toFixed(2)}KB`);
      
      if (iterations > 50) {
        console.warn('[FormFit ImageProcessor] Max compression iterations reached');
        break;
      }
    }
    
    if (blob.size > maxBytes) {
      throw new Error(`Cannot compress to ${maxSizeKB}KB (current: ${(blob.size/1024).toFixed(1)}KB)`);
    }
    
    console.log('[FormFit ImageProcessor] ✓ Compression successful! Final size:', (blob.size/1024).toFixed(2), 'KB at quality', quality.toFixed(2));
  }

  if (maxBytes && !isJpeg && blob.size > maxBytes) {
    throw new Error("PNG output exceeds the max size limit.");
  }

  return blob;
}
