import { useEffect, useState } from 'react';
import { getSocket, pingServer } from '../services/socketService';
import type { Socket } from 'socket.io-client';

/**
 * Hook để sử dụng Socket.io trong components
 */
export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const socket = getSocket();

  useEffect(() => {
    if (!socket) return;

    let mounted = true;

    const onConnect = () => {
      if (mounted) setIsConnected(true);
    };
    const onDisconnect = () => {
      if (mounted) setIsConnected(false);
    };
    const onConnectError = () => {
      if (mounted) setIsConnected(false);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    // Set initial state
    if (mounted) setIsConnected(socket.connected);

    return () => {
      mounted = false;
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, [socket]);

  const ping = (callback: (data: { message: string; timestamp: number }) => void) => {
    pingServer(callback);
  };

  return { socket, isConnected, ping };
};
