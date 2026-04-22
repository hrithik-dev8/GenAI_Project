// Multi-agent plan generator.
// Agents: (0) Vision Equipment Agent (optional), (1) Workout Programmer, (2) Sports Nutritionist, (3) Coach Synthesizer.
// Each agent receives the user profile + retrieved research; outputs structured JSON via tool-calling.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ChatOpenAI } from "npm:@langchain/openai";
import { SystemMessage, HumanMessage } from "npm:@langchain/core/messages";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LLM_API_KEY = Deno.env.get("LLM_API_KEY")!;
const LLM_BASE_URL = Deno.env.get("LLM_BASE_URL") || "https://api.groq.com/openai/v1";
const LLM_MODEL = Deno.env.get("LLM_MODEL") || "llama-3.3-70b-versatile";
const LLM_VISION_MODEL = Deno.env.get("LLM_VISION_MODEL") || "llama-3.2-90b-vision-preview";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function retrieve(supabase: any, query: string, k = 6) {
  const { data, error } = await supabase.rpc("match_research_text", { query_text: query, match_count: k, topic_filter: null });
  if (error) { console.error("rpc match_research_text", error); return []; }
  return data ?? [];
}

function citationsFromDocs(docs: any[]) {
  return docs.map((d: any) => ({
    id: d.id, title: d.title, authors: d.authors, year: d.year, source: d.source, url: d.url, topic: d.topic, similarity: d.similarity,
  }));
}

function evidencePack(docs: any[]) {
  return docs.map((d: any, i: number) =>
    `[${i + 1}] ${d.title} — ${d.authors} (${d.year}, ${d.source}). ${d.content}`
  ).join("\n\n");
}

async function callAgent(opts: { system: string; user: string | any[]; toolName: string; toolDesc: string; schema: any; model?: string }) {
  const llm = new ChatOpenAI({
    apiKey: LLM_API_KEY,
    configuration: { baseURL: LLM_BASE_URL },
    modelName: opts.model ?? LLM_MODEL,
    maxRetries: 2,
  });

  const structuredLlm = llm.withStructuredOutput(opts.schema, {
    name: opts.toolName,
  });

  const messages = [
    new SystemMessage(opts.system),
    new HumanMessage({ content: opts.user as any }),
  ];

  try {
    const result = await structuredLlm.invoke(messages);
    return result;
  } catch (e: any) {
    if (e.status === 429) throw new Error("RATE_LIMIT");
    if (e.status === 402) throw new Error("CREDITS");
    throw new Error(`agent ${opts.toolName} failed: ${e.message || e}`);
  }
}

const equipmentSchema = {
  type: "object",
  properties: {
    setting: { type: "string", description: "e.g. 'home garage gym', 'commercial gym', 'hotel room', 'minimal home'" },
    equipment: {
      type: "array",
      items: { type: "string" },
      description: "Concrete equipment items visible (e.g. 'adjustable dumbbells up to ~25kg', 'flat bench', 'pull-up bar', 'squat rack with barbell', 'kettlebell 16kg', 'resistance bands'). Be specific about loadable weights when visible.",
    },
    constraints: { type: "string", description: "Notable limitations (no rack, low ceiling, limited weight, no cardio machines, etc.)" },
    notes: { type: "string", description: "Anything else relevant for programming (flooring, space, mirrors, suspension trainer, etc.)" },
  },
  required: ["setting", "equipment", "constraints"],
  additionalProperties: false,
};

const workoutSchema = {
  type: "object",
  properties: {
    summary: { type: "string", description: "1-2 sentence overview of the program structure" },
    split: { type: "string", description: "e.g. 'Upper/Lower 4x', 'Full body 3x', 'PPL 6x'" },
    sessions_per_week: { type: "number" },
    minutes_per_session: { type: "number" },
    weeks: { type: "number", description: "program length in weeks before reassessment" },
    progression: { type: "string", description: "How load/volume progresses week-to-week" },
    days: {
      type: "array",
      items: {
        type: "object",
        properties: {
          day: { type: "string" },
          focus: { type: "string" },
          warmup: { type: "string" },
          exercises: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                sets: { type: "number" },
                reps: { type: "string" },
                rir: { type: "string", description: "Reps in reserve, e.g. '1-3'" },
                rest_seconds: { type: "number" },
                notes: { type: "string" },
              },
              required: ["name","sets","reps","rest_seconds"],
              additionalProperties: false,
            }
          },
          conditioning: { type: "string", description: "Optional cardio/finisher" },
        },
        required: ["day","focus","exercises"],
        additionalProperties: false,
      }
    },
  },
  required: ["summary","split","sessions_per_week","minutes_per_session","weeks","progression","days"],
  additionalProperties: false,
};

const mealSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    daily_calories: { type: "number" },
    macros: {
      type: "object",
      properties: {
        protein_g: { type: "number" },
        carbs_g: { type: "number" },
        fat_g: { type: "number" },
        fiber_g: { type: "number" },
      },
      required: ["protein_g","carbs_g","fat_g"],
      additionalProperties: false,
    },
    diet_notes: { type: "string", description: "Key nutrient considerations for this user's diet preference & allergies" },
    sample_day: {
      type: "array",
      items: {
        type: "object",
        properties: {
          meal: { type: "string", description: "e.g. Breakfast" },
          name: { type: "string" },
          items: { type: "array", items: { type: "string" } },
          calories: { type: "number" },
          protein_g: { type: "number" },
          carbs_g: { type: "number" },
          fat_g: { type: "number" },
        },
        required: ["meal","name","items","calories","protein_g","carbs_g","fat_g"],
        additionalProperties: false,
      }
    },
    swaps: { type: "array", items: { type: "string" }, description: "Easy swaps for variety/preferences" },
  },
  required: ["summary","daily_calories","macros","diet_notes","sample_day","swaps"],
  additionalProperties: false,
};

const synthSchema = {
  type: "object",
  properties: {
    rationale_markdown: { type: "string", description: "Markdown explaining WHY this plan fits the user, citing sources as [1],[2]..." },
  },
  required: ["rationale_markdown"],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Optional image payload (data URL or base64). Keep parsing defensive — empty body is fine.
    let equipmentImage: string | null = null;
    if (req.headers.get("content-type")?.includes("application/json")) {
      try {
        const body = await req.json();
        if (body && typeof body.equipment_image === "string" && body.equipment_image.length > 0) {
          equipmentImage = body.equipment_image;
        }
      } catch { /* no body */ }
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: profile, error: pErr } = await admin.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (pErr || !profile) return new Response(JSON.stringify({ error: "profile not found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // ===== AGENT 0 (optional): Vision Equipment Agent =====
    let equipmentInfo: any = null;
    if (equipmentImage) {
      const imageUrl = equipmentImage.startsWith("data:")
        ? equipmentImage
        : `data:image/jpeg;base64,${equipmentImage}`;
      try {
        equipmentInfo = await callAgent({
          model: LLM_VISION_MODEL,
          system: "You are a fitness equipment auditor. Look at the photo and inventory the training equipment that is actually visible. Be conservative — only list equipment you can clearly see. Estimate loadable weights when plates/dumbbells are visible. If the photo shows something irrelevant (no equipment), set equipment to an empty array and explain in notes.",
          user: [
            { type: "text", text: "Inventory the training equipment in this photo. Submit via the tool." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
          toolName: "submit_equipment_inventory",
          toolDesc: "Submit the equipment visible in the photo.",
          schema: equipmentSchema,
        });
      } catch (e) {
        console.error("vision agent failed:", e);
        // Non-fatal — continue without equipment constraints.
      }
    }

    // Build retrieval queries from profile
    const goal = profile.goal ?? "general health";
    const diet = profile.diet_preference ?? "omnivore";
    const queryWorkout = `${goal} resistance training program for ${profile.activity_level} ${profile.gender} training ${profile.hours_per_week} hours per week. volume frequency progression`;
    const queryNutrition = `${goal} nutrition macros protein carbohydrate ${diet} diet for ${profile.gender} weight ${profile.current_weight_kg} kg`;

    const [workoutDocs, nutritionDocs] = await Promise.all([
      retrieve(admin, queryWorkout, 5),
      retrieve(admin, queryNutrition, 5),
    ]);

    const profileBlock = `User profile:
- Gender: ${profile.gender}
- Age: ${profile.age}
- Height: ${profile.height_cm} cm
- Current weight: ${profile.current_weight_kg} kg
- Goal weight: ${profile.goal_weight_kg ?? "n/a"} kg
- Goal: ${profile.goal}
- Activity level outside training: ${profile.activity_level}
- Hours available per week: ${profile.hours_per_week}
- Diet preference: ${profile.diet_preference}
- Allergies / restrictions: ${profile.allergies || "none stated"}`;

    const equipmentBlock = equipmentInfo
      ? `\n\nAVAILABLE EQUIPMENT (from user-uploaded photo):
- Setting: ${equipmentInfo.setting}
- Equipment: ${(equipmentInfo.equipment ?? []).join(", ") || "none clearly visible"}
- Constraints: ${equipmentInfo.constraints ?? "n/a"}
- Notes: ${equipmentInfo.notes ?? ""}

HARD CONSTRAINT: Every prescribed exercise MUST be performable with ONLY the equipment listed above (or pure bodyweight). Do not include barbell lifts if no barbell is listed, no cable work if no cables, etc. If equipment is sparse, lean on bodyweight progressions, tempo work, and unilateral variations.`
      : "";

    // ===== AGENT 1: Workout Programmer =====
    const workoutSystem = `You are a certified strength & conditioning coach. Design a safe, effective, evidence-based resistance + conditioning program. Use ONLY the research evidence provided as justification — never invent citations. Keep exercises mainstream and equipment-realistic. Match weekly time budget exactly. Output via the tool. No medical claims.`;
    const workoutUser = `${profileBlock}${equipmentBlock}\n\nResearch evidence:\n${evidencePack(workoutDocs)}`;
    const workoutPlan = await callAgent({
      system: workoutSystem, user: workoutUser,
      toolName: "submit_workout_plan", toolDesc: "Submit the structured workout program",
      schema: workoutSchema,
    });

    // ===== AGENT 2: Sports Nutritionist =====
    const nutritionSystem = `You are a registered sports dietitian. Design a daily meal pattern that fits the user's diet preference and allergies. Calorie target should match their goal (deficit for fat loss ~15-20%, surplus for muscle gain ~10%, maintenance otherwise). Hit ≥1.6 g/kg protein when training is in the picture. Provide ONE realistic sample day plus 4-6 swap ideas. Use only provided research as justification. Add an explicit safety note that this is general guidance, not medical advice.`;
    const nutritionUser = `${profileBlock}\n\nResearch evidence:\n${evidencePack(nutritionDocs)}`;
    const mealPlan = await callAgent({
      system: nutritionSystem, user: nutritionUser,
      toolName: "submit_meal_plan", toolDesc: "Submit the structured meal plan",
      schema: mealSchema,
    });

    // ===== AGENT 3: Coach Synthesizer =====
    const allDocs = [...workoutDocs, ...nutritionDocs];
    const seen = new Set<string>(); const merged = [];
    for (const d of allDocs) { if (!seen.has(d.id)) { seen.add(d.id); merged.push(d); } }

    const equipmentLine = equipmentInfo
      ? `\nEquipment used (from photo): ${(equipmentInfo.equipment ?? []).join(", ") || "minimal/bodyweight"}.`
      : "";
    const synthSystem = `You are an evidence-grounded fitness coach. Write a concise (≤300 words) markdown rationale explaining WHY the workout + meal plan suit this user. Cite sources inline using [n] notation matching the numbered list provided. Be honest about uncertainty. End with one short safety reminder.`;
    const synthUser = `${profileBlock}${equipmentLine}\n\nWorkout plan summary: ${workoutPlan.summary} (${workoutPlan.split}, ${workoutPlan.sessions_per_week}x/wk).\nMeal plan: ${mealPlan.daily_calories} kcal, ${mealPlan.macros.protein_g}g protein.\n\nNumbered evidence:\n${evidencePack(merged)}`;
    const synth = await callAgent({
      system: synthSystem, user: synthUser,
      toolName: "submit_rationale", toolDesc: "Submit the coach rationale",
      schema: synthSchema,
    });

    const citations = citationsFromDocs(merged);

    const { data: planRow, error: insErr } = await admin.from("plans").insert({
      user_id: user.id,
      workout_plan: workoutPlan,
      meal_plan: mealPlan,
      rationale: synth.rationale_markdown,
      citations,
    }).select().single();
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ ok: true, plan: planRow, equipment: equipmentInfo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    console.error("generate-plan", msg);
    if (msg === "RATE_LIMIT") return new Response(JSON.stringify({ error: "Rate limit reached. Please wait a moment and try again." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (msg === "CREDITS") return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
