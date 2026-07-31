"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ITEMS = [
  { href: "/dashboard", label: "Club", icon: "🏟️" },
  { href: "/squad", label: "Effectif", icon: "👥" },
  { href: "/training", label: "Entraînement", icon: "🏋️" },
  { href: "/academy", label: "Académie", icon: "🌟" },
  { href: "/tactics", label: "Match", icon: "⚽" },
  { href: "/league", label: "Ligue", icon: "🏆" },
  { href: "/cup", label: "Coupe", icon: "🥇" },
  { href: "/europe", label: "Europe", icon: "🌍" },
  { href: "/world", label: "Actualités", icon: "📰" },
  { href: "/board", label: "Direction", icon: "📋" },
  { href: "/transfermarket", label: "Mercato", icon: "💰" },
  { href: "/negotiations", label: "Négociations", icon: "🤝" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <header className="hidden md:flex items-center justify-between border-b border-pitch-700 px-8 py-4 bg-pitch-900/80 backdrop-blur sticky top-0 z-20">
        <div className="font-display text-xl font-semibold tracking-tight">DYNASTY<span className="text-carmine">ELEVEN</span></div>
        <nav className="flex gap-1 overflow-x-auto">
          {ITEMS.map((item) => <Link key={item.href} href={item.href} className={`whitespace-nowrap px-3 py-2 text-sm rounded transition ${pathname === item.href ? "bg-carmine text-white" : "text-muted hover:text-white"}`}>{item.label}</Link>)}
        </nav>
        <button onClick={logout} className="text-xs text-muted hover:text-carmine-light">Quitter le banc</button>
      </header>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-pitch-900/95 backdrop-blur border-t border-pitch-700 flex justify-around py-2 pb-[env(safe-area-inset-bottom)] overflow-x-auto">
        {ITEMS.map((item) => <Link key={item.href} href={item.href} className={`flex min-w-14 flex-col items-center gap-0.5 px-1 py-1 text-[9px] ${pathname === item.href ? "text-carmine-light" : "text-muted"}`}><span className="text-lg leading-none">{item.icon}</span>{item.label}</Link>)}
      </nav>
    </>
  );
}
