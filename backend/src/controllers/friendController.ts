import { Request, Response } from 'express';
import prisma from '../prisma';

// Helper to get active user ID from Request
const getUserId = (req: Request): string => {
  return (req as any).user?.id;
};

// 1. Send Friend Request
export const sendFriendRequest = async (req: Request, res: Response) => {
  try {
    const senderId = getUserId(req);
    const { friendId } = req.body;

    if (!friendId) {
      return res.status(400).json({
        success: false,
        message: 'friendId is required'
      });
    }

    // Rule 1: No self-requests
    if (senderId === friendId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot send a friend request to yourself'
      });
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: friendId }
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Target user does not exist'
      });
    }

    // Rule 2: Check bidirectional friendship record
    // Direction A: sender -> receiver
    const requestA = await prisma.friendship.findUnique({
      where: {
        userId_friendId: {
          userId: senderId,
          friendId: friendId
        }
      }
    });

    // Direction B: receiver -> sender
    const requestB = await prisma.friendship.findUnique({
      where: {
        userId_friendId: {
          userId: friendId,
          friendId: senderId
        }
      }
    });

    // Handle existing relationship combinations
    if (requestA) {
      if (requestA.status === 'ACCEPTED') {
        return res.status(400).json({
          success: false,
          message: 'You are already friends'
        });
      }
      if (requestA.status === 'PENDING') {
        return res.status(400).json({
          success: false,
          message: 'Friend request already sent'
        });
      }
    }

    if (requestB) {
      if (requestB.status === 'ACCEPTED') {
        return res.status(400).json({
          success: false,
          message: 'You are already friends'
        });
      }
      if (requestB.status === 'PENDING') {
        return res.status(400).json({
          success: false,
          message: 'This user has already sent you a friend request. Accept it to connect!'
        });
      }
    }

    // No relation exists, create new PENDING friendship
    const newFriendship = await prisma.friendship.create({
      data: {
        userId: senderId,
        friendId: friendId,
        status: 'PENDING'
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Friend request sent successfully',
      data: newFriendship
    });

  } catch (error: any) {
    console.error('Send friend request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error occurred sending friend request'
    });
  }
};

// 2. Respond to Friend Request (Accept or Decline)
export const respondToRequest = async (req: Request, res: Response) => {
  try {
    const receiverId = getUserId(req);
    const { requestId, action } = req.body; // action: 'ACCEPT' or 'DECLINE'

    if (!requestId || !action) {
      return res.status(400).json({
        success: false,
        message: 'requestId and action are required'
      });
    }

    if (action !== 'ACCEPT' && action !== 'DECLINE') {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be ACCEPT or DECLINE'
      });
    }

    // Find the request
    const request = await prisma.friendship.findUnique({
      where: { id: requestId }
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Friend request not found'
      });
    }

    // Verify that the current user is the target (receiver) of the request
    if (request.friendId !== receiverId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to respond to this friend request'
      });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `This request has already been ${request.status.toLowerCase()}`
      });
    }

    if (action === 'ACCEPT') {
      const updatedFriendship = await prisma.friendship.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED' }
      });

      return res.status(200).json({
        success: true,
        message: 'Friend request accepted',
        data: updatedFriendship
      });
    } else {
      // DECLINE: Delete the record
      await prisma.friendship.delete({
        where: { id: requestId }
      });

      return res.status(200).json({
        success: true,
        message: 'Friend request declined'
      });
    }

  } catch (error: any) {
    console.error('Respond to friend request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error occurred responding to friend request'
    });
  }
};

// 3. Get Friends list
export const getFriends = async (req: Request, res: Response) => {
  try {
    const currentUserId = getUserId(req);

    // Query friendships where status is ACCEPTED and user is either sender or receiver
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { userId: currentUserId },
          { friendId: currentUserId }
        ]
      },
      include: {
        user: {
          select: { id: true, username: true, email: true, fullName: true }
        },
        friend: {
          select: { id: true, username: true, email: true, fullName: true }
        }
      }
    });

    // Format results to extract the friend object
    const friends = friendships.map(relation => {
      // If the current user is the sender (userId), the friend is the receiver (friend)
      return relation.userId === currentUserId ? relation.friend : relation.user;
    });

    return res.status(200).json({
      success: true,
      data: friends
    });

  } catch (error: any) {
    console.error('Get friends error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error occurred retrieving friends list'
    });
  }
};

// 4. Get Pending Requests (Incoming and Outgoing)
export const getPendingRequests = async (req: Request, res: Response) => {
  try {
    const currentUserId = getUserId(req);

    // Incoming requests (requests sent by others to current user)
    const incoming = await prisma.friendship.findMany({
      where: {
        friendId: currentUserId,
        status: 'PENDING'
      },
      include: {
        user: {
          select: { id: true, username: true, email: true, fullName: true }
        }
      }
    });

    // Outgoing requests (requests sent by current user to others)
    const outgoing = await prisma.friendship.findMany({
      where: {
        userId: currentUserId,
        status: 'PENDING'
      },
      include: {
        friend: {
          select: { id: true, username: true, email: true, fullName: true }
        }
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        incoming: incoming.map(req => ({
          requestId: req.id,
          user: req.user,
          createdAt: req.createdAt
        })),
        outgoing: outgoing.map(req => ({
          requestId: req.id,
          user: req.friend,
          createdAt: req.createdAt
        }))
      }
    });

  } catch (error: any) {
    console.error('Get pending requests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error occurred retrieving pending requests'
    });
  }
};

// 5. Search Users (and show relationship status)
export const searchUsers = async (req: Request, res: Response) => {
  try {
    const currentUserId = getUserId(req);
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    const searchQuery = q.toLowerCase().trim();

    // Find users whose username or full name contains the search query
    // Exclude current user
    const users = await prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        OR: [
          { username: { contains: searchQuery } },
          { fullName: { contains: searchQuery } }
        ]
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true
      },
      take: 20
    });

    // For each user, find their relationship status with current user
    const formattedUsers = await Promise.all(
      users.map(async (user) => {
        const relation = await prisma.friendship.findFirst({
          where: {
            OR: [
              { userId: currentUserId, friendId: user.id },
              { userId: user.id, friendId: currentUserId }
            ]
          }
        });

        let relationship = 'NONE'; // NONE, PENDING_SENT, PENDING_RECEIVED, FRIENDS

        if (relation) {
          if (relation.status === 'ACCEPTED') {
            relationship = 'FRIENDS';
          } else if (relation.status === 'PENDING') {
            relationship = relation.userId === currentUserId ? 'PENDING_SENT' : 'PENDING_RECEIVED';
          }
        }

        return {
          ...user,
          relationship,
          requestId: relation?.status === 'PENDING' ? relation.id : null
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: formattedUsers
    });

  } catch (error: any) {
    console.error('Search users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error occurred searching users'
    });
  }
};
