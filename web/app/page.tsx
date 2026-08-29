"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useScroll, useTransform, useReducedMotion, Variants, MotionValue } from "framer-motion";
import { ArrowRight, ShieldCheck, Zap, Database, CheckCircle2, ChevronRight, Lock, Terminal, LayoutDashboard, X, ArrowDown } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

export default function LandingPage() {
  const { isLoaded, userId } = useAuth();
  const [activeTab, setActiveTab] = useState<'web' | 'cli'>('web');

  const prefersReducedMotion = useReducedMotion();
  const { scrollY } = useScroll();

  const beforeAfterRef = useRef<HTMLElement>(null);
  const { scrollYProgress: baProgress } = useScroll({
    target: beforeAfterRef,
    offset: ["start 80%", "end 55%"]
  });

  // Subtle scroll-linked animations for the unified hero
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 400], [1, 0.95]);
  const heroY = useTransform(scrollY, [0, 400], [0, 50]);
  
  const mockupScale = useTransform(scrollY, [0, 400], [1, 1.02]);
  const mockupY = useTransform(scrollY, [0, 400], [0, -30]);

  // Entrance animations
  const heroContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.1 } 
    }
  };

  const eyebrowVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };

  const headlineVariants: Variants = {
    hidden: { opacity: 0, y: 20, filter: prefersReducedMotion ? "none" : "blur(12px)" },
    visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 1, ease: "easeOut" } }
  };

  const textVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };

  const mockupVariants: Variants = {
    hidden: { opacity: 0, y: 60 },
    visible: { opacity: 1, y: 0, transition: { duration: 1.2, ease: "easeOut" } }
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground selection:bg-accent selection:text-accent-foreground font-sans">
      
      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[100vw] h-[600px] bg-accent/[0.04] blur-[150px] pointer-events-none" />

      {/* Navigation */}
      <motion.nav 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-5 glass border-b border-border"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-card flex items-center justify-center border border-accent/20 shadow-[0_0_15px_rgba(179,255,0,0.15)]">
            <span className="text-accent font-bold text-sm">R</span>
          </div>
          <span className="font-bold tracking-tight text-foreground">Recon Agent</span>
        </div>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          <Link href="#trust" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Product</Link>
          <Link href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">How It Works</Link>
          <Link href="#security" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Security</Link>
          <Link href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
          <Link href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Docs</Link>
        </div>

        <div className="flex items-center gap-6">
          {isLoaded && userId ? (
            <Link href="/dashboard" className="px-5 py-2 rounded-full bg-accent text-black text-sm font-semibold hover:bg-accent-hover neon-glow transition-all flex items-center gap-2">
              Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link href="/sign-in" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden md:block">
                Sign In
              </Link>
              <Link href="/sign-up" className="px-5 py-2 rounded-full bg-accent text-black text-sm font-semibold hover:bg-accent-hover neon-glow transition-all flex items-center gap-2">
                Get Started <ArrowRight className="w-4 h-4" />
              </Link>
            </>
          )}
        </div>
      </motion.nav>

      <main className="relative z-10 flex flex-col items-center justify-center pt-40 pb-20">
        
        {/* UNIFIED HERO + MOCKUP SECTION */}
        <motion.div 
          variants={heroContainerVariants}
          initial="hidden"
          animate="visible"
          className="w-full flex flex-col items-center"
        >
          {/* TEXT HERO */}
          <motion.section 
            style={{ 
              opacity: prefersReducedMotion ? 1 : heroOpacity, 
              scale: prefersReducedMotion ? 1 : heroScale,
              y: prefersReducedMotion ? 0 : heroY
            }}
            className="max-w-5xl w-full flex flex-col items-center text-center px-6"
          >
            <motion.div variants={eyebrowVariants} className="px-4 py-1.5 rounded-full border border-white/20 bg-white/5 text-gray-300 text-sm font-bold tracking-wider mb-8 flex items-center gap-2 shadow-sm">
              AI-POWERED RECONCILIATION
            </motion.div>

            <motion.h1 variants={headlineVariants} className="text-5xl md:text-7xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-gray-500 leading-[1.15] mb-6 max-w-4xl">
              Reconcile thousands of <br className="hidden md:block" />
              transactions in seconds.
            </motion.h1>

            <motion.p variants={textVariants} className="text-lg md:text-xl text-gray-400 max-w-3xl leading-relaxed mb-10">
              Automatically reconcile financial transactions using deterministic matching and AI-powered exception resolution. Use the web app for your finance team, or run reconciliation directly from the CLI.
            </motion.p>

            <motion.div variants={textVariants} className="flex flex-col sm:flex-row items-center gap-4 mb-16">
              {isLoaded && userId ? (
                <Link 
                  href="/dashboard" 
                  className="group px-8 py-4 rounded-full bg-[#b3ff00] text-black font-semibold transition-all hover:bg-[#ccff33] neon-glow flex items-center gap-2 text-lg"
                >
                  Go to Dashboard
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              ) : (
                <>
                  <Link 
                    href="/sign-up" 
                    className="group px-8 py-4 rounded-full bg-[#b3ff00] text-black font-semibold transition-all hover:bg-[#ccff33] neon-glow flex items-center gap-2 text-lg"
                  >
                    Start Reconciling
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link 
                    href="#" 
                    className="px-8 py-4 rounded-full border border-white/20 bg-white/5 backdrop-blur-md text-white font-medium hover:bg-white/10 transition-colors text-lg flex items-center gap-2"
                  >
                    Read the Docs
                  </Link>
                </>
              )}
            </motion.div>
          </motion.section>

          {/* UNIFIED MOCKUP SECTION (NOW PART OF THE HERO) */}
          <motion.section 
            variants={mockupVariants}
            style={{ 
              scale: prefersReducedMotion ? 1 : mockupScale,
              y: prefersReducedMotion ? 0 : mockupY
            }}
            className="w-full max-w-4xl px-6 relative z-20"
          >
            <div className="relative rounded-2xl border border-border bg-card shadow-[0_0_80px_rgba(0,0,0,0.4)] dark:shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden">
              
              {/* Top Bar with Web App / CLI Tabs */}
              <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-muted">
                <div className="flex items-center gap-2 w-24">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                
                <div className="flex bg-[#050505] p-1 rounded-lg border border-border">
                  <button 
                    onClick={() => setActiveTab('web')}
                    className={`px-4 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-2 ${activeTab === 'web' ? 'bg-[#1a1a1a] text-white shadow-sm border border-white/5' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" /> Web App
                  </button>
                  <button 
                    onClick={() => setActiveTab('cli')}
                    className={`px-4 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-2 ${activeTab === 'cli' ? 'bg-[#1a1a1a] text-white shadow-sm border border-white/5' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    <Terminal className="w-3.5 h-3.5" /> CLI
                  </button>
                </div>

                <div className="w-24 hidden sm:flex justify-end text-xs font-semibold text-gray-500">
                  RECON AGENT
                </div>
              </div>

              {/* Content Area */}
              <div className="min-h-[300px] bg-[#050505] relative">
                {activeTab === 'web' ? (
                  <div className="p-8 animate-in fade-in duration-300">
                    <div className="flex items-center gap-4 p-5 border border-[#b3ff00]/30 bg-[#b3ff00]/5 rounded-xl mb-6">
                      <div className="bg-[#b3ff00]/20 p-2.5 rounded-full text-[#b3ff00]">
                        <CheckCircle2 size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">Reconciliation Complete</h3>
                        <p className="text-gray-400 text-sm mt-0.5">Run ID: <span className="font-mono text-xs">rec_8f72k9d</span></p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-[#1a1a1a] p-4 rounded-xl border border-white/10">
                        <div className="text-gray-400 text-xs font-medium mb-1">Total Records</div>
                        <div className="text-xl font-bold text-white">2,450</div>
                      </div>
                      <div className="bg-[#1a1a1a] p-4 rounded-xl border border-white/10">
                        <div className="text-gray-400 text-xs font-medium mb-1">Exact Matches</div>
                        <div className="text-xl font-bold text-white">2,104</div>
                      </div>
                      <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[#b3ff00]/30">
                        <div className="text-[#b3ff00] text-xs font-medium mb-1">AI Matches</div>
                        <div className="text-xl font-bold text-white">342</div>
                      </div>
                      <div className="bg-[#1a1a1a] p-4 rounded-xl border border-red-500/30">
                        <div className="text-red-400 text-xs font-medium mb-1">Exceptions</div>
                        <div className="text-xl font-bold text-white">4</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 font-mono text-sm leading-relaxed text-gray-300 animate-in fade-in duration-300">
                    <div className="flex gap-2"><span className="text-[#b3ff00]">$</span> <span>recon-agent reconcile \</span></div>
                    <div className="pl-6 text-gray-400">--payments payments.csv \</div>
                    <div className="pl-6 text-gray-400">--ledger ledger.csv</div>
                    <div className="mt-6 text-gray-500">Processing 2,450 transactions...</div>
                    
                    <div className="mt-6 flex gap-3"><span className="text-green-500">✓</span> <span>2,104 exact matches</span></div>
                    <div className="flex gap-3"><span className="text-[#b3ff00]">✓</span> <span>  342 AI matches</span></div>
                    <div className="flex gap-3"><span className="text-red-400 font-bold">!</span> <span>    4 exceptions</span></div>
                    
                    <div className="mt-6 text-white font-bold">Reconciliation complete.</div>
                  </div>
                )}
              </div>

            </div>
          </motion.section>
        </motion.div>

        {/* CHAPTER 2: FINANCIAL DATA */}
        <motion.section 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, margin: "-50px" }}
          variants={{
            hidden: { opacity: 0 },
            visible: { 
              opacity: 1,
              transition: { staggerChildren: 0.05, delayChildren: 0.1 } 
            }
          }}
          className="w-full max-w-5xl mt-32 px-6 flex flex-col items-center text-center scroll-mt-24"
          id="trust"
        >
          <motion.p variants={textVariants} className="text-sm font-semibold tracking-widest text-muted-foreground uppercase mb-12">
            WORKS WITH THE FINANCIAL DATA YOUR TEAM ALREADY USES
          </motion.p>
          
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-12 mb-10">
            {['Stripe', 'PayPal', 'CSV', 'Excel', 'Bank Statements'].map((src, i) => (
              <motion.div 
                key={i}
                variants={{
                  hidden: { opacity: 0, y: 20, scale: 0.95 },
                  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: "easeOut" } }
                }}
                className="px-6 py-3 rounded-xl bg-card/50 border border-border/50 text-muted-foreground font-bold text-lg md:text-xl shadow-sm"
              >
                {src}
              </motion.div>
            ))}
          </div>

          <motion.div 
            variants={{
              hidden: { opacity: 0, height: 0 },
              visible: { opacity: 1, height: 40, transition: { duration: 0.8, ease: "easeOut" } }
            }}
            className="w-px bg-gradient-to-b from-border to-[#b3ff00]/50 mb-4"
          />
          <motion.div 
            variants={{
              hidden: { opacity: 0, y: 10 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
            }}
            className="w-2 h-2 rounded-full bg-[#b3ff00] shadow-[0_0_10px_rgba(179,255,0,0.8)] mb-6"
          />

          <motion.div 
            variants={{
              hidden: { opacity: 0, scale: 0.95 },
              visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: "easeOut" } }
            }}
            className="px-8 py-3 rounded-full bg-[#050505] border border-[#b3ff00]/30 text-white font-bold tracking-widest shadow-[0_0_30px_rgba(179,255,0,0.1)]"
          >
            RECON AGENT
          </motion.div>
        </motion.section>

        {/* CHAPTER 2: WAYS TO USE IT */}
        <motion.section 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, margin: "-50px" }}
          variants={{
            hidden: { opacity: 0 },
            visible: { 
              opacity: 1,
              transition: { staggerChildren: 0.1, delayChildren: 0.1 } 
            }
          }}
          className="w-full max-w-5xl mt-32 px-6 flex flex-col items-center"
        >
          <motion.p variants={textVariants} className="text-sm font-semibold tracking-widest text-muted-foreground uppercase mb-12 text-center">
            ONE ENGINE. THREE WAYS TO USE IT.
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
            {/* WEB APP */}
            <motion.div 
              variants={textVariants}
              whileHover={{ y: -5 }}
              className="group bg-card border border-border hover:border-[#b3ff00]/40 rounded-3xl p-8 flex flex-col items-center text-center transition-all shadow-sm hover:shadow-[0_0_30px_rgba(179,255,0,0.05)] cursor-default relative overflow-hidden"
            >
              <div className="w-14 h-14 rounded-2xl bg-muted group-hover:bg-[#b3ff00]/10 flex items-center justify-center mb-6 transition-colors relative z-10">
                <LayoutDashboard className="w-7 h-7 text-foreground group-hover:text-[#b3ff00] transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2 relative z-10">WEB APP</h3>
              <p className="text-muted-foreground relative z-10">Primary interface for finance teams</p>
            </motion.div>

            {/* CLI */}
            <motion.div 
              variants={textVariants}
              whileHover={{ y: -5 }}
              className="group bg-card border border-border hover:border-blue-400/40 rounded-3xl p-8 flex flex-col items-center text-center transition-all shadow-sm hover:shadow-[0_0_30px_rgba(59,130,246,0.05)] cursor-default relative overflow-hidden"
            >
              <div className="w-14 h-14 rounded-2xl bg-muted group-hover:bg-blue-400/10 flex items-center justify-center mb-6 transition-colors relative z-10">
                <Terminal className="w-7 h-7 text-foreground group-hover:text-blue-400 transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2 relative z-10">CLI</h3>
              <p className="text-muted-foreground relative z-10">A technical interface to the same reconciliation engine.</p>
            </motion.div>

            {/* API */}
            <motion.div 
              variants={textVariants}
              whileHover={{ y: -5 }}
              className="group bg-card border border-border hover:border-purple-400/40 rounded-3xl p-8 flex flex-col items-center text-center transition-all shadow-sm hover:shadow-[0_0_30px_rgba(168,85,247,0.05)] cursor-default relative overflow-hidden"
            >
              <div className="w-14 h-14 rounded-2xl bg-muted group-hover:bg-purple-400/10 flex items-center justify-center mb-6 transition-colors relative z-10">
                <Zap className="w-7 h-7 text-foreground group-hover:text-purple-400 transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2 relative z-10">API</h3>
              <p className="text-muted-foreground relative z-10">An integration/automation interface to the same engine.</p>
            </motion.div>
          </div>

          {/* Connection to Engine */}
          <motion.div 
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { duration: 0.5, delay: 0.3 } }
            }}
            className="flex flex-col items-center mt-6 w-full"
          >
            <div className="flex justify-center w-full max-w-3xl relative h-12">
              <div className="absolute top-0 left-[16.6%] right-[16.6%] h-px bg-border hidden md:block" />
              <div className="absolute top-0 left-[16.6%] w-px h-6 bg-border hidden md:block" />
              <div className="absolute top-0 left-1/2 w-px h-6 bg-border" />
              <div className="absolute top-0 right-[16.6%] w-px h-6 bg-border hidden md:block" />
            </div>
            <div className="px-6 py-2 rounded-lg bg-muted/30 border border-border/50 text-xs font-bold tracking-widest text-muted-foreground uppercase shadow-inner">
              RECONCILIATION ENGINE
            </div>
          </motion.div>
        </motion.section>

        {/* CHAPTER 3: BEFORE VS AFTER SECTION */}
        <section 
          ref={beforeAfterRef}
          className="w-full max-w-5xl mt-32 px-6 flex flex-col items-center py-12"
        >
          <div className="text-3xl md:text-5xl font-bold tracking-tight mb-20 text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 text-center">
            Manual vs Automated Reconciliation
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-24 w-full relative">
            
            {/* The Old Way */}
            <div className="flex flex-col items-center">
              <h3 className="text-xl font-bold mb-10 text-muted-foreground flex items-center gap-2">
                <X className="w-5 h-5 text-red-500/80" /> Without Recon Agent
              </h3>
              
              <div className="w-full max-w-[280px] space-y-2">
                {[
                  "Manual CSV exports",
                  "Excel formulas",
                  "VLOOKUP / XLOOKUP",
                  "Find unmatched transactions",
                  "Investigate exceptions",
                  "Manual reporting"
                ].map((step, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                    <ScrollStep 
                      progress={baProgress} 
                      index={idx} 
                      total={6} 
                      prefersReducedMotion={prefersReducedMotion}
                    >
                      {step}
                    </ScrollStep>
                    {idx < 5 && (
                      <ArrowDown className="w-5 h-5 text-muted-foreground/20 my-2" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* The Recon Agent Way */}
            <div className="flex flex-col items-center relative">
              <h3 className="text-xl font-bold mb-10 text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#b3ff00]" /> With Recon Agent
              </h3>
              
              <div className="w-full max-w-[280px] space-y-2 relative z-10">
                {[
                  "Upload",
                  "Automatic matching",
                  "AI exception resolution",
                  "Review exceptions",
                  "Export results"
                ].map((step, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                    <ScrollStep 
                      progress={baProgress} 
                      index={idx} 
                      total={6} 
                      isRight 
                      prefersReducedMotion={prefersReducedMotion}
                    >
                      {step}
                    </ScrollStep>
                    {idx < 4 && (
                      <ArrowDown className="w-5 h-5 text-[#b3ff00]/30 my-2" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="mt-24 text-center w-full flex flex-col items-center">
            <ScrollPayoff progress={baProgress} prefersReducedMotion={prefersReducedMotion} />
          </div>
        </section>
        {/* HOW IT WORKS — SCROLL-DRIVEN PIPELINE */}
        <section id="how-it-works" className="w-full max-w-2xl mt-40 px-6 scroll-mt-24">
          <PipelineStory prefersReducedMotion={prefersReducedMotion} />
        </section>

        {/* EXCEPTION STORY — STEP 4 */}
        <section className="w-full max-w-xl mt-40 px-6 flex flex-col items-center">

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500">
              What happens to exceptions?
            </h2>
            <p className="text-gray-400 text-base leading-relaxed">
              Your data isn&apos;t forced into a black box. See exactly how every record is handled.
            </p>
          </motion.div>

          {/* Total */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "-60px" }}
            transition={{ duration: 0.4 }}
            className="mb-6 text-center"
          >
            <div className="text-[10px] font-bold tracking-widest text-gray-600 uppercase mb-2">Reconciliation Result</div>
            <div className="text-4xl font-bold text-white tracking-tight">
              2,450 <span className="text-gray-500 text-2xl font-normal">transactions</span>
            </div>
          </motion.div>

          {/* Funnel */}
          <div className="w-full relative flex flex-col items-center">

            {/* 2,180 Exact */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, margin: "-50px" }}
              transition={{ duration: 0.35 }}
              className="w-full z-10"
            >
              <div className="w-full bg-[#0d0d0d] border border-white/8 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-lg text-white">2,180 Exact</div>
                  <div className="text-sm text-gray-500 mt-0.5">Automatically matched via IDs</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 border border-green-500/15 flex-shrink-0">
                  <CheckCircle2 size={18} />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scaleY: 0 }}
              whileInView={{ opacity: 1, scaleY: 1 }}
              viewport={{ once: false, margin: "-50px" }}
              transition={{ duration: 0.2 }}
              style={{ originY: 0 }}
              className="w-px h-5 bg-white/10 z-10"
            />

            {/* 266 Fuzzy & AI */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, margin: "-50px" }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="w-full z-10"
            >
              <div className="w-full bg-[#0d0d0d] border border-[#b3ff00]/20 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="font-bold text-lg text-[#b3ff00]">266 Fuzzy &amp; AI</div>
                    <div className="text-sm text-[#b3ff00]/50 mt-0.5">Contextually resolved matches</div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-[#b3ff00]/10 flex items-center justify-center text-[#b3ff00] border border-[#b3ff00]/15 flex-shrink-0">
                    <Zap size={18} />
                  </div>
                </div>
                <div className="border-t border-white/5 pt-4">
                  <div className="text-[10px] font-bold tracking-widest text-[#b3ff00]/50 uppercase mb-3">
                    Match Reasoning <span className="text-gray-600 normal-case font-normal tracking-normal">(example)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs mb-3">
                    {[
                      { field: "Amount", val: "Exact" },
                      { field: "Reference ID", val: "Partial match" },
                      { field: "Date", val: "Within tolerance" },
                      { field: "Confidence", val: "94%" },
                    ].map(({ field, val }) => (
                      <div key={field} className="flex items-baseline justify-between gap-2">
                        <span className="text-gray-600">{field}</span>
                        <span className="text-gray-300 font-medium">{val}</span>
                      </div>
                    ))}
                  </div>
                  <div className="inline-flex items-center gap-1 text-xs text-[#b3ff00] font-medium cursor-pointer hover:underline">
                    View match reasoning <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scaleY: 0 }}
              whileInView={{ opacity: 1, scaleY: 1 }}
              viewport={{ once: false, margin: "-50px" }}
              transition={{ duration: 0.2 }}
              style={{ originY: 0 }}
              className="w-px h-5 bg-gradient-to-b from-white/10 to-red-500/20 z-10"
            />

            {/* 4 Exceptions — focal point */}
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.99 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: false, margin: "-50px" }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="w-full z-10"
            >
              <div className="w-full bg-[#0d0d0d] border border-red-500/40 rounded-2xl p-5 shadow-[0_0_24px_rgba(239,68,68,0.07)]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-bold text-2xl text-red-400 tracking-tight">4 Exceptions</div>
                    <div className="text-sm text-red-400/60 mt-0.5">Flagged for manual review</div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 border border-red-500/20 flex-shrink-0">
                    <ShieldCheck size={18} />
                  </div>
                </div>
                <div className="text-xs text-gray-600 leading-relaxed border-t border-white/5 pt-3">
                  Recon Agent does not silently force uncertain transactions into a match. These records are handed to your team for a final decision.
                </div>
              </div>
            </motion.div>

          </div>

          {/* Output interfaces */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "-40px" }}
            transition={{ duration: 0.4 }}
            className="mt-12 w-full"
          >
            <div className="border-t border-white/5 pt-8 text-center">
              <div className="text-[10px] font-bold tracking-widest text-gray-600 uppercase mb-5">Access this result via</div>
              <div className="flex justify-center gap-3 flex-wrap">
                {[
                  { label: "Web Dashboard", icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
                  { label: "CLI Output", icon: <Terminal className="w-3.5 h-3.5" /> },
                  { label: "REST API", icon: <Zap className="w-3.5 h-3.5" /> },
                ].map(({ label, icon }) => (
                  <span key={label} className="px-4 py-2 rounded-full bg-[#0d0d0d] border border-white/8 text-xs text-gray-400 font-medium flex items-center gap-2">
                    {icon} {label}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>

        </section>

        {/* SECURITY SECTION */}
        <section id="security" className="w-full max-w-6xl mt-40 px-6 border-t border-white/5 pt-28 scroll-mt-24">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500">
              Built for finance teams. Ready for enterprise.
            </h2>
            <p className="text-gray-500 text-base">You can trust us with your financial data.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              {
                icon: <ShieldCheck className="w-6 h-6" />,
                iconColor: "text-white",
                iconBg: "bg-white/5 border-white/10",
                hoverBorder: "hover:border-[#b3ff00]/30",
                hoverIcon: "group-hover:text-[#b3ff00] group-hover:border-[#b3ff00]/30",
                title: "Tenant Isolation",
                desc: "Each organization's data is logically isolated from every other tenant. Your reconciliation runs, mappings, and results are never accessible to other users on the platform.",
              },
              {
                icon: <Lock className="w-6 h-6" />,
                iconColor: "text-blue-400",
                iconBg: "bg-blue-500/5 border-blue-500/15",
                hoverBorder: "hover:border-blue-400/30",
                hoverIcon: "group-hover:scale-105",
                title: "Encrypted Credentials",
                desc: "API keys and model credentials are encrypted at rest using AES-256-GCM. Your secrets are never stored in plaintext.",
              },
              {
                icon: <Zap className="w-6 h-6" />,
                iconColor: "text-yellow-400",
                iconBg: "bg-yellow-400/5 border-yellow-400/15",
                hoverBorder: "hover:border-yellow-400/30",
                hoverIcon: "group-hover:scale-105",
                title: "Bring Your Own Model",
                desc: "Connect a supported cloud model provider using your own API key, or run a local model where supported. The reconciliation engine is not tied to a single provider.",
              },
              {
                icon: <Database className="w-6 h-6" />,
                iconColor: "text-purple-400",
                iconBg: "bg-purple-500/5 border-purple-500/15",
                hoverBorder: "hover:border-purple-400/30",
                hoverIcon: "group-hover:scale-105",
                title: "Reusable Mapping Templates",
                desc: "Save your column mappings and reuse them across future reconciliation runs. No need to remap the same data sources repeatedly.",
              },
            ].map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: "-60px" }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
                className={`group bg-card border border-border ${card.hoverBorder} rounded-2xl p-7 transition-colors cursor-default`}
              >
                <div className={`w-11 h-11 rounded-xl border ${card.iconBg} flex items-center justify-center mb-5 ${card.iconColor} ${card.hoverIcon} transition-all duration-300`}>
                  {card.icon}
                </div>
                <h3 className="text-base font-bold text-white mb-2">{card.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* BRIDGE */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: false, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="mt-28 text-center"
        >
          <span className="text-sm text-gray-600 tracking-widest uppercase font-medium">Use Recon Agent your way.</span>
        </motion.div>

        {/* PRICING SECTION */}
        <section id="pricing" className="w-full max-w-5xl mt-16 px-6 scroll-mt-24">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500">
              Simple pricing for growing finance teams
            </h2>
            <p className="text-gray-500 text-base">Start for free. Scale when you&apos;re ready.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">

            {/* Starter */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, margin: "-60px" }}
              transition={{ duration: 0.4, delay: 0 }}
              className="bg-card border border-border rounded-2xl p-7 flex flex-col"
            >
              <div className="mb-7">
                <div className="text-xs font-bold tracking-widest text-gray-600 uppercase mb-3">Starter</div>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-4xl font-bold text-white">$0</span>
                  <span className="text-gray-600 text-sm">/mo</span>
                </div>
                <p className="text-sm text-gray-600">For trying Recon Agent</p>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                {[
                  "Deterministic reconciliation",
                  "CSV uploads",
                  "Limited reconciliation runs",
                  "Basic matching rules",
                  "Manual exception review",
                ].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-400">
                    <CheckCircle2 className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className="w-full py-2.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-colors text-center"
              >
                Get Started
              </Link>
            </motion.div>

            {/* Pro — focal point */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, margin: "-60px" }}
              transition={{ duration: 0.4, delay: 0.08 }}
              className="bg-card border border-[#b3ff00]/35 rounded-2xl p-7 flex flex-col relative md:-translate-y-3 shadow-[0_0_40px_rgba(179,255,0,0.04)]"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#b3ff00] text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                Most Popular
              </div>
              <div className="mb-7 mt-1">
                <div className="text-xs font-bold tracking-widest text-[#b3ff00]/70 uppercase mb-3">Pro</div>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-4xl font-bold text-white">$49</span>
                  <span className="text-gray-600 text-sm">/mo</span>
                </div>
                <p className="text-sm text-gray-600">For growing finance teams</p>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                {[
                  "Everything in Starter",
                  "AI exception resolution",
                  "Configurable matching rules",
                  "Mapping templates",
                  "Advanced exports",
                  "CLI access",
                  "REST API access",
                  "Bring Your Own Model key",
                ].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-[#b3ff00] flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className="w-full py-2.5 rounded-full bg-[#b3ff00] text-black hover:bg-[#ccff33] text-sm font-bold transition-colors text-center"
              >
                Start Free Trial
              </Link>
            </motion.div>

            {/* Enterprise */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, margin: "-60px" }}
              transition={{ duration: 0.4, delay: 0.16 }}
              className="bg-card border border-border rounded-2xl p-7 flex flex-col"
            >
              <div className="mb-7">
                <div className="text-xs font-bold tracking-widest text-gray-600 uppercase mb-3">Enterprise</div>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-3xl font-bold text-white">Custom</span>
                </div>
                <p className="text-sm text-gray-600">For advanced security &amp; deployment needs</p>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                {[
                  "Everything in Pro",
                  "SSO & SAML",
                  "Advanced security controls",
                  "Dedicated support",
                  "Private deployment",
                  "Local AI / Ollama",
                ].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-400">
                    <CheckCircle2 className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="mailto:sales@recon-agent.com"
                className="w-full py-2.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-colors text-center"
              >
                Contact Sales
              </Link>
            </motion.div>

          </div>
        </section>

        {/* FAQ SECTION */}
        <section id="faq" className="w-full max-w-2xl mt-40 px-6 scroll-mt-24">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500">
              Frequently Asked Questions
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "-60px" }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="divide-y divide-white/8"
          >
            {([
              {
                q: "What data sources do you support?",
                a: "We support CSV uploads out of the box with our visual mapper. Direct integrations with Stripe, PayPal, and major bank feeds are coming soon. Because you can visually map any column structure, you can reconcile data from virtually any platform."
              },
              {
                q: "How does AI decide whether two transactions match?",
                a: "The AI does not run first. We use a high-speed deterministic engine — amounts, dates, reference IDs — to match exact records. Only the ambiguous remaining records are passed to the AI, which uses contextual reasoning to surface likely matches with a confidence score."
              },
              {
                q: "Can I review AI-generated matches?",
                a: "Yes. The AI never silently reconciles low-confidence matches. Any probabilistic match is flagged in your Exceptions queue, allowing a human finance manager to approve or reject the suggestion."
              },
              {
                q: "Is my financial data isolated from other customers?",
                a: "Yes. We use logical tenant isolation with strict Clerk JWT verification. Your organization's reconciliation runs, mappings, and results are fully isolated from every other tenant on the platform."
              },
              {
                q: "Can I use my own LLM API key?",
                a: "Yes. We support Bring Your Own Model (BYOM). You can connect your own OpenAI, Anthropic, or Groq API keys. Your keys are encrypted at rest using AES-256-GCM and never stored in plaintext."
              },
              {
                q: "Can I use Recon Agent from the command line?",
                a: "Yes. Recon Agent is built API-first. You can run full reconciliation pipelines directly from your terminal using our CLI, and integrate them into any CI/CD or scheduled workflow."
              },
              {
                q: "Does the CLI use the same reconciliation engine as the web app?",
                a: "Yes. Both the Web App and the CLI communicate with the same FastAPI core engine. You get identical results regardless of interface."
              },
              {
                q: "What happens when a transaction cannot be matched?",
                a: "It remains safely in your Exceptions queue and is never forced into a false match. You can manually review it, assign it, or export it as an unmatched item in your final reconciliation output."
              },
              {
                q: "Where does my financial data go?",
                a: "For cloud deployments, data is processed within your organization's isolated environment. Enterprise deployments can run within your own infrastructure, including configurations where data does not leave your environment."
              },
            ] as const).map(({ q, a }) => (
              <FAQItem key={q} question={q} answer={a} />
            ))}
          </motion.div>
        </section>

        {/* FINAL CTA */}
        <section className="w-full max-w-2xl mt-40 px-6 mb-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="relative rounded-2xl bg-[#080808] border border-white/8 p-10 md:p-14 text-center flex flex-col items-center overflow-hidden"
          >
            {/* Subtle accent glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-[#b3ff00]/40 to-transparent" />

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, margin: "-60px" }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white tracking-tight">
                Ready to automate reconciliation?
              </h2>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, margin: "-60px" }}
              transition={{ duration: 0.4, delay: 0.18 }}
              className="text-gray-500 text-base max-w-md mx-auto mb-8 leading-relaxed"
            >
              Join modern finance teams and reduce hours of repetitive reconciliation work. Set up takes less than 2 minutes.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, margin: "-60px" }}
              transition={{ duration: 0.4, delay: 0.26 }}
            >
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-[#b3ff00] text-black font-bold text-sm hover:bg-[#ccff33] transition-colors"
              >
                Get Started for Free <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </motion.div>
        </section>

        {/* FOOTER */}
        <motion.footer
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="w-full border-t border-white/5 pt-14 pb-8 px-6 mt-10 text-sm"
        >
          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="font-bold text-base text-white flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded bg-[#b3ff00] text-black flex items-center justify-center text-xs font-black">R</div>
                Recon Agent
              </div>
              <p className="text-gray-600 text-xs leading-relaxed">
                AI-powered financial reconciliation for modern finance teams and developers.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-white mb-4 uppercase tracking-widest text-[10px]">Product</h4>
              <ul className="space-y-3">
                <li><Link href="#how-it-works" className="text-gray-600 text-xs hover:text-[#b3ff00] transition-colors">How it works</Link></li>
                <li><Link href="#pricing" className="text-gray-600 text-xs hover:text-[#b3ff00] transition-colors">Pricing</Link></li>
                <li><Link href="#security" className="text-gray-600 text-xs hover:text-[#b3ff00] transition-colors">Security</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white mb-4 uppercase tracking-widest text-[10px]">Developer</h4>
              <ul className="space-y-3">
                <li><span className="text-gray-700 text-xs cursor-default">Documentation</span></li>
                <li><span className="text-gray-700 text-xs cursor-default">CLI</span></li>
                <li><span className="text-gray-700 text-xs cursor-default">API</span></li>
                <li><span className="text-gray-700 text-xs cursor-default">GitHub</span></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white mb-4 uppercase tracking-widest text-[10px]">Company</h4>
              <ul className="space-y-3">
                <li><span className="text-gray-700 text-xs cursor-default">About</span></li>
                <li><Link href="mailto:sales@recon-agent.com" className="text-gray-600 text-xs hover:text-[#b3ff00] transition-colors">Contact</Link></li>
              </ul>
            </div>
          </div>

          <div className="max-w-6xl mx-auto border-t border-white/5 pt-6 flex flex-col md:flex-row justify-between items-center gap-3 text-gray-700 text-xs">
            <div>&copy; {new Date().getFullYear()} Recon Agent. All rights reserved.</div>
            <div className="flex gap-5">
              <span className="cursor-default">Privacy</span>
              <span className="cursor-default">Terms</span>
              <Link href="#security" className="hover:text-gray-400 transition-colors">Security</Link>
            </div>
          </div>
        </motion.footer>
      </main>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="py-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex justify-between items-center w-full py-5 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b3ff00]/50 rounded-lg"
        aria-expanded={isOpen}
      >
        <span className="font-medium text-sm text-gray-300 group-hover:text-white transition-colors duration-200 pr-6 leading-relaxed">
          {question}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: "easeInOut" }}
          className="flex-shrink-0 text-gray-600 group-hover:text-gray-400 transition-colors"
        >
          <ChevronRight className="w-4 h-4 rotate-90" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={prefersReducedMotion
              ? { duration: 0 }
              : { height: { duration: 0.25, ease: "easeInOut" }, opacity: { duration: 0.2 } }
            }
            style={{ overflow: "hidden" }}
          >
            <p className="pb-5 pr-8 text-sm text-gray-500 leading-relaxed">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScrollStep({ 
  progress, 
  index, 
  total, 
  children,
  isRight,
  prefersReducedMotion
}: { 
  progress: MotionValue<number>;
  index: number;
  total: number;
  children: React.ReactNode;
  isRight?: boolean;
  prefersReducedMotion: boolean | null;
}) {
  const start = (index / total) * 0.9;
  const end = ((index + 1) / total) * 0.9;
  
  const opacity = useTransform(progress, [start, end], [0.3, 1]);
  const borderColor = useTransform(
    progress, 
    [start, end], 
    isRight 
      ? ["rgba(255,255,255,0.05)", "rgba(179,255,0,0.5)"] 
      : ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.2)"]
  );
  
  const boxShadow = useTransform(
    progress,
    [start, end],
    isRight 
      ? ["0 0 0px rgba(179,255,0,0)", "0 0 15px rgba(179,255,0,0.1)"]
      : ["none", "none"]
  );

  return (
    <motion.div 
      style={prefersReducedMotion ? {} : { opacity, borderColor, boxShadow }}
      className={`w-full bg-card/50 border rounded-xl p-3.5 text-center text-sm ${isRight ? 'font-bold text-white' : 'text-muted-foreground'}`}
    >
      {children}
    </motion.div>
  );
}

function ScrollPayoff({ progress, prefersReducedMotion }: { progress: MotionValue<number>; prefersReducedMotion: boolean | null; }) {
  const start = 0.85;
  const end = 1;
  const opacity = useTransform(progress, [start, end], [0, 1]);
  const y = useTransform(progress, [start, end], [10, 0]);

  return (
    <motion.div 
      style={prefersReducedMotion ? {} : { opacity, y }}
      className="flex flex-col items-center gap-3"
    >
      <span className="text-muted-foreground line-through decoration-red-500/50 text-sm font-medium tracking-wide uppercase">
        Hours of manual reconciliation
      </span>
      <ArrowDown className="w-4 h-4 text-[#b3ff00]/70" />
      <span className="text-white font-bold text-xl text-glow bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-300 tracking-wide uppercase">
        Minutes of automated review
      </span>
    </motion.div>
  );
}

// ─── PIPELINE STORY ────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  {
    num: "01",
    title: "Upload & Map",
    sub: "Bring your financial data into one place.",
    detail: "Drop in your CSV, bank statement, or connect your payment data. Map fields — amount, date, reference ID — to the reconciliation schema. Takes seconds.",
    tag: "Data Ingestion",
  },
  {
    num: "02",
    title: "Deterministic Match",
    sub: "Predictable records resolved first, automatically.",
    detail: "Transactions that share exact amounts, dates, and reference IDs are matched instantly using configurable deterministic rules. No AI required for clear cases.",
    tag: "Rules Engine",
  },
  {
    num: "03",
    title: "AI Resolution",
    sub: "Ambiguous records receive contextual analysis.",
    detail: "Remaining unmatched transactions are analyzed using contextual AI. Likely matches are surfaced with a confidence score. Low-confidence cases are flagged — never silently accepted.",
    tag: "AI Layer",
  },
  {
    num: "04",
    title: "Review & Export",
    sub: "Your team stays in control of uncertain decisions.",
    detail: "Review flagged exceptions with full context. Approve or reject AI suggestions with one click. Export your reconciled results for downstream accounting workflows.",
    tag: "Human Review",
  },
] as const;

function PipelineStory({ prefersReducedMotion }: { prefersReducedMotion: boolean | null }) {
  return (
    <div className="w-full">
      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="text-center mb-16"
      >
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">
          How Recon Agent Works
        </h2>
        <p className="text-gray-500 text-base">A powerful pipeline combining deterministic rules and probabilistic AI.</p>
      </motion.div>

      {/* Pipeline */}
      <div className="relative">
        {/* Full-height spine line */}
        <div className="absolute left-[21px] top-3 bottom-3 w-px bg-white/8" />

        {PIPELINE_STAGES.map((stage, i) => (
          <motion.div
            key={i}
            initial={{ opacity: prefersReducedMotion ? 1 : 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: false, margin: "-30%" }}
            transition={{ duration: 0.3 }}
            className="relative flex gap-5 mb-0"
          >
            {/* Left: node + connector */}
            <div className="flex flex-col items-center flex-shrink-0 z-10">
              <motion.div
                initial={{ borderColor: "rgba(255,255,255,0.1)", backgroundColor: "transparent", color: "rgb(75,85,99)" }}
                whileInView={prefersReducedMotion ? {} : {
                  borderColor: "rgb(179,255,0)",
                  backgroundColor: "rgba(179,255,0,0.1)",
                  color: "rgb(179,255,0)",
                }}
                viewport={{ once: false, margin: "-30%" }}
                transition={{ duration: 0.4 }}
                className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm border-2 flex-shrink-0"
              >
                {stage.num}
              </motion.div>
              {i < 3 && (
                <motion.div
                  className="w-px flex-1 mt-1.5"
                  style={{ minHeight: "48px" }}
                  initial={{ background: "rgba(255,255,255,0.08)" }}
                  whileInView={prefersReducedMotion ? {} : {
                    background: "linear-gradient(to bottom, rgba(179,255,0,0.6), rgba(255,255,255,0.08))"
                  }}
                  viewport={{ once: false, margin: "-30%" }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                />
              )}
            </div>

            {/* Right: text */}
            <div className={`flex-1 pt-0.5 ${i < 3 ? "pb-10" : "pb-2"}`}>
              <motion.div
                initial={{ opacity: prefersReducedMotion ? 1 : 0.4 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: false, margin: "-30%" }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-[10px] font-bold tracking-widest text-[#b3ff00]/60 uppercase mb-1.5">
                  {stage.tag}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{stage.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{stage.detail}</p>
              </motion.div>
            </div>
          </motion.div>
        ))}

        {/* Pipeline complete */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: false, margin: "-10%" }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-3 ml-[calc(44px+20px)] mt-2"
        >
          <div className="h-px flex-1 bg-gradient-to-r from-[#b3ff00]/40 to-transparent" />
          <span className="text-[10px] font-bold tracking-widest text-[#b3ff00]/50 uppercase">Pipeline Complete</span>
        </motion.div>
      </div>
    </div>
  );
}
