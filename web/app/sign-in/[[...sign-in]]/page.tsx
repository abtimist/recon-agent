"use client";

import { SignIn } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function Page() {
  return (
    <div className="relative min-h-screen bg-background flex flex-col items-center justify-center overflow-hidden font-sans">
      
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] h-[70vw] bg-accent/[0.05] rounded-full blur-[140px] pointer-events-none" />

      {/* Nav */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="absolute top-8 left-0 right-0 px-8 flex justify-between items-center z-20 w-full"
      >
        <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
          <ArrowLeft size={16} />
          Back to Home
        </Link>
      </motion.div>

      {/* Form Container */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 p-1 rounded-2xl bg-gradient-to-b from-border/50 to-transparent shadow-[0_0_40px_rgba(179,255,0,0.1)]"
      >
        <div className="bg-card rounded-xl overflow-hidden p-2">
          <SignIn 
            appearance={{
              variables: {
                colorPrimary: "#b3ff00",
                colorBackground: "#050505",
              },
              elements: {
                formButtonPrimary: "text-black font-semibold hover:shadow-[0_0_15px_rgba(179,255,0,0.3)] transition-all",
                card: "bg-transparent shadow-none border-none w-full max-w-md",
                headerTitle: "text-2xl font-bold tracking-tight text-foreground",
                headerSubtitle: "text-muted-foreground",
                socialButtonsBlockButton: "border-border bg-muted hover:bg-muted/80 transition-colors",
                socialButtonsBlockButtonText: "text-foreground font-medium",
                formFieldInput: "border-border focus:border-accent transition-colors rounded-lg h-11",
                formFieldLabel: "text-foreground font-medium",
                dividerLine: "bg-border",
                dividerText: "text-muted-foreground",
                footerActionText: "text-muted-foreground",
                footerActionLink: "text-accent hover:text-accent-hover",
              }
            }} 
          />
        </div>
      </motion.div>
    </div>
  );
}
