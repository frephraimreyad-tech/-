/**
 * Universal Mobile & Desktop Image Compressor & Optimizer
 * Optimizes photos from phone cameras (iOS/Android) and computers into lightweight avatars (< 40KB)
 * that fit reliably into Firebase Firestore and LocalStorage.
 */

export interface CompressionResult {
  dataUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
}

/**
 * Compresses an image file from mobile/desktop file input or camera capture
 * @param file The image File from input or camera
 * @param maxDimension Maximum width/height in pixels (default: 300px for avatars)
 * @param quality JPEG compression quality (0.1 to 1.0, default: 0.8)
 */
export async function compressImageFile(
  file: File,
  maxDimension: number = 300,
  quality: number = 0.8
): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("لم يتم تحديد أي ملف"));
      return;
    }

    if (!file.type.startsWith("image/") && !file.name.match(/\.(jpe?g|png|webp|heic|bmp|gif)$/i)) {
      reject(new Error("الملف المحدد ليس صورة صالحة. يرجى اختيار ملف صورة (JPG, PNG, WebP)"));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("حدث خطأ أثناء قراءة ملف الصورة من جهازك"));
    };

    reader.onload = (readerEvent) => {
      const dataUri = readerEvent.target?.result as string;
      if (!dataUri) {
        reject(new Error("تعذر استخراج بيانات الصورة"));
        return;
      }

      const img = new Image();

      img.onerror = () => {
        reject(
          new Error("تعذر فك ترميز أبعاد الصورة. إذا كانت من آيفون بصيغة HEIC، يرجى حفظها كـ JPG أو اختيار صورة أخرى")
        );
      };

      img.onload = () => {
        try {
          const originalWidth = img.naturalWidth || img.width;
          const originalHeight = img.naturalHeight || img.height;

          if (!originalWidth || !originalHeight) {
            reject(new Error("أبعاد الصورة غير صالحة"));
            return;
          }

          // Calculate aspect ratio & crop to a square for a clean circular avatar
          const minDim = Math.min(originalWidth, originalHeight);
          const cropX = (originalWidth - minDim) / 2;
          const cropY = (originalHeight - minDim) / 2;

          const targetSize = Math.min(minDim, maxDimension);

          const canvas = document.createElement("canvas");
          canvas.width = targetSize;
          canvas.height = targetSize;

          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) {
            reject(new Error("تعذر إنشاء بيئة معالجة الصورة في المتصفح"));
            return;
          }

          // Enhance rendering quality
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          // Draw cropped center square
          ctx.drawImage(
            img,
            cropX,
            cropY,
            minDim,
            minDim,
            0,
            0,
            targetSize,
            targetSize
          );

          // Try exporting to WebP first, fallback to JPEG
          let compressedUrl = "";
          try {
            compressedUrl = canvas.toDataURL("image/webp", quality);
            if (!compressedUrl.startsWith("data:image/webp")) {
              compressedUrl = canvas.toDataURL("image/jpeg", quality);
            }
          } catch {
            compressedUrl = canvas.toDataURL("image/jpeg", quality);
          }

          // Calculate approximate byte size of base64
          const head = "data:image/jpeg;base64,";
          const approxBytes = Math.round((compressedUrl.length * 3) / 4);

          // If still over 120KB, compress further to 0.6 quality
          if (approxBytes > 120 * 1024) {
            compressedUrl = canvas.toDataURL("image/jpeg", 0.6);
          }

          resolve({
            dataUrl: compressedUrl,
            width: targetSize,
            height: targetSize,
            sizeBytes: Math.round((compressedUrl.length * 3) / 4),
          });
        } catch (err: any) {
          reject(new Error(err?.message || "فشلت معالجة الصورة"));
        }
      };

      img.src = dataUri;
    };

    reader.readAsDataURL(file);
  });
}
