import { useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { getGetMessagesQueryKey } from '@workspace/api-client-react';
import { useAuth } from './use-auth';
import { supabase, type SupabaseMessage } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Singleton socket instance to persist across re-renders
let socket: Socket | null = null;

export function useChatSocket() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user) return;

    // Set up Socket.IO for user presence and sending messages
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

    socket.on('connect', handleConnect);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket?.off('connect', handleConnect);
    };
  }, [user]);

  // Subscribe to Supabase Realtime for incoming messages
  useEffect(() => {
    if (!user) return;

    // Clean up any existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
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
            if (!oldData || !oldData.messages) {
              return { messages: [message] };
            }

            // Prevent duplicates
            if (oldData.messages.some((m: any) => m.id === message.id)) {
              return oldData;
            }

            return {
              ...oldData,
              messages: [...oldData.messages, message]
            };
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, queryClient]);

  const emitMessage = useCallback((payload: any) => {
    socket?.emit('message:send', payload);
  }, []);

  return { emitMessage };
}
