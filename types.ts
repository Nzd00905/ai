export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface AudioStreamConfig {
  sampleRate: number;
}

export interface LiveConfig {
  model: string;
  systemInstruction?: string;
  voiceName?: string;
}

export interface MessageLog {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: Date;
}