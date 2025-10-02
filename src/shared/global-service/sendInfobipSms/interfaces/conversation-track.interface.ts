export interface TUpdateClientSMSChatTrack {
  clientId: number;
  smsLastMessage: string;
  lastMessageBy: string;
  lastEmailBy?: string;
}

export interface TUpdateClientEmailChatTrack {
  clientId: number;
  emailLastMessage: string;
  lastMessageBy: string;
  lastEmailBy?: string;
}
