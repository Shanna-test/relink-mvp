import { Conversation } from '../types';

const STORAGE_KEY = 'relink_conversations';

const isBrowser = () => typeof window !== 'undefined';

const loadConversations = (): Conversation[] => {
  if (!isBrowser()) return [];

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored) as Conversation[];
  } catch {
    return [];
  }
};

const persist = (conversations: Conversation[]) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
};

export const saveConversation = (conversation: Conversation) => {
  const conversations = loadConversations();
  const existingIndex = conversations.findIndex((c) => c.id === conversation.id);

  if (existingIndex >= 0) {
    conversations[existingIndex] = conversation;
  } else {
    conversations.unshift(conversation);
  }

  persist(conversations);
};

export const getConversations = (): Conversation[] => {
  return loadConversations().sort((a, b) => b.date - a.date);
};

export const getRecentConversations = (count = 3): Conversation[] => {
  return getConversations().slice(0, count);
};

export const getConversationById = (id: string): Conversation | undefined => {
  return loadConversations().find((conversation) => conversation.id === id);
};

// Emotion Check-In Storage
import { EmotionCheckIn } from '../types';

const CHECKIN_STORAGE_KEY = 'relink_emotion_checkins';

export const saveEmotionCheckIn = (checkIn: EmotionCheckIn) => {
  if (!isBrowser()) return;
  
  const stored = window.localStorage.getItem(CHECKIN_STORAGE_KEY);
  const checkIns: EmotionCheckIn[] = stored ? JSON.parse(stored) : [];
  checkIns.unshift(checkIn);
  window.localStorage.setItem(CHECKIN_STORAGE_KEY, JSON.stringify(checkIns));
};

export const getEmotionCheckIns = (): EmotionCheckIn[] => {
  if (!isBrowser()) return [];
  
  const stored = window.localStorage.getItem(CHECKIN_STORAGE_KEY);
  if (!stored) return [];
  
  try {
    return JSON.parse(stored) as EmotionCheckIn[];
  } catch {
    return [];
  }
};

export const getRecentEmotionCheckIns = (count = 10): EmotionCheckIn[] => {
  return getEmotionCheckIns().slice(0, count);
};

