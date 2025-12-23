"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AnalysisPage() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<"all" | "week" | "month">("all");

  // 더미 데이터
  const stats = {
    weeklyConversations: 5,
    mostCommonEmotion: { emoji: "😰", label: "불안함" },
    importantNeed: "존중받기",
  };

  const insights = [
    "이번 주 가장 자주 느낀 감정은 '답답함'과 '화남'이에요",
    "갈등이 가장 많이 생기는 관계는 '직장 동료'입니다",
  ];

  const conversations = [
    {
      id: "1",
      date: "2024.12.23 오후 3:20",
      situation: "버스 기사님이 소리를 지르셨어요",
      emotions: [
        { emoji: "😡", label: "화남" },
        { emoji: "😰", label: "불안함" },
        { emoji: "😤", label: "억울함" },
      ],
    },
    {
      id: "2",
      date: "2024.12.22 오전 11:45",
      situation: "동료가 약속 시간에 30분 늦었어요",
      emotions: [
        { emoji: "😔", label: "서운함" },
        { emoji: "😩", label: "답답함" },
      ],
    },
    {
      id: "3",
      date: "2024.12.21 오후 9:15",
      situation: "파트너가 내 말을 안 들어줬어요",
      emotions: [
        { emoji: "😢", label: "외로움" },
        { emoji: "😔", label: "속상함" },
      ],
    },
    {
      id: "4",
      date: "2024.12.20 오후 2:30",
      situation: "후배가 일을 엉망으로 해왔어요",
      emotions: [
        { emoji: "😩", label: "답답함" },
        { emoji: "😞", label: "실망스러움" },
      ],
    },
    {
      id: "5",
      date: "2024.12.19 오전 10:00",
      situation: "상사가 내 의견을 무시했어요",
      emotions: [
        { emoji: "😤", label: "억울함" },
        { emoji: "😡", label: "화남" },
      ],
    },
  ];

  return (
    <div
      className="min-h-screen w-full"
      style={{ backgroundColor: "#FAFAFA" }}
    >
      <div className="mx-auto flex min-h-screen max-w-[640px] flex-col px-5 py-8 font-[Pretendard,system-ui,_sans-serif]">
        {/* Header */}
        <header className="mb-8 flex h-[72px] items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-gray-600 shadow-sm transition-all hover:bg-[#F9FAFB] hover:shadow-md"
          >
            <span className="text-xl">←</span>
          </button>
          <div className="flex flex-col items-center">
            <h1 className="text-xl font-bold tracking-tight text-gray-900">분석</h1>
          </div>
          <div className="w-10" />
        </header>

        {/* Page Title */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">내 마음 분석</h2>
          <p className="text-sm text-gray-500">지금까지 정리한 대화를 분석했어요</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {/* Card 1: 이번 주 대화 */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">💬</span>
            </div>
            <div className="text-xs text-gray-500 mb-1">이번 주 대화</div>
            <div className="text-2xl font-bold text-purple-600">{stats.weeklyConversations}건</div>
          </div>

          {/* Card 2: 가장 많은 감정 */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{stats.mostCommonEmotion.emoji}</span>
            </div>
            <div className="text-xs text-gray-500 mb-1">가장 많은 감정</div>
            <div className="text-base font-semibold text-gray-900">
              {stats.mostCommonEmotion.label}
            </div>
          </div>

          {/* Card 3: 중요한 욕구 */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">💜</span>
            </div>
            <div className="text-xs text-gray-500 mb-1">중요한 욕구</div>
            <div className="text-base font-semibold text-gray-900">{stats.importantNeed}</div>
          </div>
        </div>

        {/* Key Insights Section */}
        <div className="mb-8">
          <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>💡</span>
            <span>주요 인사이트</span>
          </h3>
          <div className="space-y-3">
            {insights.map((insight, idx) => (
              <div
                key={idx}
                className="bg-purple-50 rounded-xl p-4 border border-purple-100"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <svg
                      className="w-5 h-5 text-purple-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-800 leading-relaxed flex-1">{insight}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveFilter("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeFilter === "all"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setActiveFilter("week")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeFilter === "week"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              최근 7일
            </button>
            <button
              onClick={() => setActiveFilter("month")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeFilter === "month"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              이번 달
            </button>
          </div>
        </div>

        {/* Past Conversations Section */}
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>📚</span>
            <span>과거 대화</span>
          </h3>
          <div className="space-y-3">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                {/* Date */}
                <div className="text-xs text-gray-500 mb-2">{conversation.date}</div>

                {/* Situation */}
                <div className="text-[15px] font-medium text-gray-900 mb-3">
                  {conversation.situation}
                </div>

                {/* Emotion Chips */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {conversation.emotions.map((emotion, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-[10px] font-medium"
                    >
                      <span>{emotion.emoji}</span>
                      <span>{emotion.label}</span>
                    </div>
                  ))}
                </div>

                {/* View Details Link */}
                <div className="flex justify-end">
                  <button className="text-xs text-purple-600 font-medium hover:text-purple-700 transition-colors">
                    자세히 보기 &gt;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

