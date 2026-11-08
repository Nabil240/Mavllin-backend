import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MessagingService,
  Conversation,
  ChatMessage,
} from '../../../core/services/messaging.service';
import { ToastService } from '../../../core/services/toast.service';

export interface QuickMacro {
  label: string;
  text: string;
}

@Component({
  selector: 'app-admin-messages',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './admin-messages.component.html',
  styleUrl: './admin-messages.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminMessagesComponent implements OnInit, OnDestroy {
  readonly messagingService = inject(MessagingService);
  readonly toast = inject(ToastService);

  @ViewChild('chatScrollContainer') chatScrollContainer?: ElementRef<HTMLDivElement>;

  // Reactive State Signals
  readonly conversations = signal<Conversation[]>([]);
  readonly selectedConversation = signal<Conversation | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly activeChannel = signal<'all' | 'facebook' | 'whatsapp'>('all');
  readonly searchQuery = signal<string>('');
  readonly replyText = signal<string>('');

  // Loading & Action State Signals
  readonly loadingConversations = signal<boolean>(false);
  readonly loadingMessages = signal<boolean>(false);
  readonly sendingReply = signal<boolean>(false);
  readonly togglingAi = signal<boolean>(false);

  // Polling Timer ID
  private pollIntervalId: any = null;

  // Preset Macro Templates for Quick Atelier Concierge Replies
  readonly quickMacros: QuickMacro[] = [
    {
      label: '📏 Sizing Guide',
      text: 'Our standard Panjabi sizing: S (38 - Chest 40", Length 40"), M (40 - Chest 42", Length 42"), L (42 - Chest 44", Length 44"), XL (44 - Chest 46", Length 46"). For a relaxed fit, we suggest sizing one size up.',
    },
    {
      label: '🚚 Delivery Policy',
      text: 'We deliver nationwide across Bangladesh! Inside Dhaka: ৳70 (1–2 days). Outside Dhaka: ৳130 (3–5 days). Orders over ৳2,500 enjoy free nationwide shipping.',
    },
    {
      label: '💳 bKash Payment',
      text: 'Please send the required payment to our official bKash Merchant number (01700-000000) using Make Payment, and reply here with your 10-character Transaction ID (TrxID).',
    },
    {
      label: '🔄 7-Day Exchange',
      text: 'We offer hassle-free size and garment exchange within 7 days of delivery, provided original tags are intact and unworn.',
    },
  ];

  // Computed Unread Counts across tabs
  readonly unreadCounts = computed(() => {
    const list = this.conversations();
    let all = 0;
    let facebook = 0;
    let whatsapp = 0;

    for (const c of list) {
      const count = c.unread_count || 0;
      all += count;
      if (c.channel === 'facebook') facebook += count;
      if (c.channel === 'whatsapp') whatsapp += count;
    }

    return { all, facebook, whatsapp };
  });

  // Filtered Conversation List (by Channel and Search Query)
  readonly filteredConversations = computed(() => {
    const channel = this.activeChannel();
    const query = this.searchQuery().toLowerCase().trim();
    let list = this.conversations();

    if (channel !== 'all') {
      list = list.filter((c) => c.channel === channel);
    }

    if (query) {
      list = list.filter((c) => {
        const name = (c.customer_name || '').toLowerCase();
        const phone = (c.customer_phone || '').toLowerCase();
        const id = (c.external_sender_id || c.external_user_id || '').toLowerCase();
        const lastMsg = (c.last_message_text || '').toLowerCase();
        return name.includes(query) || phone.includes(query) || id.includes(query) || lastMsg.includes(query);
      });
    }

    return list;
  });

  ngOnInit(): void {
    this.loadConversations();
    // Refresh conversations every 15 seconds for incoming live messages
    this.pollIntervalId = setInterval(() => {
      this.refreshConversationsSilently();
    }, 15000);
  }

  ngOnDestroy(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  /**
   * Initial or manual refresh of conversation threads
   */
  loadConversations(): void {
    this.loadingConversations.set(true);
    this.messagingService.getConversations().subscribe({
      next: (res) => {
        const data = res.data || [];
        this.conversations.set(data);
        this.loadingConversations.set(false);

        // Auto-select first conversation if none selected
        if (!this.selectedConversation() && data.length > 0) {
          this.selectedConversation.set(data[0]);
          this.loadMessages(data[0].id);
        }
      },
      error: () => {
        this.loadingConversations.set(false);
        this.toast.error('Unable to load conversations. Please try again.');
      },
    });
  }

  /**
   * Background silent polling update
   */
  private refreshConversationsSilently(): void {
    this.messagingService.getConversations().subscribe({
      next: (res) => {
        const data = res.data || [];
        this.conversations.set(data);

        // If active conversation exists, update its metadata
        const active = this.selectedConversation();
        if (active) {
          const updatedActive = data.find((c) => c.id === active.id);
          if (updatedActive) {
            this.selectedConversation.set(updatedActive);
          }
        }
      },
      error: () => {
        // Silently ignore background polling errors
      },
    });
  }

  /**
   * Set active channel filter tab
   */
  setChannelFilter(channel: 'all' | 'facebook' | 'whatsapp'): void {
    this.activeChannel.set(channel);
  }

  /**
   * Select conversation and fetch messages
   */
  selectConversation(conv: Conversation): void {
    this.selectedConversation.set(conv);
    this.loadMessages(conv.id);

    // Clear unread count locally and inform backend
    if (conv.unread_count > 0) {
      this.conversations.update((list) =>
        list.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
      );
      this.messagingService.markAsRead(conv.id).subscribe();
    }
  }

  /**
   * Fetch chat message history for active conversation
   */
  loadMessages(conversationId: number): void {
    this.loadingMessages.set(true);
    this.messagingService.getMessages(conversationId).subscribe({
      next: (res) => {
        const raw = res.data;
        const list = Array.isArray(raw) ? raw : ((raw as any)?.messages || []);
        this.messages.set(list);
        this.loadingMessages.set(false);
        this.scrollToBottom();
      },
      error: () => {
        this.loadingMessages.set(false);
        this.toast.error('Failed to load message history.');
      },
    });
  }

  /**
   * Send a manual staff reply
   */
  sendReply(): void {
    const text = this.replyText().trim();
    const active = this.selectedConversation();
    if (!text || !active || this.sendingReply()) return;

    this.sendingReply.set(true);
    this.messagingService.sendReply(active.id, text).subscribe({
      next: (res) => {
        const data: any = res.data;
        const newMsg: ChatMessage = data?.message || (data?.content ? data : null) || {
          id: Date.now(),
          conversation_id: active.id,
          channel: active.channel,
          direction: 'outbound',
          sender_type: 'admin',
          content: text,
          created_at: new Date().toISOString(),
        };

        this.messages.update((msgs) => [...msgs, newMsg]);
        this.replyText.set('');
        this.sendingReply.set(false);

        // Update last message snippet on conversation card
        this.conversations.update((list) =>
          list.map((c) =>
            c.id === active.id
              ? {
                  ...c,
                  last_message_text: text,
                  last_message_at: newMsg.created_at,
                  status: 'replied',
                }
              : c
          )
        );

        this.scrollToBottom();
      },
      error: () => {
        this.sendingReply.set(false);
        this.toast.error('Failed to dispatch manual reply.');
      },
    });
  }

  /**
   * Handle keyboard shortcuts in message composer (Enter to send, Shift+Enter for new line)
   */
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendReply();
    }
  }

  /**
   * Toggle AI auto-reply status for the selected conversation
   */
  toggleAi(): void {
    const active = this.selectedConversation();
    if (!active || this.togglingAi()) return;

    const currentStatus = this.isAiEnabled(active);
    const newStatus = !currentStatus;

    this.togglingAi.set(true);
    this.messagingService.toggleAi(active.id, newStatus).subscribe({
      next: () => {
        this.togglingAi.set(false);
        const updated = {
          ...active,
          is_ai_enabled: newStatus,
          ai_enabled: newStatus,
        };
        this.selectedConversation.set(updated);
        this.conversations.update((list) =>
          list.map((c) => (c.id === active.id ? updated : c))
        );

        if (newStatus) {
          this.toast.success('Mavllin AI Brain auto-reply is now ACTIVE for this conversation.');
        } else {
          this.toast.info('AI auto-reply DISABLED. Human agent takeover enabled.');
        }
      },
      error: () => {
        this.togglingAi.set(false);
        this.toast.error('Failed to update AI toggle status.');
      },
    });
  }

  /**
   * Apply a preset quick response macro into reply input
   */
  applyMacro(macro: QuickMacro): void {
    const existing = this.replyText().trim();
    if (existing) {
      this.replyText.set(`${existing}\n${macro.text}`);
    } else {
      this.replyText.set(macro.text);
    }
  }

  /**
   * Helper checking boolean or number AI status
   */
  isAiEnabled(conv: Conversation | null): boolean {
    if (!conv) return false;
    return (
      conv.is_ai_enabled === true ||
      conv.is_ai_enabled === 1 ||
      (conv as any).ai_enabled === true ||
      (conv as any).ai_enabled === 1
    );
  }

  /**
   * Smoothly scroll message container to newest bubble
   */
  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.chatScrollContainer?.nativeElement) {
        const el = this.chatScrollContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 60);
  }
}
