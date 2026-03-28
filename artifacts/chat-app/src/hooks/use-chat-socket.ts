import { useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { getGetMessagesQueryKey } from '@workspace/api-client-react';
import { useAuth } from './use-auth';
import { supabase, type SupabaseMessage } from '@/lib/supabase';

// Singletons — created once, never torn down mid-session
let socket: Socket | null = null;
let realtimeSubscribed = false;

export function useChatSocket() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Socket.IO — user presence only
  useEffect(() => {
    if (!user) return;

    if (!socket) {
      socket = io('/', {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
      });
    }

    const handleConnect = () => {
      socket?.emit('user:join', {
        userId: user.userId,
        username: user.username,
        gender: user.gender,
      });
    };

    socket.on('connect', handleConnect);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket?.off('connect', handleConnect);
    };
  }, [user]);

  // Supabase Realtime — set up once as a singleton channel
  useEffect(() => {
    if (!user || realtimeSubscribed) return;

    realtimeSubscribed = true;

    supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as SupabaseMessage;

          const message = {
            id: msg.id,
            sessionId: msg.session_id,
            fromUserId: msg.from_user_id,
            toUserId: msg.to_user_id,
            fromUsername: msg.from_username,
            content: msg.content,
            createdAt: new Date(msg.created_at),
          };

          const queryKey = getGetMessagesQueryKey(msg.session_id);

          queryClient.setQueryData(queryKey, (oldData: any) => {
            if (!oldData?.messages) return { messages: [message] };
            if (oldData.messages.some((m: any) => m.id === message.id)) return oldData;
            return { ...oldData, messages: [...oldData.messages, message] };
          });
        }
      )
      .subscribe();

    // No cleanup — singleton lives for the entire session
  }, [user, queryClient]);

  const emitMessage = useCallback((payload: any) => {
    socket?.emit('message:send', payload);
  }, []);

  return { emitMessage };
}
