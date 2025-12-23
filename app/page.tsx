"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getRecentConversations } from "../lib/storage";
import type { Conversation } from "../types";

export default function Home() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [recent, setRecent] = useState<Conversation[]>([]);
  
  // 클라이언트에서만 localStorage 접근
  useEffect(() => {
    setRecent(getRecentConversations(3));
  }, []);

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );

  const navigate = () => {
    const trimmed = text.trim();
    if (trimmed) {
      router.push(`/convert?text=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/checkin");
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      navigate();
    }
  };

  return (
    <div
      className="min-h-screen w-full"
      style={{ backgroundColor: "#F8F7F4" }}
    >
      <div className="mx-auto flex min-h-screen max-w-[640px] flex-col px-5 py-8 font-[Pretendard,system-ui,_sans-serif] text-[#333]">
        <header className="mb-8 flex h-[72px] items-center justify-between">
          <span
            className="text-2xl font-bold bg-clip-text text-transparent tracking-tight"
            style={{ backgroundImage: "linear-gradient(90deg, #8B7FFF 0%, #9D92FF 100%)" }}
          >
            Relink
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/checkin")}
              className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-[#F9FAFB] hover:shadow-md"
            >
              💗 감정 체크인
            </button>
            <button
              onClick={() => router.push("/analysis")}
              className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-[#F9FAFB] hover:shadow-md"
            >
              📊 분석
            </button>
          </div>
        </header>

        <main className="flex flex-1 flex-col">
          <div className="mt-16 mb-12 text-center space-y-4">
            <h1 className="text-[36px] font-bold tracking-tight text-gray-900 leading-tight">
              마음번역기
            </h1>
            <p className="text-lg text-[#6B7280] leading-[1.5]">
              대화 코치가 도와드릴게요
            </p>
          </div>

          <section className="mb-6">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="무슨 일이 있었나요?"
              className="w-full resize-none rounded-[20px] border-2 border-transparent bg-white px-6 py-5 text-base text-[#333] placeholder:text-gray-400 outline-none transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)] focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
              style={{
                minHeight: 160,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            />
          </section>

          <button
            onClick={navigate}
            className="mt-5 mb-12 w-full rounded-xl px-4 text-lg font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              height: 64,
              background:
                "linear-gradient(135deg, #8B7FFF 0%, #9D92FF 100%)",
              boxShadow: "0 4px 16px rgba(139, 127, 255, 0.24)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(139, 127, 255, 0.32)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "0 4px 16px rgba(139, 127, 255, 0.24)";
            }}
          >
            마음 알아보기 →
          </button>

          <section className="mt-12 flex flex-col gap-4 pb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">최근 번역</h2>
            {recent.length === 0 ? (
              <div className="rounded-2xl border border-[#F3F4F6] bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
                아직 대화가 없어요
              </div>
            ) : (
              recent.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => router.push(`/result/${conversation.id}`)}
                  className="flex items-center gap-3 rounded-2xl border border-[#F3F4F6] bg-white px-5 py-4 text-left shadow-sm transition-all hover:border-purple-200 hover:shadow-md"
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: "#E5E2FF" }}
                  >
                    <span className="text-lg">💬</span>
                  </div>
                  <div className="flex flex-1 flex-col">
                    <span className="text-base font-semibold text-gray-800">
                      {(() => {
                        const situation = conversation.situation || conversation.observation || "대화";
                        // 30자 이상이면 자르고 말줄임표 추가
                        return situation.length > 30 ? situation.slice(0, 30) + "..." : situation;
                      })()}
                    </span>
                    <span className="text-sm text-gray-500">
                      번역 완료 • {timeFormatter.format(conversation.date)}
                    </span>
                  </div>
                  <span className="text-lg text-gray-400">❯</span>
                </button>
              ))
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
