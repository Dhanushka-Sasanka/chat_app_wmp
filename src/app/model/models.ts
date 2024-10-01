import {Timestamp } from "@angular/fire/firestore";

export interface Message {
  id: string;
  content: string;
  senderId: User;
  timestamp: Timestamp;
  readStatus: boolean;
}

export interface LatestMessage {
  content: string;
  timestamp: Timestamp;
  senderId: User;
}

export interface Chat {
  id: string;
  locationId: string;
  createdAt: Timestamp;
  latestMessage: LatestMessage;
  chatUser: User;
  unreadCount?: number;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
}

export interface Location {
  locationId: string;
  locationName: string;
  chats: Chat[];
}

