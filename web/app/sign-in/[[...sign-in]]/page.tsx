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
        className="relative z-10 p-5 rounded-2xl bg-[#050505] border border-white/10 shadow-[0_0_40px_rgba(179,255,0,0.05)] backdrop-blur-xl"
      >
        <div className="bg-transparent rounded-xl overflow-hidden">
          <SignIn 
            appearance={({
              baseTheme: dark as any,
              variables: {
                colorPrimary: "#ffffff",
                colorBackground: "transparent",
                colorText: "white",
                colorTextSecondary: "#a1a1aa",
                colorInputBackground: "#0a0a0a",
                colorInputText: "white",
              },
              elements: {
                formButtonPrimary: "!text-black font-semibold !bg-white hover:!bg-[#b3ff00] hover:shadow-[0_0_20px_rgba(179,255,0,0.4)] transition-all rounded-lg h-10 shadow-md",
                card: "bg-transparent shadow-none border-none w-full max-w-md",
                headerTitle: "!text-2xl font-bold tracking-tight !text-white text-center",
                headerSubtitle: "!text-gray-400 text-center",
                socialButtonsBlockButton: "border border-white/20 !bg-[#111] hover:!bg-[#b3ff00]/10 hover:!border-[#b3ff00]/50 transition-all !text-white rounded-lg h-11",
                socialButtonsBlockButtonText: "!text-white font-medium",
                socialButtonsIconButton: "border border-white/20 !bg-[#111] hover:!bg-[#b3ff00]/10 hover:!border-[#b3ff00]/50 transition-all !text-white rounded-lg",
                socialButtonsProviderIcon__apple: "!invert !brightness-200",
                formFieldInput: "border-white/20 !bg-[#0a0a0a] focus:!border-[#b3ff00] focus:!ring-1 focus:!ring-[#b3ff00] transition-all rounded-lg h-11 !text-white placeholder:!text-gray-400 shadow-inner",
                formFieldLabel: "!text-gray-300 font-medium",
                dividerLine: "!bg-white/10",
                dividerText: "!text-gray-500",
                footerActionText: "!text-gray-400",
                footerActionLink: "!text-white hover:underline font-medium transition-colors",
                identityPreviewText: "!text-white",
                identityPreviewEditButtonIcon: "!text-gray-400 hover:!text-white transition-colors"
              }
            } as any)} 
          />
        </div>
      </motion.div>
    </div>
  );
}
