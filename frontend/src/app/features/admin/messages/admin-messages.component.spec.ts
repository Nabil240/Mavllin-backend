import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminMessagesComponent } from './admin-messages.component';
import {
  MessagingService,
  Conversation,
  ChatMessage,
} from '../../../core/services/messaging.service';
import { ToastService } from '../../../core/services/toast.service';

describe('AdminMessagesComponent', () => {
  let fixture: any;
  let component: AdminMessagesComponent;
  let messagingService: MessagingService;
  let toastService: ToastService;

  const mockConversations: Conversation[] = [
    {
      id: 1,
      channel: 'facebook',
      external_sender_id: 'psid_fb_1001',
      customer_name: 'Sabrina Rahman',
      customer_phone: '01711223344',
      last_message_text: 'Do you have size 42 in the Onyx Panjabi?',
      last_message_at: '2026-11-07T14:30:00Z',
      is_ai_enabled: 1,
      unread_count: 2,
      status: 'open',
    },
    {
      id: 2,
      channel: 'whatsapp',
      external_sender_id: '8801819988776',
      customer_name: 'Imtiaz Ahmed',
      customer_phone: '01819988776',
      last_message_text: 'Please confirm my order delivery to Banani.',
      last_message_at: '2026-11-07T15:00:00Z',
      is_ai_enabled: 0,
      unread_count: 1,
      status: 'replied',
    },
  ];

  const mockMessages: ChatMessage[] = [
    {
      id: 101,
      conversation_id: 1,
      channel: 'facebook',
      direction: 'inbound',
      sender_type: 'customer',
      content: 'Do you have size 42 in the Onyx Panjabi?',
      created_at: '2026-11-07T14:30:00Z',
    },
    {
      id: 102,
      conversation_id: 1,
      channel: 'facebook',
      direction: 'outbound',
      sender_type: 'ai',
      content: 'Assalamu Alaikum! Yes, size 42 (L) is in stock at MAVLLIN atelier.',
      created_at: '2026-11-07T14:30:04Z',
    },
    {
      id: 103,
      conversation_id: 1,
      channel: 'facebook',
      direction: 'outbound',
      sender_type: 'admin',
      content: 'We can dispatch it for you tomorrow morning via Steadfast Courier.',
      created_at: '2026-11-07T14:35:00Z',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminMessagesComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    messagingService = TestBed.inject(MessagingService);
    toastService = TestBed.inject(ToastService);

    vi.spyOn(messagingService, 'getConversations').mockReturnValue(
      of({ success: true, message: 'OK', data: mockConversations })
    );
    vi.spyOn(messagingService, 'getMessages').mockReturnValue(
      of({ success: true, message: 'OK', data: mockMessages })
    );
    vi.spyOn(messagingService, 'markAsRead').mockReturnValue(
      of({ success: true, message: 'OK', data: { id: 1, unread_count: 0 } })
    );

    fixture = TestBed.createComponent(AdminMessagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create component and load conversations on init', () => {
    expect(component).toBeTruthy();
    expect(component.conversations().length).toBe(2);
    expect(component.selectedConversation()?.id).toBe(1);
    expect(component.messages().length).toBe(3);
  });

  it('should calculate correct unread counts across channels', () => {
    const counts = component.unreadCounts();
    expect(counts.all).toBe(3);
    expect(counts.facebook).toBe(2);
    expect(counts.whatsapp).toBe(1);
  });

  it('should filter conversations by channel tab', () => {
    // Filter to WhatsApp only
    component.setChannelFilter('whatsapp');
    expect(component.activeChannel()).toBe('whatsapp');
    expect(component.filteredConversations().length).toBe(1);
    expect(component.filteredConversations()[0].channel).toBe('whatsapp');

    // Filter to Facebook only
    component.setChannelFilter('facebook');
    expect(component.activeChannel()).toBe('facebook');
    expect(component.filteredConversations().length).toBe(1);
    expect(component.filteredConversations()[0].channel).toBe('facebook');

    // Filter back to all
    component.setChannelFilter('all');
    expect(component.filteredConversations().length).toBe(2);
  });

  it('should filter conversations by search query', () => {
    component.searchQuery.set('Imtiaz');
    expect(component.filteredConversations().length).toBe(1);
    expect(component.filteredConversations()[0].customer_name).toBe('Imtiaz Ahmed');

    component.searchQuery.set('Nonexistent Query');
    expect(component.filteredConversations().length).toBe(0);
  });

  it('should select a conversation and mark as read', () => {
    const secondConv = mockConversations[1];
    component.selectConversation(secondConv);

    expect(component.selectedConversation()?.id).toBe(2);
    expect(messagingService.getMessages).toHaveBeenCalledWith(2);
  });

  it('should send a manual staff reply and append message', () => {
    const replyText = 'Your order is confirmed!';
    const mockReplyResponse: ChatMessage = {
      id: 104,
      conversation_id: 1,
      channel: 'facebook',
      direction: 'outbound',
      sender_type: 'admin',
      content: replyText,
      created_at: new Date().toISOString(),
    };

    const sendSpy = vi.spyOn(messagingService, 'sendReply').mockReturnValue(
      of({ success: true, message: 'OK', data: mockReplyResponse })
    );

    component.replyText.set(replyText);
    component.sendReply();

    expect(sendSpy).toHaveBeenCalledWith(1, replyText);
    expect(component.replyText()).toBe('');
    expect(component.messages().some((m) => m.content === replyText)).toBe(true);
  });

  it('should toggle AI auto-reply on/off for active conversation', () => {
    const toggleSpy = vi.spyOn(messagingService, 'toggleAi').mockReturnValue(
      of({ success: true, message: 'OK', data: { id: 1, is_ai_enabled: false } })
    );
    const toastSpy = vi.spyOn(toastService, 'info');

    // Currently conversation 1 has is_ai_enabled: 1
    expect(component.isAiEnabled(component.selectedConversation())).toBe(true);

    component.toggleAi();

    expect(toggleSpy).toHaveBeenCalledWith(1, false);
    expect(component.isAiEnabled(component.selectedConversation())).toBe(false);
    expect(toastSpy).toHaveBeenCalled();
  });

  it('should apply quick macro template into reply text', () => {
    const macro = component.quickMacros[0];
    component.applyMacro(macro);
    expect(component.replyText()).toBe(macro.text);
  });

  it('should handle sendReply failure gracefully with toast error', () => {
    vi.spyOn(messagingService, 'sendReply').mockReturnValue(
      throwError(() => new Error('Network error'))
    );
    const toastSpy = vi.spyOn(toastService, 'error');

    component.replyText.set('Test message');
    component.sendReply();

    expect(toastSpy).toHaveBeenCalledWith('Failed to dispatch manual reply.');
    expect(component.sendingReply()).toBe(false);
  });
});
