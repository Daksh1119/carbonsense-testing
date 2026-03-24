"use client";

import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import { useUserStore } from "@/store";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useUserStore();

  const handleDevLogin = () => {
    const organizationId = process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID || "demo-org";
    const userId = process.env.NEXT_PUBLIC_DEFAULT_USER_ID || "demo-admin";

    login(
      {
        id: userId,
        name: "Demo Admin",
        email: "admin@carbonsense.dev",
        role: "admin",
        organization: "Demo Organization",
        organizationId,
        createdAt: new Date().toISOString(),
      },
      "dev-token"
    );

    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-2">Developer Login</h1>
        <p className="text-sm text-slate-400 mb-6">
          This temporary login is for local testing while the full auth flow is in progress.
        </p>
        <Button onClick={handleDevLogin} className="w-full">
          Continue as Admin
        </Button>
      </div>
    </div>
  );
}
