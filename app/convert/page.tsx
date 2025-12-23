"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveConversation } from "@/lib/storage";
import type { Conversation } from "@/types";

type Stage = "observation" | "feeling" | "need" | "empathy" | "request" | "result";
type ChatMessage = { role: "assistant" | "user"; content: string };

const defaultOptions: Record<Stage, string[]> = {
  observation: [],
  feeling: ["화가 났어요", "서운했어요", "무시당한 느낌이었어요"],
  need: ["내 말도 들어주길 바랐어요", "존중받고 싶었어요", "이해받고 싶었어요"],
  empathy: [],
  request: [
    "내 말이 끝날 때까지 기다려줄래?",
    "다음엔 먼저 물어봐줄래?",
    "조금만 천천히 얘기해줄래?",
  ],
  result: [],
};

function ConvertPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const initialText = params.get("text") || "";

  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
      role: "assistant", 
      content: "오늘 힘든 하루를 보냈군요.\n누구와 어떤 일이 있었나요?" 
    },
  ]);
  const [stage, setStage] = useState<Stage>("observation");
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<string[]>(defaultOptions.observation);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState(initialText);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState<{ [key: number]: boolean }>({});
  const [activeTab, setActiveTab] = useState<'message' | 'guide'>('message');
  const [conversationData, setConversationData] = useState({
    observation: "",
    feeling: "",
    need: "",
    request: "",
    conversionText: "",
    originalMessage: "", // 원래 대화 저장
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasAutoSent = useRef(false);
  
  useEffect(() => {
    if (initialText && initialText.trim() && !hasAutoSent.current) {
      hasAutoSent.current = true;
      const source = initialText.trim();
      
      // 1. 즉시 대화 히스토리에 사용자 메시지 추가
      const userMessage: ChatMessage = { role: "user", content: source };
      setMessages((prev) => [...prev, userMessage]);
      setInputValue(""); // 입력창 비우기
      
      // 2. conversationData 업데이트
      setConversationData((prev) => ({ ...prev, observation: source }));
      
      // 3. API 호출
      setIsLoading(true);
      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: [
            { role: "assistant", content: "오늘 힘든 하루를 보냈군요.\n누구와 어떤 일이 있었나요?" }, 
            userMessage
          ], 
          stage: "observation" 
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) throw new Error(data.error);
          setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
          if (data.nextStage) setStage(data.nextStage);
          if (data.options?.length) {
            setOptions(data.options);
          } else {
            setOptions([]);
          }
        })
        .catch((err) => {
          console.error("Error:", err);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "잠시 문제가 생겼어요. 다시 시도해주세요." },
          ]);
        })
        .finally(() => setIsLoading(false));
    }
  }, [initialText]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        120
      )}px`;
    }
  }, [inputValue]);

  const stageAfter = (current: Stage): Stage => {
    if (current === "observation") return "feeling";
    if (current === "feeling") return "need";
    if (current === "need") return "result"; // Stage 4 제거: need → result
    if (current === "request") return "result"; // 호환성 유지
    return "result";
  };

  const handleSend = async (customText?: string) => {
    const source = typeof customText === "string" ? customText : inputValue;
    const content = (source ?? "").trim();
    if (!content) return;
    if (isLoading) return;

    setError(null);
    const userMessage: ChatMessage = { role: "user", content };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    const updatedData = (() => {
      if (stage === "observation") return { ...conversationData, observation: content };
      if (stage === "feeling") return { ...conversationData, feeling: content };
      if (stage === "need") return { ...conversationData, need: content };
      // Stage 4 (request) 제거됨
      return conversationData;
    })();
    setConversationData(updatedData);

    const outgoing = [
      ...messages.map((msg) => ({ 
        role: msg.role === "assistant" ? ("assistant" as const) : ("user" as const), 
        content: msg.content
      })),
      { 
        role: "user" as const, 
        content: userMessage.content
      }
    ];
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: outgoing, stage }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data?.error || "API 오류가 발생했어요.";
        throw new Error(errorMsg);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const reply = (data?.content as string) || "잠시 문제가 생겼어요. 다시 시도해주세요.";
      
      if (!reply || reply.trim() === "") {
        throw new Error("응답을 받지 못했어요.");
      }

      // AI 응답 메시지 추가 (항상 assistant role)
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);

      const computedNextStage = (data?.nextStage as Stage) || stageAfter(stage);
      setStage(computedNextStage);

      // Stage 변경 시 선택된 옵션 초기화 및 옵션 즉시 업데이트
      if (computedNextStage !== stage) {
        setSelectedOptions([]);
        // 옵션 즉시 업데이트 (감정/욕구 단계에서)
        if (data?.options?.length) {
          setOptions(data.options as string[]);
        } else {
          setOptions(defaultOptions[computedNextStage] || []);
        }
      } else {
        // 같은 Stage에서도 옵션 업데이트
        if (data?.options?.length) {
          setOptions(data.options as string[]);
        } else {
          setOptions([]);
        }
      }

      // Stage 3 → result 전환 시 NVC 데이터 저장
      if (computedNextStage === "result" && data?.nvcData) {
        const nvcData = data.nvcData;
        const conversionText = nvcData.fullMessage;
        
        // 원래 대화 추출 (observation 단계의 사용자 메시지들)
        const originalMessages = messages
          .filter(m => m.role === 'user')
          .slice(0, 2) // 처음 두 개의 사용자 메시지
          .map(m => m.content)
          .join(' ');
        
        const finalData = { 
          ...updatedData, 
          conversionText,
          observation: nvcData.observation,
          feeling: nvcData.emotions,
          need: nvcData.needs,
          request: nvcData.request,
          originalMessage: originalMessages || updatedData.observation,
        };
        setConversationData(finalData);
        
        // NVC 카드 메시지 추가
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: "NVC_CARD",
          nvcData: { ...nvcData, originalMessage: originalMessages || updatedData.observation },
        }]);
        
        const id = Date.now().toString();
        const conversation: Conversation = {
          id,
          date: Date.now(),
          situation: nvcData.observation,
          observation: nvcData.observation,
          emotion: nvcData.emotions,
          need: nvcData.needs,
          request: nvcData.request,
          conversionText,
          messages: [
            ...outgoing.map((msg) => ({
              role: msg.role === "assistant" ? ("ai" as const) : ("user" as const),
              content: msg.content,
              timestamp: Date.now()
            })),
            { role: "ai" as const, content: reply, timestamp: Date.now() },
            { role: "ai" as const, content: conversionText, timestamp: Date.now() }
          ],
          stage: "complete",
        };
        saveConversation(conversation);
      }
    } catch (err) {
      console.error("Error:", err);
      const errorObj = err as { message?: string };
      let errorMsg = errorObj?.message || "잠시 문제가 생겼어요. 다시 시도해주세요.";
      
      // 할당량 초과 오류에 대한 친절한 안내
      if (errorMsg.includes("quota") || errorMsg.includes("billing") || errorMsg.includes("한도")) {
        errorMsg = "API 사용량 한도에 도달했어요.\n\nOpenAI 계정을 확인해주세요:\n• https://platform.openai.com/account/billing\n• 결제 정보 및 크레딧 확인\n• 필요시 결제 수단 추가";
      }
      
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: errorMsg },
      ]);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const prevObservation = (data: typeof conversationData) => data.observation || "대화";
  const prevFeeling = (data: typeof conversationData) => data.feeling || "";
  const prevNeed = (data: typeof conversationData) => data.need || "";
  const prevRequest = (data: typeof conversationData) => data.request || "";

  const handleOptionClick = (option: string) => {
    // Stage 2 (feeling)과 Stage 3 (need)에서는 다중 선택 가능
    if (stage === "feeling" || stage === "need") {
      setSelectedOptions((prev) => {
        if (prev.includes(option)) {
          // 이미 선택된 경우 제거
          return prev.filter((item) => item !== option);
        } else {
          // 선택되지 않은 경우 추가
          return [...prev, option];
        }
      });
    } else if (stage === "empathy" && (option === "좋아요" || option === "괜찮아요")) {
      // empathy 단계에서 "좋아요" 또는 "괜찮아요" 클릭 시 다음 단계로 진행
      handleSend("정리 시작하기");
    } else {
      // 다른 Stage에서는 기존처럼 바로 전송
      handleSend(option);
    }
  };

  const handleSubmitSelectedOptions = () => {
    if (selectedOptions.length === 0) return;
    
    // 선택된 감정들을 쉼표로 구분하여 전송
    const combinedText = selectedOptions.join(", ");
    setSelectedOptions([]); // 즉시 선택 초기화
    setOptions([]); // 옵션 버튼 즉시 제거
    handleSend(combinedText);
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const disabled = isLoading;

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: "#FAFAFA" }}
    >
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[#F3F4F6] bg-white px-4 sm:px-5">
        <button
          onClick={() => router.push("/")}
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

      <div className="flex-1 pb-[100px]">
        <div
          ref={scrollRef}
          className="mx-auto flex h-[calc(100vh-200px)] max-w-[640px] flex-col overflow-y-auto px-5 pb-6 pt-6 sm:px-6"
        >
          <div className="space-y-4">
            {messages.map((message, index) => {
              const isAssistant = message.role === "assistant";
              
              // NVC 카드 메시지 처리
              if (message.content === "NVC_CARD" && (message as any).nvcData) {
                const nvcData = (message as any).nvcData;
                const originalMessage = nvcData.originalMessage || conversationData.originalMessage || conversationData.observation;
                
                return (
                  <div
                    key={index}
                    className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300 w-full"
                    style={{
                      animationDelay: `${index * 0.1}s`,
                    }}
                  >
                    <div className="w-full max-w-[640px] mx-auto px-4 sm:px-6">
                      {/* 타이틀 */}
                      <div className="mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">번역 결과</h2>
                      </div>
                      
                      {/* 탭 네비게이션 */}
                      <div className="flex gap-1 mb-6 border-b border-gray-200">
                        <button
                          onClick={() => setActiveTab('message')}
                          className={`px-4 py-2 text-sm font-semibold transition-colors relative ${
                            activeTab === 'message'
                              ? 'text-gray-900'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          이렇게 말해보세요
                          {activeTab === 'message' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></div>
                          )}
                        </button>
                        <button
                          onClick={() => setActiveTab('guide')}
                          className={`px-4 py-2 text-sm font-semibold transition-colors relative ${
                            activeTab === 'guide'
                              ? 'text-gray-900'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          대화 분석
                          {activeTab === 'guide' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></div>
                          )}
                        </button>
                      </div>
                      
                      {/* 메시지 탭 */}
                      {activeTab === 'message' && (
                        <div className="space-y-6">
                          {/* 원래 대화 */}
                          {originalMessage && (
                            <div className="space-y-2">
                              <div className="text-sm text-gray-500 font-medium">원래 대화</div>
                              <div className="rounded-xl bg-gray-100 px-4 py-3 text-[15px] text-gray-800 leading-relaxed">
                                {originalMessage}
                              </div>
                            </div>
                          )}
                          
                          {/* 변환 화살표 */}
                          {originalMessage && (
                            <div className="flex justify-center py-2">
                              <div className="flex items-center gap-2 text-purple-600">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                </svg>
                                <span className="text-sm font-medium">건강한 대화로 변환</span>
                              </div>
                            </div>
                          )}
                          
                          {/* 변환된 메시지 카드 */}
                          <div className="relative rounded-2xl bg-white border border-gray-200 shadow-lg overflow-hidden">
                            {/* 보라색 세로 바 */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 to-indigo-600"></div>
                            
                            <div className="pl-6 pr-6 py-6">
                              <div className="mb-3">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-50">
                                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                  </svg>
                                  <span className="text-sm font-semibold text-purple-700">이렇게 말해보세요</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1.5">참고해서 내 말로 바꿔보세요</p>
                              </div>
                              
                              <div className="text-[15px] text-gray-800 whitespace-pre-line leading-[1.8] font-normal">
                                {nvcData.fullMessage}
                              </div>
                              
                              {/* 복사 버튼 */}
                              <div className="mt-6 flex gap-3">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(nvcData.fullMessage);
                                    alert('복사되었습니다!');
                                  }}
                                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-purple-200 bg-white hover:bg-purple-50 transition-colors"
                                >
                                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  <span className="text-sm font-semibold text-purple-600">복사하기</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* 대화 분석 탭 */}
                      {activeTab === 'guide' && (
                        <div className="space-y-4">
                          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
                            <div className="space-y-5">
                              {/* 관찰 */}
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="h-2 w-2 rounded-full bg-[#8B7FFF]"></div>
                                  <div className="text-sm font-bold text-gray-700">관찰</div>
                                </div>
                                <div className="pl-4 text-[15px] text-gray-800 leading-relaxed">{nvcData.observation}</div>
                              </div>
                              
                              {/* 감정 */}
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="h-2 w-2 rounded-full bg-[#8B7FFF]"></div>
                                  <div className="text-sm font-bold text-gray-700">감정</div>
                                </div>
                                <div className="pl-4 text-[15px] text-gray-800 leading-relaxed">
                                  {(() => {
                                    const emotions = typeof nvcData.emotions === 'string' 
                                      ? nvcData.emotions.split(',').map((e: string) => e.trim()).filter((e: string) => e)
                                      : [];
                                    
                                    if (emotions.length === 0) return nvcData.emotions;
                                    
                                    const emotionMap: { [key: string]: string } = {
                                      '화남': '화나', '서운함': '서운', '속상함': '속상', '불안함': '불안', '외로움': '외롭',
                                      '무시당함': '무시당하', '답답함': '답답', '억울함': '억울', '짜증남': '짜증나',
                                      '실망스러움': '실망스러워', '피곤함': '피곤', '자존심상함': '자존심상하', '분함': '분',
                                      '배신감': '배신당하', '혼란스러움': '혼란스러워', '난처함': '난처', '당황함': '당황',
                                      '무서움': '무서', '부끄러움': '부끄러', '두려움': '두려'
                                    };
                                    
                                    // "하"를 추가하면 안 되는 감정들
                                    const noHaEmotions = ['분', '억울', '답답', '서운', '속상', '불안', '피곤', '난처', '무서', '부끄러', '두려'];
                                    
                                    const converted = emotions.map((emotion: string) => {
                                      const base = emotionMap[emotion] || emotion.replace(/함$/, '하').replace(/남$/, '나').replace(/움$/, '워');
                                      // 여러 감정을 연결할 때는 "하"를 추가해야 함
                                      // 단, noHaEmotions에 포함된 감정은 "하"를 추가하지 않음
                                      if (!base.endsWith('하') && !base.endsWith('나') && !base.endsWith('워')) {
                                        if (!noHaEmotions.includes(base)) {
                                          return base + '하';
                                        }
                                      }
                                      return base;
                                    });
                                    
                                    // "분고" → "분하고" 같은 오류 수정
                                    let result = '';
                                    if (converted.length === 1) {
                                      result = `${converted[0]}했어요`;
                                    } else if (converted.length === 2) {
                                      result = `${converted[0]}고 ${converted[1]}했어요`;
                                    } else {
                                      const last = converted[converted.length - 1];
                                      const rest = converted.slice(0, -1).map((e: string) => `${e}고`).join(' ');
                                      result = `${rest} ${last}했어요`;
                                    }
                                    
                                    // 오류 수정
                                    result = result.replace(/분고/g, '분하고');
                                    result = result.replace(/억울고/g, '억울하고');
                                    result = result.replace(/답답고/g, '답답하고');
                                    result = result.replace(/당황고/g, '당황하고');
                                    // "당황하" → "당황"으로 수정 (여러 감정 연결 시 "당황하"가 잘못 생성되는 경우)
                                    result = result.replace(/당황하하고/g, '당황하고');
                                    result = result.replace(/당황하했어요/g, '당황했어요');
                                    
                                    return result;
                                  })()}
                                </div>
                              </div>
                              
                              {/* 욕구 */}
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="h-2 w-2 rounded-full bg-[#8B7FFF]"></div>
                                  <div className="text-sm font-bold text-gray-700">욕구</div>
                                </div>
                                <div className="pl-4 text-[15px] text-gray-800 leading-relaxed">{nvcData.needs}</div>
                              </div>
                              
                              {/* 부탁 */}
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="h-2 w-2 rounded-full bg-[#8B7FFF]"></div>
                                  <div className="text-sm font-bold text-gray-700">부탁</div>
                                </div>
                                <div className="pl-4 text-[15px] text-gray-800 leading-relaxed">{nvcData.request}</div>
                              </div>
                            </div>
                          </div>
                          
                          {/* 어떻게 바뀌었을까요? 카드 */}
                          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-5 text-center">어떻게 바뀌었을까요?</h3>
                            <div className="space-y-4">
                              <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 flex-shrink-0">
                                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm font-semibold text-gray-800 mb-1">사실만 말했어요</div>
                                  <div className="text-xs text-gray-500">평가(X) → 관찰(○)</div>
                                </div>
                              </div>
                              
                              <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 flex-shrink-0">
                                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                  </svg>
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm font-semibold text-gray-800 mb-1">감정을 표현했어요</div>
                                  <div className="text-xs text-gray-500">생각(X) → 느낌(○)</div>
                                </div>
                              </div>
                              
                              <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 flex-shrink-0">
                                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                  </svg>
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm font-semibold text-gray-800 mb-1">필요를 찾았어요</div>
                                  <div className="text-xs text-gray-500">수단(X) → 욕구(○)</div>
                                </div>
                              </div>
                              
                              <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 flex-shrink-0">
                                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                  </svg>
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm font-semibold text-gray-800 mb-1">구체적으로 부탁했어요</div>
                                  <div className="text-xs text-gray-500">강요(X) → 부탁(○)</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              
              // 일반 메시지
              return (
                <div
                  key={index}
                  className={`flex animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                    isAssistant ? "justify-start" : "justify-end"
                  }`}
                  style={{
                    animationDelay: `${index * 0.1}s`,
                  }}
                >
                  <div
                    className={`max-w-[90%] sm:max-w-[85%] rounded-[18px] px-[18px] py-[14px] text-base leading-relaxed shadow ${
                      isAssistant
                        ? "rounded-tl-[6px] border border-[#F3F4F6] bg-white text-[#374151]"
                        : "rounded-tr-[6px] text-white"
                    }`}
                    style={
                      isAssistant
                        ? { boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }
                        : {
                            background: "linear-gradient(135deg, #8B7FFF 0%, #9D92FF 100%)",
                            boxShadow: "0 2px 12px rgba(139, 127, 255, 0.20)",
                          }
                    }
                  >
                    <div className="whitespace-pre-line leading-relaxed">{message.content}</div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start mb-4">
                <div
                  className="max-w-[90%] sm:max-w-[85%] rounded-[22px] rounded-tl-[6px] border border-[#F3F4F6] bg-white px-5 py-4"
                  style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}
                >
                  <div className="flex items-center gap-2 text-gray-400">
                    <span>생각하는 중</span>
                    <div className="flex gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-gray-400 animate-pulse" />
                      <span className="inline-block h-2 w-2 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: "0.2s" }} />
                      <span className="inline-block h-2 w-2 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: "0.4s" }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {options.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 max-w-[500px]">
                  {options.map((option) => {
                    // 이모지와 텍스트 분리 (이모지가 있는 경우)
                    const parts = option.split(" ");
                    const emoji = parts[0];
                    const text = parts.slice(1).join(" ") || option;
                    const hasEmoji = /^[\p{Emoji}]$/u.test(emoji);
                    
                    // 감정 매핑 (텍스트만 있는 경우)
                    const emotionEmojiMap: Record<string, string> = {
                      "화남": "😡",
                      "서운함": "😔",
                      "속상함": "😢",
                      "불안함": "😟",
                      "외로움": "😞",
                      "무시당함": "😶",
                      "답답함": "😤",
                      "억울함": "😕",
                      "짜증남": "😠",
                      "실망스러움": "😞",
                      "피곤함": "😫",
                      "자존심상함": "😤",
                      "분함": "😡",
                      "배신감": "😢",
                      "혼란스러움": "😵‍💫",
                      "난처함": "😳",
                      "당황함": "😰",
                      "무서움": "😨",
                      "부끄러움": "😳",
                      "두려움": "😨",
                      "존중": "💚",
                      "이해": "💙",
                      "배려": "💜",
                      "솔직함": "💛",
                      "연결감": "🤝",
                      "안정감": "🛡️",
                      "자유": "🕊️",
                      "인정": "⭐",
                    };
                    
                    const displayEmoji = hasEmoji ? emoji : (emotionEmojiMap[text] || emotionEmojiMap[option] || "");
                    const displayText = hasEmoji ? text : option;
                    const isSelected = selectedOptions.includes(option);
                    const isMultiSelectStage = stage === "feeling" || stage === "need";
                    
                    // "좋아요" 버튼에 살짝 색 넣기
                    const isGoodButton = option === "좋아요";
                    
                    return (
                      <button
                        key={option}
                        onClick={() => handleOptionClick(option)}
                        disabled={disabled && !isMultiSelectStage}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border shadow-sm transition-all hover:shadow-md active:scale-[0.95] disabled:opacity-60 ${
                          isMultiSelectStage && isSelected
                            ? "border-[#8B7FFF] bg-[#8B7FFF] text-white"
                            : isMultiSelectStage
                            ? "border-[#E5E7EB] bg-white text-gray-700 hover:border-[#8B7FFF] hover:bg-purple-50"
                            : isGoodButton
                            ? "border-[#8B7FFF] bg-purple-50 text-[#8B7FFF] hover:bg-purple-100"
                            : "border-[#E5E7EB] bg-white text-gray-700 hover:border-[#8B7FFF] hover:bg-purple-50 active:border-[#8B7FFF] active:bg-[#8B7FFF] active:text-white"
                        }`}
                      >
                        <span className="text-sm font-medium">
                          {displayText}
                        </span>
                        {displayEmoji && (
                          <span className="text-base leading-none">{displayEmoji}</span>
                        )}
                        {isMultiSelectStage && isSelected && (
                          <span className="ml-1 text-xs">✓</span>
                        )}
                      </button>
                    );
                  })}
                  {/* 직접 입력 옵션 - 제일 뒤로 */}
                  {(stage === "feeling" || stage === "need") && (
                    <button
                      onClick={() => {
                        // 직접 입력 모드 활성화
                        setInputValue("");
                        textareaRef.current?.focus();
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-dashed border-gray-300 bg-white text-gray-600 hover:border-purple-300 hover:bg-purple-50 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="text-sm font-medium">직접 입력</span>
                    </button>
                  )}
                </div>
                
                {/* Stage 2 또는 Stage 3에서 선택된 옵션이 있으면 다음 버튼 표시 */}
                {(stage === "feeling" || stage === "need") && selectedOptions.length > 0 && (
                  <button
                    onClick={handleSubmitSelectedOptions}
                    disabled={disabled}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <span>다음</span>
                    <span className="text-sm">({selectedOptions.length})</span>
                  </button>
                )}
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-white p-3 text-sm text-red-500 shadow">
                {error}
                <button
                  className="ml-2 text-[#8B7FFF] underline"
                  onClick={() => {
                    setError(null);
                    handleSend();
                  }}
                >
                  다시 시도
                </button>
              </div>
            )}
            <div id="messages-end" ref={messagesEndRef} />
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] z-10">
        <div className="max-w-[640px] mx-auto px-5 py-4" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
          <div className="relative flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="메시지를 입력하세요"
              disabled={disabled}
              className="flex-1 min-h-[48px] max-h-[120px] px-5 py-3 pr-14 bg-[#FAFAFA] border border-gray-200 rounded-[24px] resize-none overflow-y-auto focus:outline-none focus:border-purple-400 focus:ring-3 focus:ring-purple-100 placeholder:text-gray-400 text-base text-[#333]"
              rows={1}
            />
            <button
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isLoading}
              className="absolute right-2 bottom-2 w-11 h-11 rounded-[22px] bg-gradient-to-br from-purple-500 to-purple-600 disabled:from-gray-300 disabled:to-gray-300 flex items-center justify-center shadow-[0_4px_12px_rgba(147,51,234,0.24)] hover:scale-105 active:scale-95 transition-all duration-200 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 3l7 7-7 7V3z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConvertPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] text-gray-600">
        로딩 중...
      </div>
    }>
      <ConvertPageContent />
    </Suspense>
  );
}

