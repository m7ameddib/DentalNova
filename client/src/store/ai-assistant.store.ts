import { create } from 'zustand';
import { AiChatMessage, AiProposedAction } from '@/api/ai-assistant.api';

const STORAGE_PREFIX = 'dnt-ai-assistant';

interface PersistedAiChat {
  messages: AiChatMessage[];
  input: string;
  activeConfirmation: AiProposedAction | null;
}

interface AiAssistantState {
  userId: number | null;
  messages: AiChatMessage[];
  input: string;
  activeConfirmation: AiProposedAction | null;
  hydrated: boolean;
  hydrate: (userId: number, welcomeMessage: string) => void;
  setMessages: (updater: AiChatMessage[] | ((prev: AiChatMessage[]) => AiChatMessage[])) => void;
  setInput: (input: string) => void;
  setActiveConfirmation: (action: AiProposedAction | null) => void;
  clearForUser: (userId: number | null) => void;
}

function storageKey(userId: number) {
  return `${STORAGE_PREFIX}-${userId}`;
}

function loadPersisted(userId: number): PersistedAiChat | null {
  try {
    const raw = sessionStorage.getItem(storageKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as PersistedAiChat;
  } catch {
    return null;
  }
}

function savePersisted(userId: number, data: PersistedAiChat) {
  try {
    sessionStorage.setItem(storageKey(userId), JSON.stringify(data));
  } catch {
    // sessionStorage full or unavailable — ignore
  }
}

function removePersisted(userId: number) {
  sessionStorage.removeItem(storageKey(userId));
}

export const useAiAssistantStore = create<AiAssistantState>((set, get) => ({
  userId: null,
  messages: [],
  input: '',
  activeConfirmation: null,
  hydrated: false,

  hydrate: (userId, welcomeMessage) => {
    const current = get();
    if (current.hydrated && current.userId === userId) return;

    const persisted = loadPersisted(userId);
    if (persisted?.messages?.length) {
      set({
        userId,
        messages: persisted.messages,
        input: persisted.input ?? '',
        activeConfirmation: persisted.activeConfirmation ?? null,
        hydrated: true,
      });
      return;
    }

    set({
      userId,
      messages: [{ role: 'assistant', content: welcomeMessage }],
      input: '',
      activeConfirmation: null,
      hydrated: true,
    });
  },

  setMessages: (updater) => {
    const prev = get().messages;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    set({ messages: next });
    const userId = get().userId;
    if (userId) {
      savePersisted(userId, {
        messages: next,
        input: get().input,
        activeConfirmation: get().activeConfirmation,
      });
    }
  },

  setInput: (input) => {
    set({ input });
    const userId = get().userId;
    if (userId) {
      savePersisted(userId, {
        messages: get().messages,
        input,
        activeConfirmation: get().activeConfirmation,
      });
    }
  },

  setActiveConfirmation: (activeConfirmation) => {
    set({ activeConfirmation });
    const userId = get().userId;
    if (userId) {
      savePersisted(userId, {
        messages: get().messages,
        input: get().input,
        activeConfirmation,
      });
    }
  },

  clearForUser: (userId) => {
    if (userId != null) removePersisted(userId);
    set({
      userId: null,
      messages: [],
      input: '',
      activeConfirmation: null,
      hydrated: false,
    });
  },
}));

export function clearAiAssistantSession(userId: number | null | undefined) {
  if (userId != null) removePersisted(userId);
  useAiAssistantStore.getState().clearForUser(userId ?? null);
}
