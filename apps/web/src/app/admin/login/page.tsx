import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BrandFooter, BrandMark, OliveFrame } from "@/components/Brand";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { staffSession } from "@/server/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "olivechat · Administration",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const claims = await staffSession();
  if (claims?.role === "admin") redirect("/admin");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-16">
      <OliveFrame />
      <BrandMark className="mb-8 w-36 self-start" />
      <h1 className="text-ink font-serif text-2xl">Administrator sign in</h1>
      <p className="text-ink-muted mt-2">
        Every transcript you open here is recorded against your name.
      </p>
      <div className="mt-8">
        <AdminLoginForm />
      </div>
      <BrandFooter />
    </main>
  );
}
