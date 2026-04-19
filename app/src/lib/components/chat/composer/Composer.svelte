<script lang="ts">
  import type { ChatRow, MessageRow } from '$lib/chat/types';
  import type { AttachmentRow } from '$lib/chat/types';
  import type { ContentPart } from '$lib/ai/types';
  import { sendTurn } from '$lib/chat/dispatch';
  import { byCategory } from '$lib/chat/techniques/registry';
  import type { Technique } from '$lib/chat/techniques/types';
  import { repo } from '$lib/chat/repo';
  import { extractAttachment } from '$lib/chat/attachments/extract';
  import ModePills from './ModePills.svelte';
  import SendStopButton from './SendStopButton.svelte';
  import SlashSuggestions from './SlashSuggestions.svelte';
  import AttachmentChips from './AttachmentChips.svelte';
  import AttachmentDropzone from './AttachmentDropzone.svelte';
  import type { PendingAttachment } from './AttachmentChips.svelte';
  import Paperclip from 'lucide-svelte/icons/paperclip';
  import { ulid } from 'ulid';
  import { onMount, tick } from 'svelte';

  type Props = {
    chat: ChatRow;
    activeMode: string | null;
    onModeChange: (id: string | null) => void;
    onMessageAppended: (msg: MessageRow) => void;
    onStreamingChanged: (streaming: boolean) => void;
    onTextDelta?: (delta: string) => void;
    onReasoningDelta?: (delta: string) => void;
  };
  let { chat, activeMode, onModeChange, onMessageAppended, onStreamingChanged, onTextDelta, onReasoningDelta }: Props = $props();

  let draft = $state('');
  let streaming = $state(false);
  let ctrl = $state<AbortController | null>(null);
  let suggestionIndex = $state(0);
  let textareaEl = $state<HTMLTextAreaElement | null>(null);
  let fileInputEl = $state<HTMLInputElement | null>(null);
  let pending = $state<PendingAttachment[]>([]);

  onMount(() => {
    const stopHandler = () => { if (streaming) stop(); };
    window.addEventListener('chat:stop-stream', stopHandler);

    const attachHandler = () => fileInputEl?.click();
    window.addEventListener('chat:attach-file', attachHandler);

    const insertHandler = async (e: Event) => {
      const text = (e as CustomEvent<{ text: string }>).detail?.text;
      if (typeof text !== 'string') return;
      draft = text;
      // Wait for Svelte to flush the draft binding into the DOM; otherwise
      // scrollHeight still reflects the old (empty) textarea value and the
      // height stays at the 2-row default until the next keypress.
      await tick();
      if (textareaEl) {
        textareaEl.style.height = 'auto';
        textareaEl.style.height = Math.min(textareaEl.scrollHeight, 300) + 'px';
        textareaEl.focus();
      }
    };
    window.addEventListener('composer:insert', insertHandler);

    return () => {
      window.removeEventListener('chat:stop-stream', stopHandler);
      window.removeEventListener('chat:attach-file', attachHandler);
      window.removeEventListener('composer:insert', insertHandler);
    };
  });

  const MAX_FILE_BYTES = 25 * 1024 * 1024;   // 25 MB per file
  const MAX_MSG_BYTES  = 50 * 1024 * 1024;   // 50 MB per message

  // Slash-completable: all mutator + composite techniques, plus the BTW utility.
  const mutators = byCategory('mutate');
  const composites = byCategory('composite');

  // Synthetic slash entries (not registered Techniques)
  type SlashEntry = { id: string; name: string; description: string; icon?: string; group?: string };

  const BTW_ENTRY: SlashEntry = { id: 'btw', name: 'btw', description: 'Side question, no chat history', icon: '*', group: 'Utility' };

  // Slash autocomplete: only trigger when draft starts with / and has no space yet
  const slashQuery = $derived(() => {
    const m = draft.match(/^\/(\S*)$/);
    return m ? m[1] : null;
  });

  function toSlashEntries(list: Technique[], group: string): SlashEntry[] {
    return list.map((t) => ({ id: t.id, name: t.name, description: t.description, group }));
  }

  const suggestions = $derived((): SlashEntry[] => {
    const q = slashQuery();
    if (q === null) return [];
    const lower = q.toLowerCase();

    const mutatorEntries = toSlashEntries(mutators, 'Mutators');
    const compositeEntries = toSlashEntries(composites, 'Composites');
    const allEntries: SlashEntry[] = [BTW_ENTRY, ...mutatorEntries, ...compositeEntries];

    // Empty query after `/` — show all techniques (BTW first).
    if (!lower) return allEntries;

    // Otherwise filter by prefix/substring on id and name.
    return allEntries.filter(
      (t) => t.id.startsWith(lower) || t.name.toLowerCase().includes(lower)
    );
  });

  // Reset selection when suggestions change
  $effect(() => {
    void suggestions();
    suggestionIndex = 0;
  });

  async function addFiles(files: File[]) {
    // Check per-file size limit
    const tooBig = files.filter((f) => f.size > MAX_FILE_BYTES);
    if (tooBig.length) {
      alert(`File(s) exceed 25 MB limit: ${tooBig.map((f) => f.name).join(', ')}`);
      files = files.filter((f) => f.size <= MAX_FILE_BYTES);
    }
    // Check total message size
    const currentTotal = pending.reduce((s, a) => s + a.size, 0);
    const incoming = files.reduce((s, f) => s + f.size, 0);
    if (currentTotal + incoming > MAX_MSG_BYTES) {
      alert('Total attachments exceed 50 MB per message limit.');
      return;
    }
    for (const file of files) {
      let extracted;
      try {
        extracted = await extractAttachment(file);
      } catch (err) {
        console.error('[attach] extraction failed:', err);
        extracted = { kind: 'other' as const };
      }
      pending = [
        ...pending,
        {
          id: ulid(),
          name: file.name,
          size: file.size,
          extracted,
          blob: file
        }
      ];
    }
  }

  function removeAttachment(id: string) {
    pending = pending.filter((a) => a.id !== id);
  }

  async function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => rej(new Error('FileReader failed'));
      r.readAsDataURL(blob);
    });
  }

  async function send() {
    if (!draft.trim() && pending.length === 0) return;
    if (streaming) return;
    streaming = true; onStreamingChanged(true);
    ctrl = new AbortController();

    const rawDraft = draft;
    const sentPending = [...pending]; // snapshot before clearing

    // Text attachments (PDF, docx, plain text) — appended as readable blocks.
    const textAttachmentBlocks = sentPending
      .filter((a) => a.extracted.extractedText && a.extracted.extractedText.trim())
      .map((a) => `\n\n[Attached: ${a.name}]\n${a.extracted.extractedText}`);
    const textForLLM = rawDraft + textAttachmentBlocks.join('');

    // Image attachments — sent as ContentPart[] so the LLM receives actual pixel data.
    const imageAttachments = sentPending.filter((a) => a.extracted.kind === 'image');

    draft = '';
    pending = [];
    if (textareaEl) textareaEl.style.height = 'auto';

    // Use the in-memory activeMode from parent (instant, no DB round-trip needed)
    const chatWithMode: ChatRow = { ...chat, settings: { ...chat.settings, activeMode } };

    let llmDraft: string | ContentPart[];
    if (imageAttachments.length > 0) {
      const parts: ContentPart[] = [];
      // Text part first (some providers require non-empty text alongside images)
      parts.push({ type: 'text', text: textForLLM.trim() ? textForLLM : '(image only)' });
      // One image part per attached image
      for (const img of imageAttachments) {
        const dataUrl = await blobToDataUrl(img.blob);
        parts.push({
          type: 'image',
          image: dataUrl,
          mediaType: img.blob.type || 'image/jpeg'
        });
      }
      llmDraft = parts;
    } else {
      llmDraft = textForLLM;
    }

    await sendTurn(chatWithMode, llmDraft, ctrl.signal, {
      onTextDelta: (d) => onTextDelta?.(d),
      onReasoningDelta: (d) => onReasoningDelta?.(d),
      onUserMessageCreated: async (userMsg) => {
        const ids: string[] = [];
        for (const a of sentPending) {
          try {
            const saved = await repo.saveAttachment({
              messageId: userMsg.id,
              kind: a.extracted.kind as AttachmentRow['kind'],
              name: a.name,
              mime: a.blob.type || 'application/octet-stream',
              size: a.size,
              extractedText: a.extracted.extractedText,
              blob: a.blob,
              thumbnail: a.extracted.thumbnail,
              tombstoned: false
            });
            ids.push(saved.id);
          } catch (err) {
            console.error('[attach] failed to save attachment:', err);
          }
        }
        // Always persist contentRaw = what the user typed (without extracted text),
        // so the bubble can render just the draft + attachment chips.
        const patch: Partial<import('$lib/chat/types').MessageRow> = { contentRaw: rawDraft };
        if (ids.length > 0) patch.attachmentIds = ids;
        await repo.updateMessage(userMsg.id, patch);
      },
      onFinish: (msg) => { onMessageAppended(msg); },
      onError: (err) => { console.error('[sendTurn]', err); }
    });

    streaming = false; onStreamingChanged(false); ctrl = null;
  }

  function stop() { ctrl?.abort(); }

  function completeSuggestion(t: SlashEntry) {
    draft = `/${t.id} `;
    suggestionIndex = 0;
  }

  function onKeydown(e: KeyboardEvent) {
    const suggs = suggestions();
    if (suggs.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); suggestionIndex = (suggestionIndex + 1) % suggs.length; return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); suggestionIndex = (suggestionIndex - 1 + suggs.length) % suggs.length; return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); completeSuggestion(suggs[suggestionIndex]); return; }
      if (e.key === 'Escape') { draft = ''; return; }
    }
    // Enter sends; Shift+Enter inserts newline naturally
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); send(); }
  }

  function onInput(e: Event) {
    const ta = e.currentTarget as HTMLTextAreaElement;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 300) + 'px';
  }

  function onPaste(e: ClipboardEvent) {
    const items = Array.from(e.clipboardData?.items ?? []);
    const imageItems = items.filter((item) => item.kind === 'file' && item.type.startsWith('image/'));
    if (imageItems.length === 0) return;
    e.preventDefault();
    const files = imageItems.map((item) => item.getAsFile()).filter((f): f is File => f !== null);
    if (files.length) addFiles(files);
  }

  function onFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length) addFiles(files);
    input.value = ''; // reset so same file can be re-selected
  }
</script>

<AttachmentDropzone onFiles={addFiles} />

<div class="composer-textarea relative mt-3 rounded-lg border border-border/60 bg-card/50 p-3">
  <!-- Slash suggestions popover -->
  <SlashSuggestions
    suggestions={suggestions()}
    selectedIndex={suggestionIndex}
    onSelect={completeSuggestion}
    query={slashQuery() ?? ''}
  />

  <AttachmentChips items={pending} onRemove={removeAttachment} />

  <div class="mb-2 flex items-center gap-2"><ModePills {activeMode} {onModeChange} /></div>
  <div class="flex items-end gap-2">
    <textarea
      bind:this={textareaEl}
      bind:value={draft}
      onkeydown={onKeydown}
      oninput={onInput}
      onpaste={onPaste}
      rows="2"
      placeholder="Type a message, or /slash a technique… (Enter to send, Shift+Enter for newline)"
      class="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
    ></textarea>

    <!-- Hidden file input -->
    <input
      bind:this={fileInputEl}
      type="file"
      multiple
      class="hidden"
      onchange={onFileChange}
    />

    <!-- Paperclip button -->
    <button
      type="button"
      onclick={() => fileInputEl?.click()}
      aria-label="Attach file"
      class="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
    >
      <Paperclip size={16} />
    </button>

    <SendStopButton {streaming} disabled={!draft.trim() && pending.length === 0} onSend={send} onStop={stop} />
  </div>
</div>
