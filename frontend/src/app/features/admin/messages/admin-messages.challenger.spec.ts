import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminMessagesComponent } from './admin-messages.component';
import {
  MessagingService,
  Conversation,
  ChatMessage,
} from '../../../core/services/messaging.service';
import { ToastService } from '../../../core/services/toast.service';

describe('AdminMessagesComponent — Empirical Adversarial Challenger Spec', () => {
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
      unread_count: 3,
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
      unread_count: 0,
      status: 'replied',
    },
    {
      id: 3,
      channel: 'facebook',
      external_sender_id: 'psid_fb_1003',
      customer_name: 'Nabila Hossain',
      customer_phone: null,
      last_message_text: 'Can I pay advance via bKash?',
      last_message_at: '2026-11-07T16:00:00Z',
      is_ai_enabled: true,
      unread_count: 2,
      status: 'open',
    },
  ];

  const mockMessagesForConv1: ChatMessage[] = [
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
      content: 'Assalamu Alaikum! Yes, size 42 (L) has a 44" finished chest with 2" ease.',
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
      of({ success: true, message: 'OK', data: mockMessagesForConv1 })
    );
    vi.spyOn(messagingService, 'markAsRead').mockReturnValue(
      of({ success: true, message: 'OK', data: { id: 1, unread_count: 0 } })
    );

    fixture = TestBed.createComponent(AdminMessagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    if (component) {
      component.ngOnDestroy();
    }
  });

  // =========================================================================
  // 1. REACTIVITY & CHANNEL FILTERING
  // =========================================================================
  describe('1. Component Reactivity & Omnichannel Filtering', () => {
    it('initializes and computes multi-channel unread counts accurately', () => {
      const counts = component.unreadCounts();
      // Conv 1: 3 FB, Conv 2: 0 WA, Conv 3: 2 FB => Total = 5, FB = 5, WA = 0
      expect(counts.all).toBe(5);
      expect(counts.facebook).toBe(5);
      expect(counts.whatsapp).toBe(0);
    });

    it('filters conversations correctly across all tabs: all, facebook, and whatsapp', () => {
      // 1. All channels
      component.setChannelFilter('all');
      expect(component.filteredConversations().length).toBe(3);

      // 2. Facebook only
      component.setChannelFilter('facebook');
      expect(component.filteredConversations().length).toBe(2);
      expect(component.filteredConversations().every((c) => c.channel === 'facebook')).toBe(true);

      // 3. WhatsApp only
      component.setChannelFilter('whatsapp');
      expect(component.filteredConversations().length).toBe(1);
      expect(component.filteredConversations()[0].channel).toBe('whatsapp');
      expect(component.filteredConversations()[0].customer_name).toBe('Imtiaz Ahmed');
    });

    it('filters case-insensitively across customer name, phone, external ID, and last message snippet', () => {
      // Search by partial phone
      component.searchQuery.set('88776');
      expect(component.filteredConversations().length).toBe(1);
      expect(component.filteredConversations()[0].id).toBe(2);

      // Search by message keyword
      component.searchQuery.set('Onyx');
      expect(component.filteredConversations().length).toBe(1);
      expect(component.filteredConversations()[0].id).toBe(1);

      // Search by external ID
      component.searchQuery.set('psid_fb_1003');
      expect(component.filteredConversations().length).toBe(1);
      expect(component.filteredConversations()[0].id).toBe(3);

      // Search unmatched
      component.searchQuery.set('nonexistent query string 999');
      expect(component.filteredConversations().length).toBe(0);
    });

    it('renders empty placeholder when no conversations exist', () => {
      component.conversations.set([]);
      component.selectedConversation.set(null);
      fixture.detectChanges();

      expect(component.filteredConversations().length).toBe(0);
      const emptyBox = fixture.nativeElement.querySelector('.no-selection-box');
      expect(emptyBox).toBeTruthy();
    });
  });

  // =========================================================================
  // 2. CONVERSATION SELECTION & UNREAD RESET LOGIC
  // =========================================================================
  describe('2. Conversation Selection & Read State Transitions', () => {
    it('resets unread_count and triggers markAsRead when selecting unread conversation', () => {
      const conv3 = mockConversations[2]; // unread_count: 2
      const markSpy = vi.spyOn(messagingService, 'markAsRead').mockReturnValue(
        of({ success: true, message: 'OK', data: { id: 3, unread_count: 0 } })
      );

      component.selectConversation(conv3);

      expect(component.selectedConversation()?.id).toBe(3);
      expect(markSpy).toHaveBeenCalledWith(3);
      // In-memory unread count must update to 0
      const updatedConv3 = component.conversations().find((c) => c.id === 3);
      expect(updatedConv3?.unread_count).toBe(0);
    });

    it('does NOT call markAsRead API when selecting an already-read conversation', () => {
      const conv2 = mockConversations[1]; // unread_count: 0
      const markSpy = vi.spyOn(messagingService, 'markAsRead');

      component.selectConversation(conv2);

      expect(component.selectedConversation()?.id).toBe(2);
      expect(markSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. OUTBOUND MESSAGE SENDING & KEYBOARD HANDLING
  // =========================================================================
  describe('3. Outbound Staff Reply & Composer Console', () => {
    it('ignores empty and whitespace-only reply submissions', () => {
      const sendSpy = vi.spyOn(messagingService, 'sendReply');

      // Empty string
      component.replyText.set('');
      component.sendReply();
      expect(sendSpy).not.toHaveBeenCalled();

      // Whitespace only
      component.replyText.set('     \n\t   ');
      component.sendReply();
      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('sends manual reply on Enter key and prevents default form submission', () => {
      const sendSpy = vi.spyOn(messagingService, 'sendReply').mockReturnValue(
        of({
          success: true,
          message: 'OK',
          data: {
            id: 201,
            conversation_id: 1,
            direction: 'outbound',
            sender_type: 'admin',
            content: 'Your package has been prepared.',
            created_at: new Date().toISOString(),
          },
        })
      );

      component.replyText.set('Your package has been prepared.');
      const event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: false });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      component.onKeydown(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(sendSpy).toHaveBeenCalledWith(1, 'Your package has been prepared.');
      expect(component.replyText()).toBe('');
    });

    it('does NOT send reply on Shift+Enter (allows multi-line entry)', () => {
      const sendSpy = vi.spyOn(messagingService, 'sendReply');
      component.replyText.set('Line 1');

      const event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      component.onKeydown(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
      expect(sendSpy).not.toHaveBeenCalled();
      expect(component.replyText()).toBe('Line 1');
    });

    it('appends quick macro templates gracefully into reply input', () => {
      // 1. Apply to empty composer
      component.replyText.set('');
      component.applyMacro(component.quickMacros[0]); // Sizing Guide
      expect(component.replyText()).toContain('Our standard Panjabi sizing: S (38');

      // 2. Apply second macro (should append with newline)
      component.applyMacro(component.quickMacros[1]); // Delivery Policy
      expect(component.replyText()).toContain('We deliver nationwide across Bangladesh!');
      expect(component.replyText()).toContain('\n');
    });

    it('handles sendReply failure gracefully with error toast and restores UI state', () => {
      vi.spyOn(messagingService, 'sendReply').mockReturnValue(
        throwError(() => new Error('Simulated HTTP 500 Network Failure'))
      );
      const toastSpy = vi.spyOn(toastService, 'error');

      component.replyText.set('Failed attempt message');
      component.sendReply();

      expect(component.sendingReply()).toBe(false);
      expect(toastSpy).toHaveBeenCalledWith('Failed to dispatch manual reply.');
      // Text remains in composer so user does not lose draft
      expect(component.replyText()).toBe('Failed attempt message');
    });
  });

  // =========================================================================
  // 4. PER-CONVERSATION AI AUTO-REPLY TOGGLE & HUMAN TAKEOVER
  // =========================================================================
  describe('4. Per-Conversation AI Auto-Reply Switch', () => {
    it('correctly detects isAiEnabled for boolean and numeric flags', () => {
      expect(component.isAiEnabled({ is_ai_enabled: 1 } as any)).toBe(true);
      expect(component.isAiEnabled({ is_ai_enabled: true } as any)).toBe(true);
      expect(component.isAiEnabled({ is_ai_enabled: 0 } as any)).toBe(false);
      expect(component.isAiEnabled({ is_ai_enabled: false } as any)).toBe(false);
      expect(component.isAiEnabled(null)).toBe(false);
    });

    it('toggles AI auto-reply off and notifies human takeover via toast.info', () => {
      // Conv 1 currently has is_ai_enabled: 1
      const toggleSpy = vi.spyOn(messagingService, 'toggleAi').mockReturnValue(
        of({ success: true, message: 'OK', data: { id: 1, is_ai_enabled: false } })
      );
      const toastSpy = vi.spyOn(toastService, 'info');

      component.toggleAi();

      expect(toggleSpy).toHaveBeenCalledWith(1, false);
      expect(component.isAiEnabled(component.selectedConversation())).toBe(false);
      expect(toastSpy).toHaveBeenCalledWith('AI auto-reply DISABLED. Human agent takeover enabled.');
    });

    it('toggles AI auto-reply on and notifies active concierge via toast.success', () => {
      // Switch to Conv 2 (is_ai_enabled: 0)
      component.selectConversation(mockConversations[1]);
      expect(component.isAiEnabled(component.selectedConversation())).toBe(false);

      const toggleSpy = vi.spyOn(messagingService, 'toggleAi').mockReturnValue(
        of({ success: true, message: 'OK', data: { id: 2, is_ai_enabled: true } })
      );
      const toastSpy = vi.spyOn(toastService, 'success');

      component.toggleAi();

      expect(toggleSpy).toHaveBeenCalledWith(2, true);
      expect(component.isAiEnabled(component.selectedConversation())).toBe(true);
      expect(toastSpy).toHaveBeenCalledWith('Mavllin AI Brain auto-reply is now ACTIVE for this conversation.');
    });

    it('handles toggleAi failure gracefully with error toast without corrupting state', () => {
      vi.spyOn(messagingService, 'toggleAi').mockReturnValue(
        throwError(() => new Error('DB Error'))
      );
      const toastSpy = vi.spyOn(toastService, 'error');

      const originalStatus = component.isAiEnabled(component.selectedConversation());
      component.toggleAi();

      expect(component.togglingAi()).toBe(false);
      expect(component.isAiEnabled(component.selectedConversation())).toBe(originalStatus);
      expect(toastSpy).toHaveBeenCalledWith('Failed to update AI toggle status.');
    });
  });

  // =========================================================================
  // 5. LIFECYCLE, SILENT POLLING & TEARDOWN
  // =========================================================================
  describe('5. Lifecycle Management & Polling Resilience', () => {
    it('clears poll interval on ngOnDestroy to prevent background timer leaks', () => {
      expect((component as any).pollIntervalId).not.toBeNull();
      component.ngOnDestroy();
      expect((component as any).pollIntervalId).toBeNull();
    });

    it('silently updates conversation metadata during background poll', () => {
      const updatedList: Conversation[] = [
        {
          ...mockConversations[0],
          last_message_text: 'Live polling new message received',
          unread_count: 4,
        },
        mockConversations[1],
        mockConversations[2],
      ];

      vi.spyOn(messagingService, 'getConversations').mockReturnValue(
        of({ success: true, message: 'OK', data: updatedList })
      );

      (component as any).refreshConversationsSilently();

      expect(component.conversations()[0].last_message_text).toBe('Live polling new message received');
      expect(component.selectedConversation()?.last_message_text).toBe('Live polling new message received');
    });
  });
});
