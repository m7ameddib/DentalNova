import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Camera, ImagePlus, Loader2, Mic, Send } from 'lucide-react';
import { aiAssistantApi, AiImageAnalysis, AiProposedAction } from '@/api/ai-assistant.api';
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
    <div className="ops-ai-card">
      <h4>{t('aiAssistant.imageAnalysis.title')}</h4>
      {analysis.patientName && (
        <p>
          <strong>{t('aiAssistant.imageAnalysis.patient')}:</strong> {analysis.patientName}
        </p>
      )}
      {analysis.treatments.length > 0 && (
        <div>
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
        <p>
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
    <div className="ops-ai-card ops-ai-confirm">
      <h4>{action.label}</h4>
      <dl>
        {Object.entries(action.display).map(([key, value]) => (
          <div key={key} className="ops-ai-kv">
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="ops-row-actions">
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
  const isFresh = messages.length <= 1 && !activeConfirmation;

  if (!user?.id || !hydrated) {
    return <p className="muted">{t('common.loading')}</p>;
  }

  return (
    <div className="ops-shell ai-page">
      <header className="ops-page-head">
        <div className="ops-page-head-copy">
          <h1>{t('aiAssistant.title')}</h1>
          <p>{t('aiAssistant.subtitle')}</p>
        </div>
        {status && (
          <span className={`ops-status-chip${status.configured ? ' on' : ''}`}>
            {status.configured ? t('aiAssistant.statusOn') : t('aiAssistant.statusNotConfigured')}
          </span>
        )}
      </header>

      {!status?.configured && <div className="ops-banner is-warn">{t('aiAssistant.configureHint')}</div>}

      <div className="ops-ai-layout">
        <div className="ops-ai-thread">
          <div className="ops-ai-msgs">
            {isFresh ? (
              <div className="ops-ai-empty">
                <h2>{t('aiAssistant.emptyTitle')}</h2>
                <p>{messages[0]?.content || t('aiAssistant.welcome')}</p>
                <div className="ops-suggest">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setInput(t(`aiAssistant.example${n}`))}
                    >
                      {t(`aiAssistant.example${n}`)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`ops-msg ${msg.role}`}>
                  {msg.imagePreview && <img src={msg.imagePreview} alt="" className="ops-ai-img" />}
                  <p>{msg.content}</p>
                  {msg.imageAnalysis && <ImageAnalysisCard analysis={msg.imageAnalysis} t={t} />}
                </div>
              ))
            )}

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
              <div className="ops-msg system">
                <Loader2 size={16} className="spin" /> {t('aiAssistant.thinking')}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {error && <div className="ops-banner is-warn ops-ai-error">{error}</div>}

          {pendingImage && (
            <div className="ops-ai-preview">
              <img src={pendingImage.preview} alt="" />
              <button type="button" className="link-btn" onClick={() => setPendingImage(null)}>
                {t('common.cancel')}
              </button>
            </div>
          )}

          <div className="ops-ai-composer">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('aiAssistant.inputPlaceholder') ?? ''}
              rows={3}
              disabled={isLoading}
            />
            <div className="ops-ai-tools">
              <button
                type="button"
                className="btn btn--ghost btn--small"
                title={t('aiAssistant.uploadImage') ?? ''}
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
              >
                <ImagePlus size={16} /> {t('aiAssistant.uploadImage')}
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--small"
                title={t('aiAssistant.camera') ?? ''}
                onClick={() => cameraInputRef.current?.click()}
                disabled={isLoading}
              >
                <Camera size={16} /> {t('aiAssistant.camera')}
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--small"
                title={t('aiAssistant.voiceComingSoon') ?? ''}
                disabled
              >
                <Mic size={16} /> {t('aiAssistant.voiceComingSoon')}
              </button>
              <button
                type="button"
                className="btn btn--primary ops-ai-send"
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && !pendingImage)}
              >
                {isLoading ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
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
          </div>
        </div>
      </div>

      <p className="ops-disclaimer ops-disclaimer--phi">{t('aiAssistant.phiWarning')}</p>
      <p className="ops-disclaimer">{t('aiAssistant.medicalDisclaimer')}</p>
    </div>
  );
}
