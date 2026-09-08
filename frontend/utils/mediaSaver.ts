import { Platform } from 'react-native';

export const savePhotoToDevice = async (
  imageUrl: string,
  filename?: string
): Promise<{ success: boolean; message: string }> => {
  if (Platform.OS === 'web') {
    const web = require('./mediaSaver.web');
    return web.savePhotoToDevice(imageUrl, filename);
  } else {
    const native = require('./mediaSaver.native');
    return native.savePhotoToDevice(imageUrl, filename);
  }
};

export const saveVideoToDevice = async (
  videoUrl: string,
  filename?: string
): Promise<{ success: boolean; message: string }> => {
  if (Platform.OS === 'web') {
    const web = require('./mediaSaver.web');
    return web.saveVideoToDevice(videoUrl, filename);
  } else {
    const native = require('./mediaSaver.native');
    return native.saveVideoToDevice(videoUrl, filename);
  }
};
