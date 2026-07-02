import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2';

export const register = async (req: Request, res: Response) => {
  try {
    const { username, email, password, fullName } = req.body;

    // Validate inputs
    if (!username || !email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: 'All fields (username, email, password, fullName) are required'
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username.toLowerCase().trim() },
          { email: email.toLowerCase().trim() }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase().trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        fullName: fullName.trim()
      }
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, fullName: user.fullName },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName
        }
      }
    });

  } catch (error: any) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error occurred during registration'
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { loginKey, password } = req.body; // loginKey can be email or username

    if (!loginKey || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username/email and password are required'
      });
    }

    const trimmedKey = loginKey.toLowerCase().trim();

    // Find user
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: trimmedKey },
          { email: trimmedKey }
        ]
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username/email or password'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username/email or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, fullName: user.fullName },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName
        }
      }
    });

  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error occurred during login'
    });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    if (!reqUser) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: reqUser.id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        createdAt: user.createdAt
      }
    });

  } catch (error: any) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error occurred fetching profile'
    });
  }
};
