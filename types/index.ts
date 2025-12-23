export interface Message {
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  date: number;
  situation: string;
  observation: string;
  emotion: string;
  need: string;
  request: string;
  conversionText: string;
  messages: Message[];
  stage: 'observation' | 'emotion' | 'need' | 'request' | 'conversion' | 'complete';
}

export interface EmotionCheckIn {
  id: string;
  date: number;
  mainCategory: 'uncomfortable' | 'pleasant';
  subCategory: string;
  emotion: string;
  situation?: string;
}

