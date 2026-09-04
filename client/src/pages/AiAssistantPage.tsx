import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Bot,
  Camera,
  ImagePlus,
  Loader2,
  Mic,
  Send,
  Sparkles,
  User,
} from 'lucide-react';
import {
  aiAssistantApi,
  AiChatMessage,
  AiImageAnalysis,
  AiProposedAction,
} from '@/api/ai-assistant.api';
import { usePrintStore } from '@/store/print.store';
import { useUiStore } from '@/store/ui.store';
import { useAuthStore } from '@/store/auth.store';
import { useAiAssistantStore } from '@/store/ai-assistant.store';
import { getErrorMessage } from '@/utils/errors';
import { runAiClientPrint } from '@/utils/aiPrintExecutor';

function fileToBase64(file: File): Promise<{ base64: string; mime: string; preview: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] ?? '';
      resolve({ base64, mime: file.type || 'image/jpeg', preview: result });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ImageAnalysisCard({ analysis, t }: { analysis: AiImageAnalysis; t: (k: string) => string }) {
  return (
    <div className="ai-analysis-card">
      <h4>{t('aiAssistant.imageAnalysis.title')}</h4>
      {analysis.patientName && (
        <p>
          <strong>{t('aiAssistant.imageAnalysis.patient')}:</strong> {analysis.patientName}
        </p>
      )}
      {analysis.treatments.length > 0 && (
        <div className="ai-analysis-card__treatments">
          <strong>{t('aiAssistant.imageAnalysis.detectedTreatments')}:</strong>
          <ul>
            {analysis.treatments.map((tr, idx) => (
              <li key={idx}>
                {tr.treatmentLabel}
                {tr.teeth.length > 0 && ` — ${t('aiAssistant.imageAnalysis.tooth')} ${tr.teeth.join(', ')}`}
                {tr.price != null && ` — $${tr.price}`}
              </li>
            ))}
          </ul>
        </div>
      )}
      {analysis.notes && (
        <p className="ai-analysis-card__notes">
          <strong>{t('aiAssistant.imageAnalysis.notes')}:</strong> {analysis.notes}
        </p>
      )}
    </div>
  );
}

function ConfirmationCard({
  action,
  onConfirm,
  onCancel,
  isPending,
  t,
}: {
  action: AiProposedAction;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
  t: (k: string) => string;
}) {
  return (
    <div className="ai-confirm-card">
      <h4>{action.label}</h4>
      <dl className="ai-confirm-card__fields">
        {Object.entries(action.display).map(([key, value]) => (
          <div key={key} className="ai-confirm-card__row">
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="ai-confirm-card__actions">
        <button type="button" className="btn btn--primary btn--small" onClick={onConfirm} disabled={isPending}>
          {isPending ? <Loader2 size={14} className="spin" /> : null}
          {t('aiAssistant.confirm.add')}
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={onCancel} disabled={isPending}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}

export function AiAssistantPage() {
  const { t } = useTranslation();
  const { language } = useUiStore();
  const user = useAuthStore((s) => s.user);
  const print = usePrintStore((s) => s.print);
  const messages = useAiAssistantStore((s) => s.messages);
  const input = useAiAssistantStore((s) => s.input);
  const activeConfirmation = useAiAssistantStore((s) => s.activeConfirmation);
  const setMessages = useAiAssistantStore((s) => s.setMessages);
  const setInput = useAiAssistantStore((s) => s.setInput);
  const setActiveConfirmation = useAiAssistantStore((s) => s.setActiveConfirmation);
  const hydrate = useAiAssistantStore((s) => s.hydrate);
  const hydrated = useAiAssistantStore((s) => s.hydrated);

  const [pendingImage, setPendingImage] = useState<{ base64: string; mime: string; preview: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    hydrate(user.id, t('aiAssistant.welcome'));
  }, [user?.id, hydrate, t]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: status } = useQuery({
    queryKey: ['ai-assistant-status'],
    queryFn: () => aiAssistantApi.status(),
    staleTime: 60_000,
  });

  const chatMutation = useMutation({
    mutationFn: aiAssistantApi.chat,
    onMutate: () => ({ clientStart: performance.now(), clientSentAt: Date.now() }),
    onSuccess: (data, variables, context) => {
      const clientRoundTripMs = context?.clientStart != null ? performance.now() - context.clientStart : null;
      if (clientRoundTripMs != null) {
        console.debug(`[AI Timing] client round-trip: ${clientRoundTripMs.toFixed(0)}ms`);
      }
      if (data.timing) {
        console.debug('[AI Timing] server breakdown:', data.timing);
        if (clientRoundTripMs != null && data.timing.serverTotalMs != null) {
          const networkMs = Math.max(0, clientRoundTripMs - data.timing.serverTotalMs);
          console.debug(`[AI Timing] network (est.): ${networkMs.toFixed(0)}ms`);
        }
      }

      setMessages((prev) => {
        const next = [...prev];
        if (variables.message.trim() || variables.imageBase64) {
          next.push({
            role: 'user',
            content: variables.message.trim() || t('aiAssistant.imageAttached'),
            imagePreview: pendingImage?.preview,
          });
        }
        next.push({
          role: 'assistant',
          content: data.reply,
          proposedAction: data.proposedAction,
          imageAnalysis: data.imageAnalysis,
        });
        return next;
      });
      setPendingImage(null);
      setInput('');
      if (data.proposedAction) {
        setActiveConfirmation(data.proposedAction);
      }
      setError(null);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const executeMutation = useMutation({
    mutationFn: ({ action, params }: { action: string; params: Record<string, unknown> }) =>
      aiAssistantApi.executeAction(action, params),
    onSuccess: async (result) => {
      if (result.clientPrint) {
        try {
          await runAiClientPrint(result.clientPrint.action, result.clientPrint.params, {
            print,
            language,
            t,
          });
        } catch (err) {
          setError(getErrorMessage(err, t('common.error')));
        }
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: result.message }]);
      setActiveConfirmation(null);
      if (!result.clientPrint) setError(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  async function handleImageSelect(file: File | null) {
    if (!file) return;
    const encoded = await fileToBase64(file);
    setPendingImage(encoded);
  }

  function handleSend() {
    if (!input.trim() && !pendingImage) return;
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content }));

    chatMutation.mutate({
      message: input.trim(),
      history,
      imageBase64: pendingImage?.base64,
      imageMimeType: pendingImage?.mime,
      clientSentAt: Date.now(),
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isLoading = chatMutation.isPending || executeMutation.isPending;

  if (!user?.id || !hydrated) {
    return <p className="muted">{t('common.loading')}</p>;
  }

  return (
    <div className="ai-assistant-page">
      <header className="ai-assistant-page__header">
        <div className="ai-assistant-page__title">
          <Sparkles size={22} />
          <div>
            <h1>{t('aiAssistant.title')}</h1>
            <p className="muted">{t('aiAssistant.subtitle')}</p>
          </div>
        </div>
        {status && (
          <div className={`ai-assistant-page__status${status.configured ? ' ai-assistant-page__status--ok' : ''}`}>
            <Bot size={14} />
            {status.configured
              ? t('aiAssistant.statusReady', { model: status.model })
              : t('aiAssistant.statusNotConfigured')}
          </div>
        )}
      </header>

      {!status?.configured && (
        <div className="ai-assistant-banner ai-assistant-banner--warn">
          {t('aiAssistant.configureHint')}
        </div>
      )}

      <div className="ai-assistant-disclaimer muted">{t('aiAssistant.medicalDisclaimer')}</div>

      <div className="ai-assistant-chat">
        <div className="ai-assistant-chat__messages">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`ai-chat-bubble ai-chat-bubble--${msg.role}`}
            >
              <div className="ai-chat-bubble__avatar">
                {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
              </div>
              <div className="ai-chat-bubble__body">
                {msg.imagePreview && (
                  <img src={msg.imagePreview} alt="" className="ai-chat-bubble__image" />
                )}
                <p>{msg.content}</p>
                {msg.imageAnalysis && <ImageAnalysisCard analysis={msg.imageAnalysis} t={t} />}
              </div>
            </div>
          ))}

          {activeConfirmation && (
            <ConfirmationCard
              action={activeConfirmation}
              onConfirm={() =>
                executeMutation.mutate({
                  action: activeConfirmation.action,
                  params: activeConfirmation.params,
                })
              }
              onCancel={() => setActiveConfirmation(null)}
              isPending={executeMutation.isPending}
              t={t}
            />
          )}

          {isLoading && (
            <div className="ai-chat-loading">
              <Loader2 size={18} className="spin" />
              {t('aiAssistant.thinking')}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {error && <div className="form-error-banner ai-assistant-chat__error">{error}</div>}

        {pendingImage && (
          <div className="ai-assistant-preview">
            <img src={pendingImage.preview} alt="" />
            <button type="button" className="link-btn" onClick={() => setPendingImage(null)}>
              {t('common.cancel')}
            </button>
          </div>
        )}

        <div className="ai-assistant-input">
          <div className="ai-assistant-input__tools">
            <button
              type="button"
              className="icon-btn"
              title={t('aiAssistant.uploadImage') ?? ''}
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <ImagePlus size={18} />
            </button>
            <button
              type="button"
              className="icon-btn"
              title={t('aiAssistant.camera') ?? ''}
              onClick={() => cameraInputRef.current?.click()}
              disabled={isLoading}
            >
              <Camera size={18} />
            </button>
            <button
              type="button"
              className="icon-btn icon-btn--disabled"
              title={t('aiAssistant.voiceComingSoon') ?? ''}
              disabled
            >
              <Mic size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => handleImageSelect(e.target.files?.[0] ?? null)}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => handleImageSelect(e.target.files?.[0] ?? null)}
            />
          </div>
          <textarea
            className="ai-assistant-input__field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('aiAssistant.inputPlaceholder') ?? ''}
            rows={2}
            disabled={isLoading}
          />
          <button
            type="button"
            className="btn btn--primary ai-assistant-input__send"
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && !pendingImage)}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      <aside className="ai-assistant-examples">
        <h3>{t('aiAssistant.examplesTitle')}</h3>
        <ul>
          <li>{t('aiAssistant.example1')}</li>
          <li>{t('aiAssistant.example2')}</li>
          <li>{t('aiAssistant.example3')}</li>
          <li>{t('aiAssistant.example4')}</li>
        </ul>
      </aside>
    </div>
  );
}
