import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TopBar } from "@/components/TopBar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

const goals = [
  { v: "lose_fat", l: "Lose fat" },
  { v: "build_muscle", l: "Build muscle" },
  { v: "recomp", l: "Recomposition" },
  { v: "maintain", l: "Maintain" },
  { v: "endurance", l: "Endurance" },
];
const activityLevels = [
  { v: "sedentary", l: "Sedentary (desk job)" },
  { v: "light", l: "Light (occasional walks)" },
  { v: "moderate", l: "Moderate (active job/hobbies)" },
  { v: "active", l: "Active (on feet most of day)" },
  { v: "very_active", l: "Very active (manual labor / sport)" },
];
const diets = [
  "omnivore","vegetarian","vegan","pescatarian","keto","paleo","mediterranean","halal","kosher","gluten_free",
];

const Onboarding = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    gender: "male",
    age: 28,
    height_cm: 175,
    current_weight_kg: 75,
    goal_weight_kg: 72,
    goal: "build_muscle",
    activity_level: "moderate",
    hours_per_week: 4,
    diet_preference: "omnivore",
    allergies: "",
  });

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth"); return; }
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setForm(f => ({
          ...f,
          ...Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== null && v !== undefined)),
        }));
        if (data.onboarded) setIsEditing(true);
      }
    });
  }, [user, loading, navigate]);

  async function save() {
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      ...form,
      onboarded: true,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile saved. Generating your plan…");
    setGenerating(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });
    setGenerating(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Plan generation failed");
      return;
    }
    navigate("/dashboard");
  }

  if (loading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <div className="container max-w-2xl py-12">
        <div className="mb-8">
          <span className="evidence-chip"><Sparkles className="h-3 w-3" /> {isEditing ? "Edit profile" : "Step 1 of 1"}</span>
          <h1 className="mt-3 font-serif text-4xl">{isEditing ? "Update your profile" : "Tell us about you"}</h1>
          <p className="text-muted-foreground">{isEditing ? "Changes will be used to regenerate your plan." : "We'll match you to evidence-based programming and nutrition."}</p>
        </div>

        <div className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name">
              <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} maxLength={80} />
            </Field>
            <Field label="Gender">
              <Select value={form.gender} onValueChange={v => setForm({ ...form, gender: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="nonbinary">Non-binary</SelectItem>
                  <SelectItem value="prefer_not">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Age">
              <Input type="number" min={13} max={100} value={form.age} onChange={e => setForm({ ...form, age: Number(e.target.value) })} />
            </Field>
            <Field label="Height (cm)">
              <Input type="number" min={100} max={250} value={form.height_cm} onChange={e => setForm({ ...form, height_cm: Number(e.target.value) })} />
            </Field>
            <Field label="Current weight (kg)">
              <Input type="number" min={30} max={300} value={form.current_weight_kg} onChange={e => setForm({ ...form, current_weight_kg: Number(e.target.value) })} />
            </Field>
            <Field label="Goal weight (kg)">
              <Input type="number" min={30} max={300} value={form.goal_weight_kg} onChange={e => setForm({ ...form, goal_weight_kg: Number(e.target.value) })} />
            </Field>
            <Field label="Goal">
              <Select value={form.goal} onValueChange={v => setForm({ ...form, goal: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {goals.map(g => <SelectItem key={g.v} value={g.v}>{g.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Activity level (outside training)">
              <Select value={form.activity_level} onValueChange={v => setForm({ ...form, activity_level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {activityLevels.map(a => <SelectItem key={a.v} value={a.v}>{a.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <Label>Hours you can train per week</Label>
              <span className="font-mono text-sm text-accent">{form.hours_per_week} h</span>
            </div>
            <Slider min={1} max={15} step={0.5} value={[form.hours_per_week]} onValueChange={([v]) => setForm({ ...form, hours_per_week: v })} />
          </div>

          <Field label="Diet preference">
            <Select value={form.diet_preference} onValueChange={v => setForm({ ...form, diet_preference: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {diets.map(d => <SelectItem key={d} value={d} className="capitalize">{d.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Allergies, dislikes, or restrictions (optional)">
            <Input value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })} placeholder="e.g. no shellfish, lactose intolerant" maxLength={300} />
          </Field>

          <Button onClick={save} className="w-full" size="lg" disabled={submitting || generating}>
            {(submitting || generating) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {generating ? "Regenerating your plan (about 20s)…" : isEditing ? "Save & regenerate my plan" : "Save & generate my plan"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Educational use only — not medical advice. Consult a clinician for medical conditions.
          </p>
        </div>
      </div>
    </div>
  );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}

export default Onboarding;
