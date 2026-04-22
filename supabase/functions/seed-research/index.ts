// Seed the research_corpus with curated sports-science / nutrition abstracts.
// Idempotent: only inserts rows when corpus is empty (or ?force=1 wipes & reseeds).
// Retrieval uses Postgres full-text search (no embeddings needed).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Doc = {
  title: string; authors: string; year: number; source: string; url: string;
  topic: string; content: string;
};

const CORPUS: Doc[] = [
  // ===== Resistance training =====
  { title: "Effects of resistance training frequency on measures of muscle hypertrophy: a systematic review and meta-analysis", authors: "Schoenfeld BJ et al.", year: 2016, source: "Sports Medicine", url: "https://pubmed.ncbi.nlm.nih.gov/27102172/", topic: "training_frequency",
    content: "When volume is equated, training a muscle group twice per week produces superior hypertrophy versus once per week. Higher frequencies (3+/wk) confer no additional hypertrophic benefit when volume is matched, but may improve recoverable volume distribution." },
  { title: "Dose-response relationship between weekly resistance training volume and increases in muscle mass: A systematic review and meta-analysis", authors: "Schoenfeld BJ, Ogborn D, Krieger JW", year: 2017, source: "Journal of Sports Sciences", url: "https://pubmed.ncbi.nlm.nih.gov/27433992/", topic: "training_volume",
    content: "A graded dose-response exists: muscle hypertrophy increases with weekly set volume up to roughly 10+ sets per muscle group per week, with diminishing returns thereafter. Most lifters benefit from 10-20 hard sets per muscle/week." },
  { title: "Loading recommendations for muscle strength, hypertrophy, and local endurance: a re-examination of the repetition continuum", authors: "Schoenfeld BJ, Grgic J, Van Every DW, Plotkin DL", year: 2021, source: "Sports", url: "https://pubmed.ncbi.nlm.nih.gov/33572369/", topic: "rep_ranges",
    content: "Hypertrophy can be achieved across a wide spectrum of loads (~30-85% 1RM) provided sets are taken close to failure. Heavier loads (≥80% 1RM) are superior for maximal strength; lighter loads with high effort still produce comparable hypertrophy." },
  { title: "Resistance training-induced changes in integrated myofibrillar protein synthesis are related to hypertrophy only after attenuation of muscle damage", authors: "Damas F et al.", year: 2016, source: "Journal of Physiology", url: "https://pubmed.ncbi.nlm.nih.gov/26852939/", topic: "recovery",
    content: "Early increases in muscle protein synthesis after novel resistance training reflect repair of damage; chronic hypertrophy depends on protein synthesis once damage is attenuated, supporting consistent training over weeks for measurable growth." },
  { title: "Greater effects than traditional moderate-intensity continuous training in cardiometabolic risk factors", authors: "Ramos JS et al.", year: 2015, source: "Sports Medicine", url: "https://pubmed.ncbi.nlm.nih.gov/25739559/", topic: "cardio_hiit",
    content: "High-intensity interval training (HIIT) produces equal or greater improvements in VO2max and cardiometabolic markers compared with moderate-intensity continuous training in less total time, especially in time-constrained adults." },

  // ===== Hypertrophy mechanisms =====
  { title: "Mechanisms of muscle hypertrophy and their application to resistance training", authors: "Schoenfeld BJ", year: 2010, source: "JSCR", url: "https://pubmed.ncbi.nlm.nih.gov/20847704/", topic: "hypertrophy_mechanisms",
    content: "Three primary mechanisms drive hypertrophy: mechanical tension (heaviest contributor), metabolic stress, and muscle damage. Programs should prioritize progressive overload of mechanical tension across an 8-30 rep range." },
  { title: "Resistance training to momentary muscular failure improves cardiovascular fitness in humans: A systematic review", authors: "Grgic J et al.", year: 2022, source: "Sports Medicine", url: "https://pubmed.ncbi.nlm.nih.gov/34762293/", topic: "training_to_failure",
    content: "Training to failure is not required for hypertrophy when volume is equated. Stopping 1-3 reps short of failure (RIR 1-3) produces equivalent muscle growth with less fatigue and better recovery." },

  // ===== Cardio & fat loss =====
  { title: "Aerobic vs resistance exercise for the prevention and treatment of obesity: a systematic review", authors: "Wewege MA et al.", year: 2017, source: "Obesity Reviews", url: "https://pubmed.ncbi.nlm.nih.gov/28401638/", topic: "fat_loss_modality",
    content: "For body-weight reduction, aerobic exercise produces greater fat loss than resistance training alone in the short term, but combined training preserves lean mass while reducing fat — preferred for body recomposition." },
  { title: "Energy compensation and adiposity in humans", authors: "Careau V et al.", year: 2021, source: "Current Biology", url: "https://pubmed.ncbi.nlm.nih.gov/34453887/", topic: "energy_balance",
    content: "Total daily energy expenditure compensates for activity energy expenditure: roughly 28% of activity calories are offset by reduced resting metabolism. Diet remains the primary lever for fat loss; activity supports maintenance." },
  { title: "American College of Sports Medicine position stand: appropriate physical activity intervention strategies for weight loss", authors: "Donnelly JE et al.", year: 2009, source: "MSSE", url: "https://pubmed.ncbi.nlm.nih.gov/19127177/", topic: "activity_for_weight_loss",
    content: "≥150 min/wk of moderate activity is needed for modest weight loss; 200-300 min/wk is recommended for clinically significant weight loss and weight-loss maintenance in adults with overweight/obesity." },

  // ===== Protein =====
  { title: "A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains", authors: "Morton RW et al.", year: 2018, source: "BJSM", url: "https://pubmed.ncbi.nlm.nih.gov/28698222/", topic: "protein_intake",
    content: "Protein supplementation augments strength and hypertrophy gains during resistance training. Optimal intake plateaus around 1.6 g/kg/day (95% CI 1.03-2.20). Higher intakes (~2.2 g/kg) may benefit those in a caloric deficit." },
  { title: "How much protein can the body use in a single meal for muscle-building?", authors: "Schoenfeld BJ, Aragon AA", year: 2018, source: "JISSN", url: "https://pubmed.ncbi.nlm.nih.gov/29497353/", topic: "protein_distribution",
    content: "To maximize muscle anabolism, aim for ~0.4 g/kg of high-quality protein per meal across a minimum of 4 meals/day, totaling ~1.6 g/kg/day. There is no upper bound preventing muscle gain from larger doses, but distribution matters." },
  { title: "International Society of Sports Nutrition position stand: protein and exercise", authors: "Jäger R et al.", year: 2017, source: "JISSN", url: "https://pubmed.ncbi.nlm.nih.gov/28642676/", topic: "protein_quality",
    content: "Daily protein 1.4-2.0 g/kg supports trained individuals. Leucine-rich, complete proteins (whey, dairy, eggs, soy, mixed plant blends) maximize muscle protein synthesis. Plant-based athletes should increase total intake ~10-20%." },
  { title: "Plant-based diets, pescatarian diets and COVID-19 severity: a population-based case-control study", authors: "Kim H et al.", year: 2021, source: "BMJ Nutrition", url: "https://pubmed.ncbi.nlm.nih.gov/34631113/", topic: "plant_based_health",
    content: "Plant-based and pescatarian dietary patterns are associated with favorable cardiometabolic profiles and lower disease severity, supporting their use within performance nutrition when protein adequacy is met." },

  // ===== Caloric deficit / energy =====
  { title: "Effect of dietary protein intake on body composition changes after weight loss in older women: a randomized controlled trial", authors: "Mojtahedi MC et al.", year: 2011, source: "JGSA", url: "https://pubmed.ncbi.nlm.nih.gov/21844284/", topic: "deficit_protein",
    content: "Higher protein intake (≈1.4 g/kg) during caloric restriction preserves lean body mass and improves fat-loss quality compared with standard protein intake (~0.8 g/kg)." },
  { title: "Energy balance and obesity", authors: "Hall KD et al.", year: 2012, source: "Circulation", url: "https://pubmed.ncbi.nlm.nih.gov/22290836/", topic: "energy_balance",
    content: "Sustained negative energy balance is required for fat loss. A 500 kcal/day deficit predicts ~0.45 kg/week fat loss initially but adapts over time; aggressive deficits (>30%) accelerate lean-mass loss and metabolic adaptation." },

  // ===== Carbohydrates / fueling =====
  { title: "Carbohydrates for training and competition", authors: "Burke LM et al.", year: 2011, source: "Journal of Sports Sciences", url: "https://pubmed.ncbi.nlm.nih.gov/21660838/", topic: "carbohydrate_fueling",
    content: "Carbohydrate needs scale with training load: 3-5 g/kg/day for low-intensity, 5-7 for moderate, 6-10 for endurance, up to 10-12 for very high loads. Pre/post-session carbs improve performance and recovery." },
  { title: "Low-carbohydrate diets in athletes", authors: "Burke LM", year: 2021, source: "Sports Medicine", url: "https://pubmed.ncbi.nlm.nih.gov/33877614/", topic: "low_carb_athletes",
    content: "Ketogenic / very-low-carb diets impair high-intensity performance despite improving fat oxidation. Periodized carbohydrate availability is more effective for performance than chronic restriction." },

  // ===== Fats =====
  { title: "Dietary fats and cardiovascular disease: a presidential advisory from the American Heart Association", authors: "Sacks FM et al.", year: 2017, source: "Circulation", url: "https://pubmed.ncbi.nlm.nih.gov/28620111/", topic: "dietary_fats",
    content: "Replacing saturated fat with polyunsaturated fat lowers LDL cholesterol and cardiovascular disease risk by ~30%, comparable to statins. Aim for unsaturated fats from nuts, seeds, oily fish, olive oil." },
  { title: "Marine-derived n-3 fatty acids and cardiovascular outcomes", authors: "Hu Y et al.", year: 2019, source: "JAHA", url: "https://pubmed.ncbi.nlm.nih.gov/31567003/", topic: "omega_3",
    content: "Marine omega-3 (EPA+DHA) intake of 1-2 g/day reduces fatal cardiac events and may aid recovery and inflammation modulation in athletes." },

  // ===== Vegan / vegetarian performance =====
  { title: "Vegan diets and performance: a systematic review", authors: "Wirnitzer K et al.", year: 2022, source: "Nutrients", url: "https://pubmed.ncbi.nlm.nih.gov/35334924/", topic: "vegan_performance",
    content: "Well-planned vegan diets support athletic performance equivalent to omnivorous diets. Key considerations: total protein (≥1.6 g/kg), B12 supplementation, iron bioavailability, leucine-rich legumes, and creatine for strength athletes." },

  // ===== Sleep / recovery =====
  { title: "Sleep and athletic performance", authors: "Walsh NP et al.", year: 2021, source: "BJSM", url: "https://pubmed.ncbi.nlm.nih.gov/33144349/", topic: "sleep",
    content: "Sleep duration <7 h/night impairs reaction time, accuracy, endurance, and recovery while increasing injury risk. 7-9 h/night plus consistent timing is recommended for trained adults." },
  { title: "The effects of acute sleep restriction on muscular and aerobic performance: a systematic review", authors: "Craven J et al.", year: 2022, source: "Sports Medicine", url: "https://pubmed.ncbi.nlm.nih.gov/34478108/", topic: "sleep_performance",
    content: "Acute sleep restriction (<6 h) consistently reduces submaximal endurance and high-intensity efforts; maximal strength is more resilient short-term but degrades with chronic restriction." },

  // ===== Beginner programming / hours-per-week =====
  { title: "Minimum effective training dose required to increase 1RM strength in resistance-trained men", authors: "Androulakis-Korakakis P et al.", year: 2020, source: "Sports Medicine", url: "https://pubmed.ncbi.nlm.nih.gov/31797219/", topic: "minimum_effective_dose",
    content: "Even a single hard set per exercise, 2-3x/week, produces meaningful strength gains in trained men, supporting time-efficient programs (~3 hours/week) for general strength goals." },
  { title: "Time-efficient resistance training: physiological and practical advances", authors: "Iversen VM et al.", year: 2021, source: "Sports Medicine", url: "https://pubmed.ncbi.nlm.nih.gov/33453015/", topic: "time_efficient_training",
    content: "Strategies such as supersets, drop sets, low-volume high-effort training and full-body splits achieve hypertrophy and strength comparable to higher-volume programs in 30-50% less time, ideal for ≤4 h/week trainees." },

  // ===== Cardio for endurance =====
  { title: "Polarized training has greater impact on key endurance variables than threshold or high intensity training", authors: "Stöggl T, Sperlich B", year: 2014, source: "Frontiers in Physiology", url: "https://pubmed.ncbi.nlm.nih.gov/24550842/", topic: "endurance_training",
    content: "An 80/20 polarized model — ~80% of training at low intensity (Z1-2) and ~20% at high intensity — outperforms purely threshold or HIIT-only approaches for VO2max and time-trial performance." },

  // ===== Hydration / micronutrients =====
  { title: "American College of Sports Medicine position stand: exercise and fluid replacement", authors: "Sawka MN et al.", year: 2007, source: "MSSE", url: "https://pubmed.ncbi.nlm.nih.gov/17277604/", topic: "hydration",
    content: "Aim to limit body-mass loss to <2% during exercise. Pre-exercise: 5-10 mL/kg fluid 2-4 h prior. During: 0.4-0.8 L/h adjusted by sweat rate. Post: 1.25-1.5 L per kg of body mass lost." },
  { title: "International Society of Sports Nutrition position stand: caffeine and exercise performance", authors: "Guest NS et al.", year: 2021, source: "JISSN", url: "https://pubmed.ncbi.nlm.nih.gov/33388079/", topic: "caffeine",
    content: "Caffeine 3-6 mg/kg, 60 min pre-exercise, reliably improves endurance, sprint, and strength performance in most adults. Effects are minimal at <2 mg/kg and side-effect risk rises above 9 mg/kg." },

  // ===== Goal-specific adherence =====
  { title: "Adherence to behavior change techniques in physical activity interventions for adults", authors: "Samdal GB et al.", year: 2017, source: "IJBNPA", url: "https://pubmed.ncbi.nlm.nih.gov/28283022/", topic: "adherence",
    content: "Self-monitoring, goal-setting, and feedback are the behavior-change techniques most strongly associated with sustained adherence to exercise programs in adults." },
  { title: "Exercise prescription for the prevention and treatment of cardiovascular disease", authors: "Pelliccia A et al.", year: 2020, source: "European Heart Journal", url: "https://pubmed.ncbi.nlm.nih.gov/32860412/", topic: "general_health",
    content: "150-300 min/wk moderate or 75-150 min/wk vigorous aerobic exercise plus 2 sessions of resistance training reduces all-cause mortality and cardiovascular events. Both intensities are effective when total volume is matched." },

  // ===== Mediterranean / dietary patterns =====
  { title: "Mediterranean diet and cardiovascular disease prevention: an updated meta-analysis", authors: "Martínez-González MA et al.", year: 2019, source: "Progress in Cardiovascular Diseases", url: "https://pubmed.ncbi.nlm.nih.gov/30922976/", topic: "mediterranean_diet",
    content: "Adherence to a Mediterranean dietary pattern is associated with a 25-30% reduction in cardiovascular events. Emphasis: olive oil, vegetables, legumes, fish, whole grains, moderate dairy, limited red meat." },
  { title: "Effects of low-carbohydrate vs low-fat diets on weight loss and cardiovascular risk factors", authors: "Bazzano LA et al.", year: 2014, source: "Annals of Internal Medicine", url: "https://pubmed.ncbi.nlm.nih.gov/25178568/", topic: "diet_comparison",
    content: "Low-carbohydrate and low-fat hypocaloric diets produce similar long-term weight loss when calories are matched and adherence is similar. Choose the pattern the individual can sustain." },

  // ===== Women / hormones =====
  { title: "Methodological considerations for studies in sport and exercise science with women as participants", authors: "Elliott-Sale KJ et al.", year: 2021, source: "Sports Medicine", url: "https://pubmed.ncbi.nlm.nih.gov/33369707/", topic: "female_training",
    content: "Female athletes can train and gain similarly to males with appropriate programming. Menstrual-cycle phase has small/variable effects on performance; individualization and adequate energy availability matter most." },
];

function chunkContent(d: Doc) {
  return `${d.title}\n${d.topic}\n${d.content}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (force) await supabase.from("research_corpus").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const { count } = await supabase.from("research_corpus").select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0 && !force) {
      return new Response(JSON.stringify({ ok: true, skipped: true, count }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Bulk insert — no embeddings needed; retrieval uses Postgres full-text search.
    const rows = CORPUS.map(d => ({ ...d }));
    const { error, count: inserted } = await supabase
      .from("research_corpus")
      .insert(rows, { count: "exact" });
    if (error) {
      console.error("bulk insert", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, inserted: inserted ?? rows.length, total: CORPUS.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seed fatal", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
