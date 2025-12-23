"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getConversationById } from "@/lib/storage";
import type { Conversation } from "@/types";

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // 클라이언트에서만 LocalStorage에서 데이터 로드
  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    
    // 클라이언트에서만 실행
    const loadedConversation = getConversationById(id);
    setConversation(loadedConversation ?? null);
    setLoading(false);
  }, [id]);

  const copy = async () => {
    if (!conversation?.conversionText) return;
    await navigator.clipboard.writeText(conversation.conversionText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] text-gray-600">
        번역을 불러오는 중...
      </div>
    );
  }

  if (!conversation && !loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] px-6 text-center text-gray-600">
        <p className="text-lg font-semibold text-gray-800">번역을 찾을 수 없어요.</p>
        <p className="mt-2 text-sm text-gray-500">다시 시도하거나 새로운 번역을 시작해 보세요.</p>
        <button
          onClick={() => router.push("/convert")}
          className="mt-6 rounded-xl bg-gradient-to-br from-[#8B7FFF] to-[#9D92FF] px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(139,127,255,0.24)] transition hover:scale-[1.02] active:scale-[0.98]"
        >
          마음 번역기 열기
        </button>
      </div>
    );
  }

  const original = conversation.observation || conversation.situation || "기록 없음";
  const translated = conversation.conversionText || "번역 내용이 없습니다.";

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[#F3F4F6] bg-white px-4 sm:px-5">
        <button
          onClick={() => router.push("/convert")}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F9FAFB] text-gray-600 transition-colors hover:bg-[#F3F4F6]"
        >
          <span className="text-xl">←</span>
        </button>
        <div className="flex flex-col items-center leading-none">
          <span className="text-[22px] font-semibold tracking-tight text-[#1F2937]">
            마음 번역기
          </span>
          <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#9CA3AF]">
            Heart Translator
          </span>
        </div>
        <div className="w-10" />
      </header>

      <main className="mx-auto flex max-w-[720px] flex-col gap-8 px-5 py-10 sm:px-6">
        <div className="space-y-2 text-center">
          <h1 className="text-[24px] font-bold text-gray-900">✨ 번역 완료</h1>
          <p className="text-sm text-gray-500">번역된 마음을 그대로 전달해 보세요.</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[#6B7280]">📄 원문</h2>
          <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-5 text-base text-gray-800 leading-relaxed">
            {original}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[#9333EA]">💜 번역된 마음</h2>
          <div
            className="rounded-[20px] border-2 border-[#E9D5FF] bg-gradient-to-br from-[#FAF5FF] to-white p-6 text-base text-gray-900 leading-relaxed shadow-[0_4px_16px_rgba(147,51,234,0.12)]"
            style={{ whiteSpace: "pre-wrap" }}
          >
            {translated}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">💡 번역 가이드</h3>
          <div className="rounded-xl bg-[#FAFAFA] p-4 text-sm leading-[1.6] text-gray-700">
            <p>
              <strong className="text-gray-800">관찰:</strong> {conversation.observation || "-"}
            </p>
            <p>
              <strong className="text-gray-800">감정:</strong> {conversation.emotion || "-"}
            </p>
            <p>
              <strong className="text-gray-800">욕구:</strong> {conversation.need || "-"}
            </p>
            <p>
              <strong className="text-gray-800">요청:</strong> {conversation.request || "-"}
            </p>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={copy}
            className="rounded-xl bg-gradient-to-br from-[#8B7FFF] to-[#9D92FF] px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(139,127,255,0.24)] transition hover:scale-[1.02] active:scale-[0.98]"
          >
            {copied ? "번역된 마음이 복사되었어요! 📋" : "복사하기"}
          </button>
          <button
            onClick={() => router.push("/convert")}
            className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-[#F9FAFB]"
          >
            다시 번역하기
          </button>
        </div>
      </main>
    </div>
  );
}

