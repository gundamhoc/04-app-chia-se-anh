/**
 * Helper lưu ảnh trên nền tảng Web (Trình duyệt)
 * Hoàn toàn không phụ thuộc vào native modules để tránh lỗi Cannot find native module.
 */
export const savePhotoToDevice = async (
  imageUrl: string,
  filename?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch(imageUrl, {
      headers: { 'ngrok-skip-browser-warning': '69420' },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename || `masita_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);

    return {
      success: true,
      message: 'Đã tải ảnh về máy tính thành công! 📥',
    };
  } catch (err) {
    console.warn('Lỗi tải ảnh trên Web:', err);
    const errMsg = err instanceof Error ? err.message : 'Lỗi không xác định';
    return {
      success: false,
      message: 'Không thể tải ảnh: ' + errMsg,
    };
  }
};
