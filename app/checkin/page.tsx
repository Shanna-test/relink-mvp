"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { emotionCategories } from "@/lib/emotions";
import { saveEmotionCheckIn, getWeeklyEmotionCheckIns } from "@/lib/storage";
import type { EmotionCheckIn } from "@/types";

export default function CheckInPage() {
  const router = useRouter();
  const [step, setStep] = useState<"main" | "subcategory" | "emotion" | "situation" | "complete">("main");
  const [selectedMainCategory, setSelectedMainCategory] = useState<"uncomfortable" | "pleasant" | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [situation, setSituation] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const [weeklyCheckIns, setWeeklyCheckIns] = useState<EmotionCheckIn[]>([]);
  
  // 주간 기록 로드
  useEffect(() => {
    if (typeof window !== "undefined") {
      setWeeklyCheckIns(getWeeklyEmotionCheckIns());
    }
  }, [step]); // step이 변경될 때마다 다시 로드 (새 기록 저장 후)

  const handleMainCategorySelect = (category: "uncomfortable" | "pleasant") => {
    setIsAnimating(true);
    setSelectedMainCategory(category);
    setTimeout(() => {
      setStep("subcategory");
      setIsAnimating(false);
    }, 300);
  };

  const handleSubcategorySelect = (subcategoryId: string) => {
    setIsAnimating(true);
    setSelectedSubcategory(subcategoryId);
    setTimeout(() => {
      setStep("emotion");
      setIsAnimating(false);
    }, 300);
  };

  const handleEmotionSelect = (emotion: string) => {
    setIsAnimating(true);
    setSelectedEmotion(emotion);
    setTimeout(() => {
      setStep("situation");
      setIsAnimating(false);
    }, 300);
  };

  const handleSave = () => {
    if (!selectedMainCategory || !selectedSubcategory || !selectedEmotion) return;

    const checkIn: EmotionCheckIn = {
      id: `checkin_${Date.now()}`,
      date: Date.now(),
      mainCategory: selectedMainCategory,
      subCategory: selectedSubcategory,
      emotion: selectedEmotion,
      situation: situation.trim() || undefined,
    };

    saveEmotionCheckIn(checkIn);
    setStep("complete");
  };

  const handleBack = () => {
    setIsAnimating(true);
    setTimeout(() => {
      if (step === "subcategory") {
        setStep("main");
        setSelectedMainCategory(null);
      } else if (step === "emotion") {
        setStep("subcategory");
        setSelectedSubcategory(null);
      } else if (step === "situation") {
        setStep("emotion");
        setSelectedEmotion(null);
      }
      setIsAnimating(false);
    }, 300);
  };

  const currentCategory = selectedMainCategory ? emotionCategories[selectedMainCategory] : null;
  const currentSubcategory = currentCategory?.subcategories.find(
    (sub) => sub.id === selectedSubcategory
  );

  // 주간 기록 데이터 가공
  const weeklyData = useMemo(() => {
    const now = Date.now();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date.setHours(0, 0, 0, 0)).getTime();
      const dayEnd = new Date(date.setHours(23, 59, 59, 999)).getTime();
      
      const dayCheckIns = weeklyCheckIns.filter(
        (checkIn) => checkIn.date >= dayStart && checkIn.date <= dayEnd
      );
      
      days.push({
        date: dayStart,
        label: date.toLocaleDateString("ko-KR", { weekday: "short" }),
        day: date.getDate(),
        checkIns: dayCheckIns,
        count: dayCheckIns.length,
      });
    }
    return days;
  }, [weeklyCheckIns]);

  // 감정별 이모지 매핑 함수
  const getEmotionEmoji = (emotion: string): string => {
    for (const category of Object.values(emotionCategories)) {
      for (const subcategory of category.subcategories) {
        const found = subcategory.emotions.find((e) => e.label === emotion);
        if (found) return found.emoji;
      }
    }
    return "😊";
  };

  return (
    <div
      className="min-h-screen w-full"
      style={{ backgroundColor: "#F8F7F4" }}
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
            <h1 className="text-xl font-bold tracking-tight text-gray-900">감정 체크인</h1>
            <p className="text-xs text-gray-500 mt-0.5">오늘의 감정을 기록해보세요</p>
          </div>
          <div className="w-10" />
        </header>

        {/* Weekly Summary - Only show on main step */}
        {step === "main" && weeklyCheckIns.length > 0 && (
          <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="rounded-2xl bg-white p-6 shadow-lg overflow-hidden" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">이번 주 기록</h3>
                  <p className="text-sm text-gray-500">최근 7일간의 감정 기록</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-br from-[#8B7FFF] to-[#9D92FF] text-white text-sm font-semibold shadow-sm">
                  <span>{weeklyCheckIns.length}</span>
                  <span className="text-xs opacity-90">건</span>
                </div>
              </div>

              {/* Weekly Chart */}
              <div className="space-y-4">
                {/* Day bars */}
                <div className="flex items-end justify-between gap-2 h-32">
                  {weeklyData.map((day, idx) => {
                    const maxCount = Math.max(...weeklyData.map((d) => d.count), 1);
                    const height = (day.count / maxCount) * 100;
                    const isToday = idx === weeklyData.length - 1;
                    
                    return (
                      <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                        {/* Bar */}
                        <div className="relative w-full flex flex-col items-center justify-end h-24">
                          {day.count > 0 ? (
                            <div
                              className={`w-full rounded-t-lg transition-all duration-500 hover:opacity-80 ${
                                isToday
                                  ? "bg-gradient-to-t from-[#8B7FFF] to-[#9D92FF] shadow-md"
                                  : "bg-gradient-to-t from-purple-200 to-purple-300"
                              }`}
                              style={{
                                height: `${Math.max(height, 8)}%`,
                                minHeight: day.count > 0 ? "8px" : "0",
                              }}
                            >
                              {/* Count badge */}
                              {day.count > 0 && (
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center justify-center h-5 px-1.5 rounded-full bg-gray-900 text-white text-xs font-semibold whitespace-nowrap">
                                  {day.count}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="w-full h-1 rounded-full bg-gray-100" />
                          )}
                        </div>
                        
                        {/* Day label */}
                        <div className="text-center">
                          <div className={`text-xs font-semibold ${
                            isToday ? "text-[#8B7FFF]" : "text-gray-500"
                          }`}>
                            {day.label}
                          </div>
                          <div className={`text-xs mt-0.5 ${
                            isToday ? "text-gray-900 font-bold" : "text-gray-400"
                          }`}>
                            {day.day}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Recent emotions timeline */}
                {weeklyCheckIns.length > 0 && (
                  <div className="pt-4 border-t border-gray-100">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      최근 기록
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {weeklyCheckIns.slice(0, 8).map((checkIn) => {
                        const date = new Date(checkIn.date);
                        const timeStr = date.toLocaleTimeString("ko-KR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                        const isToday = date.toDateString() === new Date().toDateString();
                        
                        return (
                          <div
                            key={checkIn.id}
                            className="group relative flex items-center gap-2 rounded-xl px-3 py-2 bg-gradient-to-br from-gray-50 to-gray-100/50 hover:from-purple-50 hover:to-pink-50 transition-all duration-300 hover:scale-105 cursor-pointer"
                            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                          >
                            <span className="text-lg">{getEmotionEmoji(checkIn.emotion)}</span>
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-gray-700">
                                {checkIn.emotion}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {isToday ? `오늘 ${timeStr}` : date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Progress Indicator */}
        {step !== "complete" && (
          <div className="mb-10 flex items-center justify-center gap-2">
            {["main", "subcategory", "emotion", "situation"].map((s, idx) => {
              const stepIndex = ["main", "subcategory", "emotion", "situation"].indexOf(step);
              const isActive = idx <= stepIndex;
              const isCurrent = idx === stepIndex;
              return (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      isActive
                        ? "w-10 bg-gradient-to-r from-[#8B7FFF] to-[#9D92FF] shadow-sm"
                        : "w-2 bg-gray-300"
                    } ${isCurrent ? "ring-2 ring-[#8B7FFF] ring-offset-2" : ""}`}
                  />
                  {idx < 3 && (
                    <div className={`h-0.5 w-2 transition-all duration-300 ${
                      isActive ? "bg-gradient-to-r from-[#8B7FFF] to-transparent" : "bg-transparent"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1">
          <div
            className={`transition-all duration-300 ${
              isAnimating ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
            }`}
          >
            {/* Step 1: Main Category Selection */}
            {step === "main" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center space-y-3 mb-10">
                  <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-[#8B7FFF] to-[#9D92FF] text-3xl mb-2 shadow-lg">
                    💗
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 tracking-tight">어떤 감정이신가요?</h2>
                  <p className="text-base text-gray-500 leading-relaxed">지금 느끼는 감정을 선택해주세요</p>
                </div>

                <div className="grid grid-cols-1 gap-5">
                  {/* 불편한 감정 */}
                  <button
                    onClick={() => handleMainCategorySelect("uncomfortable")}
                    className="group relative overflow-hidden rounded-2xl bg-white p-7 text-left transition-all duration-500 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    }}
                  >
                    {/* Animated gradient background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-red-50 via-orange-50 to-pink-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    
                    <div className="relative flex items-center gap-5">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-red-200 to-orange-200 rounded-2xl blur-lg opacity-0 group-hover:opacity-50 transition-opacity duration-500" />
                        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-red-100 via-orange-100 to-pink-100 text-4xl shadow-md group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                          {emotionCategories.uncomfortable.emoji}
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-red-600 transition-colors">
                          {emotionCategories.uncomfortable.label}
                        </h3>
                        <p className="text-sm text-gray-500 leading-relaxed">
                          힘들고 불편한 감정을 기록해요
                        </p>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 group-hover:bg-gradient-to-br group-hover:from-red-100 group-hover:to-orange-100 transition-all duration-300">
                        <svg
                          className="w-5 h-5 text-gray-400 group-hover:text-red-600 group-hover:translate-x-1 transition-all duration-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                  </button>

                  {/* 기분 좋은 감정 */}
                  <button
                    onClick={() => handleMainCategorySelect("pleasant")}
                    className="group relative overflow-hidden rounded-2xl bg-white p-7 text-left transition-all duration-500 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    }}
                  >
                    {/* Animated gradient background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-50 via-green-50 to-blue-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    
                    <div className="relative flex items-center gap-5">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-200 to-green-200 rounded-2xl blur-lg opacity-0 group-hover:opacity-50 transition-opacity duration-500" />
                        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-100 via-green-100 to-blue-100 text-4xl shadow-md group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                          {emotionCategories.pleasant.emoji}
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-green-600 transition-colors">
                          {emotionCategories.pleasant.label}
                        </h3>
                        <p className="text-sm text-gray-500 leading-relaxed">
                          기쁘고 좋은 감정을 기록해요
                        </p>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 group-hover:bg-gradient-to-br group-hover:from-yellow-100 group-hover:to-green-100 transition-all duration-300">
                        <svg
                          className="w-5 h-5 text-gray-400 group-hover:text-green-600 group-hover:translate-x-1 transition-all duration-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Subcategory Selection */}
            {step === "subcategory" && currentCategory && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center gap-4 mb-8">
                  <button
                    onClick={handleBack}
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-gray-600 shadow-sm transition-all hover:bg-[#F9FAFB] hover:shadow-md hover:scale-105 active:scale-95"
                  >
                    <span className="text-xl">←</span>
                  </button>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                      어떤 감정인가요?
                    </h2>
                    <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                      더 구체적으로 선택해주세요
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {currentCategory.subcategories.map((subcategory, idx) => (
                    <button
                      key={subcategory.id}
                      onClick={() => handleSubcategorySelect(subcategory.id)}
                      className="group relative overflow-hidden rounded-2xl bg-white p-5 text-center shadow-sm transition-all duration-500 hover:shadow-lg hover:scale-[1.03] active:scale-[0.97]"
                      style={{
                        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                        animationDelay: `${idx * 100}ms`,
                      }}
                    >
                      {/* Hover gradient */}
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-50/50 to-pink-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      
                      <div className="relative flex flex-col items-center gap-4">
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-br from-purple-200 to-pink-200 rounded-xl blur-md opacity-0 group-hover:opacity-40 transition-opacity duration-500" />
                          <div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 text-3xl shadow-sm group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                            {subcategory.emoji}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-base font-bold text-gray-900 group-hover:text-[#8B7FFF] transition-colors">
                            {subcategory.label}
                          </h3>
                          <p className="text-xs text-gray-500 leading-relaxed">
                            {subcategory.preview}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Emotion Selection */}
            {step === "emotion" && currentSubcategory && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center gap-4 mb-8">
                  <button
                    onClick={handleBack}
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-gray-600 shadow-sm transition-all hover:bg-[#F9FAFB] hover:shadow-md hover:scale-105 active:scale-95"
                  >
                    <span className="text-xl">←</span>
                  </button>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                      {currentSubcategory.label}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                      가장 가까운 감정을 선택해주세요
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {currentSubcategory.emotions.map((emotion, idx) => (
                    <button
                      key={emotion.label}
                      onClick={() => handleEmotionSelect(emotion.label)}
                      className={`group relative overflow-hidden rounded-2xl p-5 text-center transition-all duration-500 hover:scale-110 active:scale-95 ${
                        selectedEmotion === emotion.label
                          ? "bg-gradient-to-br from-[#8B7FFF] to-[#9D92FF] text-white shadow-xl"
                          : "bg-white text-gray-900 shadow-sm hover:shadow-lg hover:bg-gradient-to-br hover:from-purple-50 hover:to-pink-50"
                      }`}
                      style={{
                        boxShadow:
                          selectedEmotion === emotion.label
                            ? "0 8px 24px rgba(139, 127, 255, 0.4)"
                            : "0 2px 12px rgba(0,0,0,0.08)",
                        animationDelay: `${idx * 50}ms`,
                      }}
                    >
                      {/* Selected glow effect */}
                      {selectedEmotion === emotion.label && (
                        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-2xl" />
                      )}
                      
                      <div className="relative">
                        <div className={`text-4xl mb-3 transition-all duration-500 ${
                          selectedEmotion === emotion.label
                            ? "scale-110 rotate-6"
                            : "group-hover:scale-110 group-hover:rotate-3"
                        }`}>
                          {emotion.emoji}
                        </div>
                        <div className={`text-xs font-semibold transition-colors ${
                          selectedEmotion === emotion.label
                            ? "text-white"
                            : "text-gray-700 group-hover:text-[#8B7FFF]"
                        }`}>
                          {emotion.label}
                        </div>
                      </div>
                      
                      {/* Checkmark when selected */}
                      {selectedEmotion === emotion.label && (
                        <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Situation Input */}
            {step === "situation" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center gap-4 mb-8">
                  <button
                    onClick={handleBack}
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-gray-600 shadow-sm transition-all hover:bg-[#F9FAFB] hover:shadow-md hover:scale-105 active:scale-95"
                  >
                    <span className="text-xl">←</span>
                  </button>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                      어떤 상황이었나요?
                    </h2>
                    <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                      선택사항이에요. 나중에 기억하기 위해 기록해보세요
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="relative rounded-2xl bg-white p-6 shadow-lg overflow-hidden" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
                    {/* Gradient accent bar */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#8B7FFF] to-[#9D92FF]" />
                    
                    <div className="pl-4 space-y-5">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-br from-[#8B7FFF] to-[#9D92FF] rounded-xl blur-md opacity-30" />
                          <div className="relative flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[#8B7FFF] to-[#9D92FF] text-3xl shadow-md">
                            {currentSubcategory?.emotions.find((e) => e.label === selectedEmotion)?.emoji || "😊"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">선택한 감정</div>
                          <div className="text-xl font-bold text-gray-900">{selectedEmotion}</div>
                        </div>
                      </div>

                      <div className="relative">
                    <textarea
                      value={situation}
                      onChange={(e) => {
                        if (e.target.value.length <= 200) {
                          setSituation(e.target.value);
                        }
                      }}
                      placeholder="예: 오늘 회의에서 팀장이 내 의견을 무시했어요"
                      maxLength={200}
                      className="w-full min-h-[140px] resize-none rounded-xl border-2 border-transparent bg-gradient-to-br from-gray-50 to-gray-100/50 px-5 py-4 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-300 focus:border-[#8B7FFF] focus:bg-white focus:ring-4 focus:ring-purple-100 focus:shadow-md"
                      style={{
                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                      }}
                    />
                    <div className={`absolute bottom-3 right-3 text-xs transition-colors ${
                      situation.length > 180 ? "text-orange-500" : "text-gray-400"
                    }`}>
                      {situation.length}/200
                    </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSave}
                    disabled={!selectedEmotion}
                    className="group relative w-full overflow-hidden rounded-xl px-6 py-4 text-base font-semibold text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-xl"
                    style={{
                      background: "linear-gradient(135deg, #8B7FFF 0%, #9D92FF 100%)",
                      boxShadow: "0 6px 24px rgba(139, 127, 255, 0.4)",
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    <span className="relative flex items-center justify-center gap-2">
                      기록하기
                      <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 5: Complete */}
            {step === "complete" && (
              <div className="flex flex-col items-center justify-center min-h-[500px] space-y-8 text-center animate-in fade-in zoom-in-95 duration-700">
                {/* Success animation */}
                <div className="relative">
                  {/* Pulsing glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#8B7FFF] to-[#9D92FF] rounded-full opacity-30 blur-3xl animate-pulse" />
                  <div className="absolute inset-0 bg-gradient-to-br from-[#8B7FFF] to-[#9D92FF] rounded-full opacity-20 blur-2xl animate-ping" style={{ animationDuration: "2s" }} />
                  
                  {/* Main icon */}
                  <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-[#8B7FFF] via-[#9D92FF] to-[#A8A0FF] text-6xl shadow-2xl animate-bounce" style={{ animationDuration: "1.5s", animationIterationCount: "3" }}>
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/30 to-transparent" />
                    <span className="relative">✨</span>
                  </div>
                  
                  {/* Confetti effect (CSS circles) */}
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute h-2 w-2 rounded-full bg-gradient-to-br from-[#8B7FFF] to-[#9D92FF] opacity-60"
                      style={{
                        top: "50%",
                        left: "50%",
                        transform: `rotate(${i * 30}deg) translateY(-80px)`,
                        animation: `fadeOut 1s ease-out ${i * 0.1}s forwards`,
                      }}
                    />
                  ))}
                </div>
                
                <div className="space-y-3">
                  <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                    기록 완료!
                  </h2>
                  <p className="text-base text-gray-500 leading-relaxed">
                    오늘의 감정을 잘 기록했어요
                  </p>
                </div>
                
                <div className="flex gap-4 pt-6">
                  <button
                    onClick={() => {
                      setStep("main");
                      setSelectedMainCategory(null);
                      setSelectedSubcategory(null);
                      setSelectedEmotion(null);
                      setSituation("");
                    }}
                    className="rounded-xl border-2 border-gray-200 bg-white px-6 py-3.5 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 hover:border-gray-300 hover:shadow-md hover:scale-105 active:scale-95"
                  >
                    다시 기록하기
                  </button>
                  <button
                    onClick={() => router.push("/")}
                    className="rounded-xl px-6 py-3.5 text-sm font-semibold text-white transition-all hover:scale-105 active:scale-95 shadow-xl"
                    style={{
                      background: "linear-gradient(135deg, #8B7FFF 0%, #9D92FF 100%)",
                      boxShadow: "0 6px 24px rgba(139, 127, 255, 0.4)",
                    }}
                  >
                    홈으로
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

