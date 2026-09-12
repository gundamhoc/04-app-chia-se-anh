/**
 * Helper lưu ảnh và video trên Web browser.
 * KHÔNG import bất kỳ native module nào (như expo-media-library hay expo-file-system)
 * để đảm bảo tương thích 100% trên Web, không gây lỗi ExpoMediaLibraryNext.
 */

export const savePhotoToDevice = async (
  imageUrl: string,
  filename?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const safeFilename = filename || `masita_${Date.now()}.jpg`;

    // Thử tải qua fetch blob để trigger save file trực tiếp nếu cùng origin hoặc có CORS
    try {
      const response = await fetch(imageUrl, { mode: 'cors' });
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = safeFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
        return {
          success: true,
          message: 'Đã lưu ảnh về máy của bạn! 📥',
        };
      }
    } catch {
      // Fallback thẻ a trực tiếp nếu CORS fetch bị chặn
    }

    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = safeFilename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return {
      success: true,
      message: 'Đã bắt đầu tải ảnh về máy! 📥',
    };
  } catch (err: any) {
    console.warn('Lỗi tải ảnh trên Web:', err);
    return {
      success: false,
      message: 'Lưu ảnh thất bại: ' + (err?.message || 'Lỗi không xác định'),
    };
  }
};

export const saveVideoToDevice = async (
  videoUrl: string,
  filename?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    let safeFilename = filename
      ? filename.replace(/[^a-zA-Z0-9._-]/g, '_')
      : `masita_video_${Date.now()}.mp4`;
    if (!safeFilename.toLowerCase().endsWith('.mp4') && !safeFilename.toLowerCase().endsWith('.mov')) {
      safeFilename = `${safeFilename}.mp4`;
    }

    // Thử tải qua fetch blob để trigger save file trực tiếp nếu cùng origin hoặc có CORS
    try {
      const response = await fetch(videoUrl, { mode: 'cors' });
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = safeFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
        return {
          success: true,
          message: 'Đã lưu video về máy của bạn! 🎬',
        };
      }
    } catch {
      // Fallback thẻ a trực tiếp nếu CORS fetch bị chặn
    }

    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = safeFilename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return {
      success: true,
      message: 'Đã bắt đầu tải video về máy! 🎬',
    };
  } catch (err: any) {
    console.warn('Lỗi tải video trên Web:', err);
    return {
      success: false,
      message: 'Lưu video thất bại: ' + (err?.message || 'Lỗi không xác định'),
    };
  }
};
