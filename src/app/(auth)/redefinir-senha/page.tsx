import { PasswordForm } from "@/components/shared/password-form";

export const metadata = { title: "Redefinir senha" };
export default function NewPasswordPage() { return <PasswordForm mode="update" />; }
