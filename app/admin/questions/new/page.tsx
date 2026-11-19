"use client";
import { useRouter } from "next/navigation";
import { EMPTY_QUESTION, QuestionForm } from "@/components/admin/question-form";
import { api } from "@/components/admin/use-api";
import { BackLink, Card } from "@/components/admin/ui";

export default function NewQuestionPage() {
  const router = useRouter();
  return (
    <div className="space-y-3">
      <BackLink href="/admin">Questions</BackLink>
      <Card title="New question">
        <QuestionForm
          initial={EMPTY_QUESTION}
          submitLabel="Create and import ranking"
          onSubmit={async (meta) => {
            const { id } = await api<{ id: string }>("/api/admin/questions", { method: "POST", body: JSON.stringify(meta) });
            router.push(`/admin/questions/${id}`);
          }}
        />
      </Card>
    </div>
  );
}
