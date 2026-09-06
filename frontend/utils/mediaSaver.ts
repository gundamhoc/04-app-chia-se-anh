import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';

/**
 * Helper lưu ảnh trên Mobile (iOS & Android).
 * Sử dụng expo-media-library/legacy và expo-file-system/legacy.
 */
export const savePhotoToDevice = async (
  imageUrl: string,
  filename?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    // Chỉ yêu cầu quyền writeOnly và granularPermissions là ['photo']
    // Tránh lỗi 'You have requested the AUDIO permission, but it is not declared in AndroidManifest' trên Android 13+
    let hasPermission = false;
    try {
      const current = await MediaLibrary.getPermissionsAsync(true, ['photo']);
      hasPermission = current.granted || current.status === 'granted';

      if (!hasPermission) {
        const requested = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
        hasPermission = requested.granted || requested.status === 'granted';
      }
    } catch (permErr) {
      console.warn('Lỗi kiểm tra quyền granular photo, thử writeOnly fallback:', permErr);
      try {
        const fallback = await MediaLibrary.requestPermissionsAsync(true);
        hasPermission = fallback.granted || fallback.status === 'granted';
      } catch (fallbackErr) {
        console.warn('Fallback quyền cũng thất bại:', fallbackErr);
      }
    }

    if (!hasPermission) {
      return {
        success: false,
        message: 'Quyền lưu ảnh vào thiết bị bị từ chối.',
      };
    }

    const safeFilename = filename || `masita_${Date.now()}.jpg`;
    const targetFileUri = `${FileSystem.documentDirectory}${safeFilename}`;

    const downloaded = await FileSystem.downloadAsync(imageUrl, targetFileUri);

    try {
      await MediaLibrary.saveToLibraryAsync(downloaded.uri);
    } catch {
      // Fallback createAssetAsync nếu saveToLibraryAsync không khả dụng
      await MediaLibrary.createAssetAsync(downloaded.uri);
    }

    return {
      success: true,
      message: 'Đã lưu ảnh vào bộ sưu tập của bạn! 📥',
    };
  } catch (err) {
    console.warn('Lỗi lưu ảnh trên thiết bị:', err);
    const errMsg = err instanceof Error ? err.message : 'Lỗi không xác định';
    return {
      success: false,
      message: 'Lưu ảnh thất bại: ' + errMsg,
    };
  }
};
