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

