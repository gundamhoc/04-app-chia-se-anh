import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import prisma from '../prisma';

// Configure Cloudinary if credentials exist in .env
const useCloudinary =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

if (useCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    // Ensure directory exists synchronously before saving
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'photo-' + uniqueSuffix + ext);
  },
});

// Multer File Type Filtering (Mime types check)
const fileFilter = (req: any, file: any, cb: any) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WEBP image files are allowed.'), false);
  }
};

// Express upload middleware (limit size to 10MB)
export const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter,
});

// 1. Upload Photo Endpoint
export const uploadPhoto = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const file = req.file;
    const { caption } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded' });
    }

    let imageUrl = '';

    if (useCloudinary) {
      try {
        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'locket-clone',
        });
        imageUrl = result.secure_url;

        // Clean up local temp file synchronously
        fs.unlinkSync(file.path);
      } catch (cloudinaryError) {
        console.error('Cloudinary upload failed, falling back to local server storage:', cloudinaryError);
        // Fallback to local server path relative endpoint
        imageUrl = `/uploads/${file.filename}`;
      }
    } else {
      // Local Server Path relative representation
      imageUrl = `/uploads/${file.filename}`;
    }

    // Save Photo database record
    const photo = await prisma.photo.create({
      data: {
        userId,
        imageUrl,
        caption: caption ? caption.trim() : null,
      },
      include: {
        user: {
          select: { id: true, username: true, fullName: true },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Photo uploaded successfully',
      data: photo,
    });
  } catch (error: any) {
    console.error('Upload photo error:', error);
    // Cleanup upload file on error to avoid orphan files
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('Failed to cleanup temp file:', e);
      }
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error occurred uploading photo',
    });
  }
};

// 2. Query Bidirectional Friends Feed
export const getFeed = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user?.id;

    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Query 2-way friendship records (current user is initiator OR receiver)
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ userId: currentUserId }, { friendId: currentUserId }],
      },
    });

    // Accumulate unique user IDs: friends + current user
    const allowedUserIds = friendships.map((rel) =>
      rel.userId === currentUserId ? rel.friendId : rel.userId
    );
    allowedUserIds.push(currentUserId);

    // Retrieve all photos shared by these users
    const photos = await prisma.photo.findMany({
      where: {
        userId: { in: allowedUserIds },
      },
      include: {
        user: {
          select: { id: true, username: true, fullName: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.status(200).json({
      success: true,
      data: photos,
    });
  } catch (error: any) {
    console.error('Get feed error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error occurred retrieving feed list',
    });
  }
};

// 3. Query Personal Profile Uploads
export const getMyPhotos = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user?.id;

    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const photos = await prisma.photo.findMany({
      where: {
        userId: currentUserId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.status(200).json({
      success: true,
      data: photos,
    });
  } catch (error: any) {
    console.error('Get profile photos error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error occurred retrieving profile photos',
    });
  }
};
