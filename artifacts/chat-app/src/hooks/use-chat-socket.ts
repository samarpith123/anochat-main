import { useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { getGetMessagesQueryKey } from '@workspace/api-client-react';
import { useAuth } from './use-auth';

let socket: Socket | null = null;
let listenersAttached = false;

const API_URL = (import.meta.env.VITE_API_URL as string) ?? '';

function upsertMessage(queryClient: ReturnType<typeof useQueryClient>, sessionId: string, message: any) {
  const queryKey = getGetMessagesQueryKey(sessionId);
  queryClient.setQueryData(queryKey, (oldData: any) => {
    if (!oldData?.messages) return { messages: [message] };
    // Replace existing entry by id OR tempId to avoid duplicates
    const exists = oldData.messages.some(
      (m: any) => (m.id && m.id === message.id) || (m.tempId && m.tempId === message.tempId)
    );
    if (exists) return oldData;
    return { ...oldData, messages: [...oldData.messages, message] };
  });
}

export function useChatSocket() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    if (!socket) {
      socket = io(API_URL, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
      });
    }

    const handleConnect = () => {
      socket?.emit('user:join', {
        userId: user.userId,
        username: user.username,
        gender: user.gender,
        age: user.age,
      });
    };

    socket.on('connect', handleConnect);
    if (socket.connected) handleConnect();

    if (!listenersAttached) {
      listenersAttached = true;

      // Optimistic message arrives immediately — shown with temp id
      socket.on('message:new', ({ sessionId, message }: { sessionId: string; message: any }) => {
        upsertMessage(queryClient, sessionId, {
          // Use real id if present, otherwise use tempId as placeholder
          id: message.id ?? message.tempId,
          tempId: message.tempId,
          sessionId: message.sessionId,
          fromUserId: message.fromUserId,
          toUserId: message.toUserId,
          fromUsername: message.fromUsername,
          content: message.content,
          createdAt: new Date(message.createdAt),
        });
      });

      // DB confirmed — replace tempId with real id in cache
      socket.on('message:confirmed', ({ sessionId, tempId, id, createdAt }: {
        sessionId: string; tempId: string; id: number; createdAt: string;
      }) => {
        const queryKey = getGetMessagesQueryKey(sessionId);
        queryClient.setQueryData(queryKey, (oldData: any) => {
          if (!oldData?.messages) return oldData;
          return {
            ...oldData,
            messages: oldData.messages.map((m: any) =>
              m.tempId === tempId ? { ...m, id, tempId: undefined, createdAt: new Date(createdAt) } : m
            ),
          };
        });
      });

      // Send failed — mark message so UI can show error state
      socket.on('message:failed', ({ tempId }: { tempId: string }) => {
        // Find which session this tempId belongs to and mark it failed
        // Simple approach: iterate all cached queries
        queryClient.getQueriesData({ queryKey: ['getMessages'] }).forEach(([queryKey, data]: any) => {
          if (!data?.messages) return;
          const hasFailed = data.messages.some((m: any) => m.tempId === tempId);
          if (hasFailed) {
            queryClient.setQueryData(queryKey, {
              ...data,
              messages: data.messages.map((m: any) =>
                m.tempId === tempId ? { ...m, failed: true } : m
              ),
            });
          }
        });
      });

      // Message hidden by moderation
      socket.on('message:hidden', ({ messageId, sessionId }: { messageId: number; sessionId: string }) => {
        const queryKey = getGetMessagesQueryKey(sessionId);
        queryClient.setQueryData(queryKey, (oldData: any) => {
          if (!oldData?.messages) return oldData;
          return {
            ...oldData,
            messages: oldData.messages.filter((m: any) => m.id !== messageId),
          };
        });
      });
    }

    return () => {
      socket?.off('connect', handleConnect);
    };
  }, [user, queryClient]);

  const emitMessage = useCallback((payload: {
    sessionId: string;
    fromUserId: string;
    toUserId: string;
    fromUsername: string;
    content: string;
  }) => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    socket?.emit('message:send', { ...payload, tempId });
    return tempId;
  }, []);

  return { emitMessage };
}
