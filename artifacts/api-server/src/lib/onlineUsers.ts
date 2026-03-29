export interface OnlineUser {
  userId: string;
  username: string;
  gender: "Male" | "Female";
  country?: string;
  joinedAt: Date;
  socketId?: string;
}

const onlineUsers = new Map<string, OnlineUser>();

export function addUser(user: OnlineUser): void {
  onlineUsers.set(user.userId, user);
}

export function removeUser(userId: string): void {
  onlineUsers.delete(userId);
}

export function removeUserBySocketId(socketId: string): OnlineUser | undefined {
  for (const [userId, user] of onlineUsers.entries()) {
    if (user.socketId === socketId) {
      onlineUsers.delete(userId);
      return user;
    }
  }
  return undefined;
}

export function getUser(userId: string): OnlineUser | undefined {
  return onlineUsers.get(userId);
}

export function getAllUsers(): OnlineUser[] {
  return Array.from(onlineUsers.values());
}

export function isUsernameTaken(username: string): boolean {
  for (const user of onlineUsers.values()) {
    if (user.username.toLowerCase() === username.toLowerCase()) {
      return true;
    }
  }
  return false;
}

export function updateSocketId(userId: string, socketId: string): void {
  const user = onlineUsers.get(userId);
  if (user) {
    user.socketId = socketId;
  }
}

export function getUserBySocketId(socketId: string): OnlineUser | undefined {
  for (const user of onlineUsers.values()) {
    if (user.socketId === socketId) {
      return user;
    }
  }
  return undefined;
}
