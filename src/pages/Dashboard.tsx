import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TopBar } from "@/components/TopBar";
import { Loader2, RefreshCw, Dumbbell, Salad, BookOpen, MessageSquare, Sliders, Camera, Upload, X } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

async function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

type Citation = { id: string; title: string; authors: string; year: number; source: string; url: string; topic?: string; similarity?: number };
type Plan = {
  id: string;
  workout_plan: any;
  meal_plan: any;
  rationale: string | null;
  citations: Citation[];
  created_at: string;
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [equipDialogOpen, setEquipDialogOpen] = useState(false);
  const [equipFile, setEquipFile] = useState<File | null>(null);
  const [equipPreview, setEquipPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data: prof } = await supabase.from("profiles").select("onboarded").eq("id", user.id).maybeSingle();
    if (!prof?.onboarded) { navigate("/onboarding"); return; }
    const { data } = await supabase.from("plans").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    setPlan((data as unknown) as Plan | null);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  async function regenerate(opts?: { equipmentImage?: string }) {
    setRegenerating(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(opts?.equipmentImage ? { equipment_image: opts.equipmentImage } : {}),
    });
    setRegenerating(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); toast.error(j.error || "Failed"); return; }
    const j = await res.json().catch(() => ({} as any));
    if (j?.equipment?.equipment?.length) {
      toast.success(`Plan tailored to: ${j.equipment.equipment.slice(0, 3).join(", ")}${j.equipment.equipment.length > 3 ? "…" : ""}`);
    } else {
      toast.success("New plan ready.");
    }
    load();
  }

  function onPickEquipFile(f: File | null) {
    if (!f) { setEquipFile(null); setEquipPreview(null); return; }
    if (!f.type.startsWith("image/")) { toast.error("Please select an image file."); return; }
    if (f.size > MAX_IMAGE_BYTES) { toast.error("Image must be under 5 MB."); return; }
    setEquipFile(f);
    const url = URL.createObjectURL(f);
    setEquipPreview(url);
  }

  async function submitEquipmentPhoto() {
    if (!equipFile) return;
    const dataUrl = await fileToDataURL(equipFile);
    setEquipDialogOpen(false);
    setEquipFile(null);
    setEquipPreview(null);
    await regenerate({ equipmentImage: dataUrl });
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar />
        <div className="container py-20 text-center">
          <h1 className="font-serif text-3xl">No plan yet</h1>
          <Button className="mt-4" onClick={() => regenerate()} disabled={regenerating}>
            {regenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate my plan
          </Button>
        </div>
      </div>
    );
  }

  const w = plan.workout_plan;
  const m = plan.meal_plan;

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <div className="container py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="evidence-chip"><BookOpen className="h-3 w-3" /> {plan.citations?.length ?? 0} sources</span>
            <h1 className="mt-2 font-serif text-4xl">Your plan</h1>
            <p className="text-sm text-muted-foreground">Generated {new Date(plan.created_at).toLocaleString()}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/onboarding"><Sliders className="mr-2 h-4 w-4" />Edit profile</Link></Button>
            <Button variant="outline" size="sm" onClick={() => setEquipDialogOpen(true)} disabled={regenerating}>
              <Camera className="mr-2 h-4 w-4" />From my equipment
            </Button>
            <Button variant="outline" size="sm" onClick={() => regenerate()} disabled={regenerating}>
              {regenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Regenerate
            </Button>
            <Button asChild size="sm"><Link to="/chat"><MessageSquare className="mr-2 h-4 w-4" />Ask the coach</Link></Button>
          </div>
        </div>

        <Tabs defaultValue="workout" className="w-full">
          <TabsList>
            <TabsTrigger value="workout"><Dumbbell className="mr-2 h-4 w-4" /> Workout</TabsTrigger>
            <TabsTrigger value="meals"><Salad className="mr-2 h-4 w-4" /> Meals</TabsTrigger>
            <TabsTrigger value="rationale"><BookOpen className="mr-2 h-4 w-4" /> Rationale & sources</TabsTrigger>
          </TabsList>

          <TabsContent value="workout" className="mt-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="grid gap-4 md:grid-cols-4">
                <Stat label="Split" value={w.split} />
                <Stat label="Sessions / wk" value={String(w.sessions_per_week)} />
                <Stat label="Min / session" value={String(w.minutes_per_session)} />
                <Stat label="Program" value={`${w.weeks} weeks`} />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{w.summary}</p>
              <p className="mt-2 text-sm"><span className="font-medium">Progression:</span> {w.progression}</p>
            </div>

            <div className="mt-6 grid gap-4">
              {w.days?.map((d: any, i: number) => (
                <div key={i} className="card-gradient rounded-2xl border border-border p-5 shadow-soft">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-serif text-xl">{d.day}</h3>
                    <span className="text-sm text-accent">{d.focus}</span>
                  </div>
                  {d.warmup && <p className="mt-1 text-xs text-muted-foreground"><span className="font-medium">Warm-up:</span> {d.warmup}</p>}
                  <ul className="mt-3 divide-y divide-border/60">
                    {d.exercises?.map((ex: any, j: number) => (
                      <li key={j} className="grid grid-cols-12 gap-2 py-2 text-sm">
                        <span className="col-span-5 font-medium">{ex.name}</span>
                        <span className="col-span-2 text-muted-foreground">{ex.sets} × {ex.reps}</span>
                        <span className="col-span-2 text-muted-foreground">RIR {ex.rir ?? "—"}</span>
                        <span className="col-span-3 text-muted-foreground">{ex.rest_seconds}s rest</span>
                        {ex.notes && <span className="col-span-12 text-xs text-muted-foreground">{ex.notes}</span>}
                      </li>
                    ))}
                  </ul>
                  {d.conditioning && <p className="mt-3 text-xs"><span className="font-medium">Conditioning:</span> {d.conditioning}</p>}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="meals" className="mt-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="grid gap-4 md:grid-cols-4">
                <Stat label="Daily kcal" value={String(m.daily_calories)} />
                <Stat label="Protein" value={`${m.macros.protein_g} g`} />
                <Stat label="Carbs" value={`${m.macros.carbs_g} g`} />
                <Stat label="Fat" value={`${m.macros.fat_g} g`} />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{m.summary}</p>
              <p className="mt-2 text-sm"><span className="font-medium">Diet notes:</span> {m.diet_notes}</p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {m.sample_day?.map((meal: any, i: number) => (
                <div key={i} className="card-gradient rounded-2xl border border-border p-5 shadow-soft">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-serif text-lg">{meal.meal} — {meal.name}</h3>
                    <span className="text-xs text-muted-foreground">{meal.calories} kcal</span>
                  </div>
                  <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                    {meal.items?.map((it: string, j: number) => <li key={j}>{it}</li>)}
                  </ul>
                  <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
                    <span>P {meal.protein_g}g</span><span>C {meal.carbs_g}g</span><span>F {meal.fat_g}g</span>
                  </div>
                </div>
              ))}
            </div>

            {m.swaps?.length > 0 && (
              <div className="mt-6 rounded-2xl border border-border bg-secondary/40 p-5">
                <h4 className="mb-2 font-serif text-lg">Swap ideas</h4>
                <ul className="grid gap-2 md:grid-cols-2">
                  {m.swaps.map((s: string, i: number) => <li key={i} className="text-sm text-muted-foreground">• {s}</li>)}
                </ul>
              </div>
            )}
          </TabsContent>

          <TabsContent value="rationale" className="mt-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <article className="prose prose-sm max-w-none text-foreground prose-headings:font-serif">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{plan.rationale ?? "(no rationale)"}</ReactMarkdown>
              </article>
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h3 className="mb-3 font-serif text-xl">Sources cited</h3>
              {(!plan.citations || plan.citations.length === 0) ? (
                <p className="text-sm text-muted-foreground">
                  No sources attached to this plan. Click <span className="font-medium text-foreground">Regenerate</span> above to rebuild it with the latest research index.
                </p>
              ) : (
                <ol className="space-y-3">
                  {plan.citations.map((c, i) => (
                    <li key={c.id} className="flex gap-3 text-sm">
                      <span className="mt-0.5 font-mono text-xs text-accent">[{i + 1}]</span>
                      <div className="min-w-0 flex-1">
                        {c.url ? (
                          <a href={c.url} target="_blank" rel="noreferrer" className="font-medium text-foreground hover:text-accent hover:underline">
                            {c.title} ↗
                          </a>
                        ) : (
                          <div className="font-medium">{c.title}</div>
                        )}
                        <div className="text-xs text-muted-foreground">{c.authors} — {c.source} ({c.year})</div>
                        {c.url && (
                          <a href={c.url} target="_blank" rel="noreferrer" className="break-all text-xs text-accent hover:underline">
                            {c.url}
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={equipDialogOpen} onOpenChange={(o) => { setEquipDialogOpen(o); if (!o) { setEquipFile(null); setEquipPreview(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Generate from your equipment</DialogTitle>
            <DialogDescription>
              Upload one photo of your gym, home setup, or available equipment. Our vision agent will inventory what's visible and the workout will be constrained to those exact tools.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onPickEquipFile(e.target.files?.[0] ?? null)}
            />

            {!equipPreview ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/30 p-10 text-sm text-muted-foreground transition hover:border-accent hover:bg-secondary/60"
              >
                <Upload className="h-6 w-6" />
                <span className="font-medium text-foreground">Tap to upload a photo</span>
                <span className="text-xs">PNG, JPG up to 5 MB</span>
              </button>
            ) : (
              <div className="relative overflow-hidden rounded-2xl border border-border">
                <img src={equipPreview} alt="Equipment preview" className="h-64 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => onPickEquipFile(null)}
                  className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-background/90 text-foreground shadow-soft hover:bg-background"
                  aria-label="Remove image"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Optional — if you skip this, the regular Regenerate button uses your profile only.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEquipDialogOpen(false)} disabled={regenerating}>Cancel</Button>
            <Button onClick={submitEquipmentPhoto} disabled={!equipFile || regenerating}>
              {regenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
              Generate plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-serif text-2xl text-foreground">{value}</div>
    </div>
  );
}

export default Dashboard;
