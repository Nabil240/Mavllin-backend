import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/api.models';

export type MessagingChannel = 'facebook' | 'whatsapp';
export type MessageSenderType = 'customer' | 'admin' | 'ai' | 'bot' | 'agent';
export type MessageDirection = 'inbound' | 'outbound';

export interface Conversation {
  id: number;
  channel: MessagingChannel;
  external_sender_id?: string;
  external_user_id?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  last_message_text?: string | null;
  last_message_at?: string;
  is_ai_enabled: boolean | number;
  ai_enabled?: boolean | number;
  unread_count: number;
  status?: 'open' | 'replied' | 'closed';
  created_at?: string;
  updated_at?: string;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  channel?: MessagingChannel;
  direction?: MessageDirection;
  sender_type: MessageSenderType;
  content: string;
  raw_payload?: Record<string, unknown> | null;
  created_at: string;
}

export interface ConversationFilterParams {
  channel?: 'all' | 'facebook' | 'whatsapp';
  search?: string;
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class MessagingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/admin/messaging';

  /**
   * Fetch omnichannel conversations with optional channel, search, or status filter
   */
  getConversations(filters: ConversationFilterParams = {}): Observable<ApiResponse<Conversation[]>> {
    let params = new HttpParams();
    if (filters.channel && filters.channel !== 'all') {
      params = params.set('channel', filters.channel);
    }
    if (filters.search && filters.search.trim()) {
      params = params.set('search', filters.search.trim());
    }
    if (filters.status && filters.status.trim()) {
      params = params.set('status', filters.status.trim());
    }

    return this.http.get<ApiResponse<Conversation[]>>(`${this.baseUrl}/conversations`, { params });
  }

  /**
   * Retrieve chronologically ordered messages for a specific conversation
   */
  getMessages(conversationId: number): Observable<ApiResponse<ChatMessage[]>> {
    return this.http.get<ApiResponse<ChatMessage[]>>(`${this.baseUrl}/conversations/${conversationId}/messages`);
  }

  /**
   * Post a manual staff reply to the customer via the active channel adapter
   */
  sendReply(conversationId: number, content: string): Observable<ApiResponse<ChatMessage | { message: ChatMessage; conversation: Conversation }>> {
    return this.http.post<ApiResponse<ChatMessage | { message: ChatMessage; conversation: Conversation }>>(
      `${this.baseUrl}/conversations/${conversationId}/reply`,
      { content, message: content }
    );
  }

  /**
   * Toggle AI auto-reply on/off for a specific conversation
   */
  toggleAi(conversationId: number, is_ai_enabled: boolean): Observable<ApiResponse<{ id: number; is_ai_enabled: boolean }>> {
    return this.http.patch<ApiResponse<{ id: number; is_ai_enabled: boolean }>>(
      `${this.baseUrl}/conversations/${conversationId}/toggle-ai`,
      { is_ai_enabled, ai_enabled: is_ai_enabled }
    );
  }

  /**
   * Mark conversation as read / clear unread count
   */
  markAsRead(conversationId: number): Observable<ApiResponse<{ id: number; unread_count: number }>> {
    return this.http.patch<ApiResponse<{ id: number; unread_count: number }>>(
      `${this.baseUrl}/conversations/${conversationId}/read`,
      {}
    );
  }
}
