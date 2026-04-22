import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/TopBar";
import { ArrowRight, BookOpen, Brain, Dumbbell, Salad, Shield, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import heroImg from "@/assets/hero.jpg";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="container grid gap-12 py-16 md:grid-cols-2 md:items-center md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            <span className="evidence-chip">
              <Sparkles className="h-3 w-3" /> Backed by peer-reviewed research
            </span>
            <h1 className="font-serif text-5xl leading-[1.05] md:text-7xl">
              Train and eat
              <span className="block italic text-accent">by the evidence.</span>
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              EvidenceFit builds your workout and meal plan from your goals and the
              latest sports-science literature — then a coach answers your questions
              with citations, not guesses.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild size="lg" className="shadow-soft">
                <Link to="/auth?mode=signup">Build my plan <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#how">How it works</a>
              </Button>
            </div>
            <div className="flex items-center gap-6 pt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-evidence" /> 30+ studies indexed</div>
              <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-evidence" /> Privacy first</div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-primary/20 via-accent/15 to-transparent blur-3xl" />
            <img
              src={heroImg}
              alt="Athlete in motion overlaid with research notes"
              width={1600}
              height={1024}
              className="rounded-2xl shadow-elegant ring-1 ring-border/60"
            />
            <div className="absolute -bottom-5 -left-5 hidden rounded-xl bg-card p-4 shadow-soft ring-1 ring-border md:block">
              <div className="text-xs text-muted-foreground">Citation example</div>
              <div className="font-mono text-sm text-foreground">Schoenfeld et al. (2017) — JSS</div>
              <div className="evidence-chip mt-1"><BookOpen className="h-3 w-3" /> Volume 10+ sets/wk</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* PILLARS */}
      <section id="how" className="border-y border-border/60 bg-secondary/40 py-20">
        <div className="container">
          <h2 className="mb-2 font-serif text-3xl md:text-4xl">A coach that shows its work.</h2>
          <p className="mb-12 max-w-2xl text-muted-foreground">
            Three specialists collaborate on your plan, then ground every recommendation in a citable source.
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { icon: Dumbbell, title: "Programmer agent", body: "Builds a resistance + conditioning split that fits your hours, equipment, and goal — using volume, frequency and intensity guidelines from the literature." },
              { icon: Salad, title: "Nutritionist agent", body: "Designs a meal pattern matched to your diet preference and allergies, with calories, macros, and one ready-to-cook day." },
              { icon: Brain, title: "RAG-grounded coach", body: "Ask anything. Answers are retrieved from a vector store of sports-science abstracts and cited inline — no hallucinated studies." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="card-gradient rounded-2xl border border-border p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-elegant duration-500 ease-smooth">
                <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-serif text-xl">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GUARDRAILS */}
      <section className="py-20">
        <div className="container grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <span className="evidence-chip"><Shield className="h-3 w-3" /> Safety by design</span>
            <h2 className="mt-3 font-serif text-3xl md:text-4xl">Honest about what AI can — and can't — do.</h2>
            <p className="mt-3 text-muted-foreground">
              Prompt-injection filters, scope guards, refusal of medical-emergency cases, and a strict
              "cite or qualify" rule. Plans are educational, not a replacement for a clinician.
            </p>
          </div>
          <ul className="space-y-3">
            {[
              "User input is sanitized and screened for jailbreak patterns",
              "Health emergencies route to local emergency services, not an LLM",
              "Every meaningful claim is cited from the indexed corpus or marked as general guidance",
              "Conversation memory is private and scoped to your account only",
            ].map(t => (
              <li key={t} className="flex gap-3 rounded-lg border border-border bg-card p-4 text-sm shadow-soft">
                <span className="mt-1 h-2 w-2 flex-none rounded-full bg-evidence" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="hero-gradient">
        <div className="container py-16 text-center text-primary-foreground">
          <h2 className="font-serif text-3xl md:text-5xl">Your evidence-based plan, in 60 seconds.</h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
            Tell us your goal, weight, and how many hours you can train. We do the rest.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-6">
            <Link to="/auth?mode=signup">Create your plan <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} EvidenceFit. Educational use only. Not medical advice.
      </footer>
    </div>
  );
};

export default Index;
