import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-sm px-4 py-10">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
