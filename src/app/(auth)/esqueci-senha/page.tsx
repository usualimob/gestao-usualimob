import { PasswordForm } from "@/components/shared/password-form";

export const metadata = { title: "Esqueci minha senha" };
export default function ForgotPasswordPage() { return <PasswordForm mode="request" />; }
