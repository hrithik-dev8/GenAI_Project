import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TopBar } from "@/components/TopBar";
import { toast } from "sonner";
import { Send, Loader2, BookOpen, ShieldCheck, Plus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Citation = { id: string; title: string; authors: string; year: number; source: string; url: string };
type Msg = { role: "user" | "assistant"; content: string; citations?: Citation[] };

const SUGGESTED = [
  "How much protein should I eat for fat loss?",
  "Is training to failure necessary for hypertrophy?",
  "How should I structure cardio with lifting?",
  "Best vegan protein sources for muscle gain?",
];

const Chat = () => {
  const { user } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<{ id: string; title: string }[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (user) refreshConversations(); /* eslint-disable-next-line */ }, [user]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  async function refreshConversations() {
    const { data } = await supabase.from("conversations").select("id,title").order("created_at", { ascending: false }).limit(20);
    const list = data ?? [];
    setConversations(list);
    if (!conversationId && list[0]) await openConversation(list[0].id);
    else if (!conversationId) await newConversation();
  }

  async function newConversation() {
    if (!user) return;
    const { data, error } = await supabase.from("conversations").insert({ user_id: user.id }).select("id,title").single();
    if (error) { toast.error(error.message); return; }
    setConversationId(data.id);
    setMessages([]);
    refreshConversations();
  }

  async function openConversation(id: string) {
    setConversationId(id);
    const { data } = await supabase.from("messages").select("role,content,citations").eq("conversation_id", id).order("created_at", { ascending: true });
    setMessages((data ?? []).map((m: any) => ({ role: m.role, content: m.content, citations: m.citations })));
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || !conversationId || busy) return;
    setInput("");
    setBusy(true);
    setMessages(prev => [...prev, { role: "user", content }, { role: "assistant", content: "" }]);

    const { data: { session } } = await supabase.auth.getSession();
    let pendingCitations: Citation[] = [];

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ conversation_id: conversationId, message: content }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        if (res.status === 429) toast.error("Rate limit reached. Try again shortly.");
        else if (res.status === 402) toast.error("AI credits exhausted. Add credits in your workspace.");
        else toast.error(j.error || "Chat failed");
        setMessages(prev => prev.slice(0, -1));
        setBusy(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistant = "";
      let done = false;
      let currentEvent: string | null = null;

      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);

          if (line.startsWith("event: ")) { currentEvent = line.slice(7).trim(); continue; }
          if (line.trim() === "") { currentEvent = null; continue; }
          if (line.startsWith(":") || !line.startsWith("data: ")) continue;

          const payload = line.slice(6).trim();
          if (currentEvent === "citations") {
            try { pendingCitations = JSON.parse(payload); } catch {}
            currentEvent = null;
            continue;
          }
          if (payload === "[DONE]") { done = true; break; }
          try {
            const j = JSON.parse(payload);
            const piece = j.choices?.[0]?.delta?.content;
            if (piece) {
              assistant += piece;
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: assistant, citations: pendingCitations };
                return next;
              });
            }
          } catch {
            // partial json, push back
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
      // refresh sidebar (titles auto-update on first message)
      refreshConversations();
    } catch (e: any) {
      toast.error(e.message || "Network error");
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar />
      <div className="container grid flex-1 gap-4 py-6 md:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 shadow-soft">
          <Button onClick={newConversation} variant="outline" size="sm" className="w-full justify-start">
            <Plus className="mr-2 h-4 w-4" /> New chat
          </Button>
          <div className="mt-2 flex-1 overflow-auto">
            {conversations.map(c => (
              <button
                key={c.id}
                onClick={() => openConversation(c.id)}
                className={`w-full truncate rounded-md px-2 py-1.5 text-left text-sm transition ${
                  c.id === conversationId ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"
                }`}
              >
                {c.title}
              </button>
            ))}
          </div>
          <div className="rounded-md bg-secondary/60 p-2 text-xs text-muted-foreground">
            <ShieldCheck className="mr-1 inline h-3 w-3 text-evidence" />
            Answers cite peer-reviewed studies. Not medical advice.
          </div>
        </aside>

        {/* Chat */}
        <main className="flex flex-col rounded-2xl border border-border bg-card shadow-soft">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-6" style={{ maxHeight: "calc(100vh - 220px)" }}>
            {messages.length === 0 && (
              <div className="grid h-full place-items-center text-center">
                <div className="max-w-md">
                  <h2 className="font-serif text-3xl">Ask your evidence-based coach</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Every answer is grounded in indexed sports-science research.</p>
                  <div className="mt-6 grid gap-2">
                    {SUGGESTED.map(s => (
                      <button key={s} onClick={() => send(s)} className="rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition hover:border-accent">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-soft ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                }`}>
                  {m.role === "assistant" ? (
                    <>
                      {m.content ? (
                        <article className="prose prose-sm max-w-none text-foreground prose-p:my-2 prose-headings:font-serif">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                        </article>
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> thinking…</div>
                      )}
                      {m.citations && m.citations.length > 0 && (
                        <div className="mt-3 border-t border-border/60 pt-2">
                          <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <BookOpen className="h-3 w-3 text-evidence" /> Sources
                          </div>
                          <ol className="space-y-2 text-xs">
                            {m.citations.map((c, idx) => (
                              <li key={c.id} className="flex gap-2">
                                <span className="font-mono text-accent">[{idx + 1}]</span>
                                <div className="min-w-0 flex-1">
                                  {c.url ? (
                                    <a href={c.url} target="_blank" rel="noreferrer" className="font-medium hover:text-accent hover:underline">
                                      {c.title} ↗
                                    </a>
                                  ) : (
                                    <span className="font-medium">{c.title}</span>
                                  )}
                                  <div className="text-muted-foreground">{c.authors} ({c.year}) — {c.source}</div>
                                  {c.url && (
                                    <a href={c.url} target="_blank" rel="noreferrer" className="break-all text-accent hover:underline">
                                      {c.url}
                                    </a>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="flex gap-2 border-t border-border p-3"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about training, nutrition, recovery…"
              maxLength={2000}
              disabled={busy || !conversationId}
            />
            <Button type="submit" disabled={busy || !input.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </main>
      </div>
    </div>
  );
};

export default Chat;
