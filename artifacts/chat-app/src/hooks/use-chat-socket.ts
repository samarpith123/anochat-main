import { useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { getGetMessagesQueryKey } from '@workspace/api-client-react';
import { useAuth } from './use-auth';

// Singleton socket instance to persist across re-renders
let socket: Socket | null = null;

export function useChatSocket() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    
    if (!socket) {
      socket = io('/', { 
        path: '/socket.io',
        transports: ['websocket', 'polling']
      });
    }

    const handleConnect = () => {
      socket?.emit('user:join', { 
        userId: user.userId, 
        username: user.username, 
        gender: user.gender 
      });
    };

    const handleNewMessage = (payload: { sessionId: string, message: any }) => {
      const queryKey = getGetMessagesQueryKey(payload.sessionId);
      
      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData || !oldData.messages) {
          return { messages: [payload.message] };
        }
        
        // Prevent duplicate messages in cache
        if (oldData.messages.some((m: any) => m.id === payload.message.id)) {
          return oldData;
        }
        
        return {
          ...oldData,
          messages: [...oldData.messages, payload.message]
        };
      });
    };

    socket.on('connect', handleConnect);
    socket.on('message:new', handleNewMessage);

    // If already connected when hook mounts, fire join event immediately
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket?.off('connect', handleConnect);
      socket?.off('message:new', handleNewMessage);
    };
  }, [user, queryClient]);

  const emitMessage = useCallback((payload: any) => {
    socket?.emit('message:send', payload);
  }, []);

  return { emitMessage };
}
