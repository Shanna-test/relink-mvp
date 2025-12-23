import OpenAI from "openai";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";

type Stage = "observation" | "feeling" | "need" | "empathy" | "result";
type IncomingMessage = { role: "assistant" | "user"; content: string };

// 사용자 답변이 충분히 구체적인지 판단
function isSpecificEnough(text: string): boolean {
  // 1. 너무 짧으면 불충분
  if (text.length < 15) return false;

  const lower = text.toLowerCase();

  // 2. 막연한 표현 패턴 (더 많이 추가)
  const vaguePatterns = [
    /^오늘.*힘들/,
    /^너무.*힘들/,
    /^정말.*힘들/,
    /힘들어요$/,
    /^힘든.*하루/,
    /^피곤/,
    /^지쳐/,
    /^우울/,
    /^화나/,
    /맨날 그래/,
    /또 그래/,
    /언제.*나아/,
    /대체 왜/,
    /^그냥/,
    /^별로/,
    /^뭔가/,
    /^그렇게/,
    /^그런/,
  ];

  for (const pattern of vaguePatterns) {
    if (pattern.test(text)) return false;
  }

  // 3. 구체적 표현 패턴
  const specificPatterns = [
    /".*"/, // 인용부호
    /\d+번/, // 숫자 (5번, 10번)
    /\d+시간/, // 시간
    /\d+분/, // 분
    /(말했|했|그랬|소리|지르|늦|무시|끼어들|자르|듣지|들어주지)/, // 구체적 동사
    /(때문|해서|하면서|하고)/, // 인과관계
    /(보고서|문서|자료|메시지|전화|회의|약속|약속시간)/, // 구체적 대상
    /(라고|라며|라고 했|라고 말)/, // 인용 표현
  ];

  let hasSpecific = false;
  for (const pattern of specificPatterns) {
    if (pattern.test(text)) {
      hasSpecific = true;
      break;
    }
  }

  // 4. 충분 조건: 구체적 표현 있고 + 적절한 길이
  return hasSpecific && text.length >= 20;
}

// 감정을 자연스러운 형태로 변환 (메시지에서 "~했어요" 형태로 사용)
// 명사형(화남, 당황함, 억울함) → 동사형(화나, 당황, 억울) 변환
function convertEmotionToNatural(emotion: string): string {
  // 명사형 감정을 동사형으로 변환하는 매핑
  const emotionMap: { [key: string]: string } = {
    '화남': '화나',
    '서운함': '서운',
    '속상함': '속상',
    '불안함': '불안',
    '외로움': '외롭',
    '무시당함': '무시당하',
    '답답함': '답답',
    '억울함': '억울',
    '짜증남': '짜증나',
    '실망스러움': '실망스러워', // "실망스럽" → "실망스러워"로 수정
    '피곤함': '피곤',
    '자존심상함': '자존심상하',
    '분함': '분',
    '배신감': '배신당하',
    '혼란스러움': '혼란스러워', // "혼란스럽" → "혼란스러워"로 수정
    '난처함': '난처',
    '당황함': '당황하', // "당황"은 "당황하"로 변환되어야 함
    '무서움': '무서',
    '부끄러움': '부끄러',
    '두려움': '두려',
    '힘듦': '힘들',
    '힘든': '힘들'
  };
  
  // 매핑에 있으면 즉시 반환
  if (emotionMap[emotion]) {
    return emotionMap[emotion];
  }
  
  // 매핑에 없으면 자동 변환 규칙 적용
  // "~함" → "~하" (예: "답답함" → "답답하")
  if (emotion.endsWith('함')) {
    return emotion.replace(/함$/, '하');
  }
  // "~남" → "~나" (예: "짜증남" → "짜증나")
  if (emotion.endsWith('남')) {
    return emotion.replace(/남$/, '나');
  }
  // "~움" → "~워" (예: "외로움" → "외로워")
  if (emotion.endsWith('움')) {
    return emotion.replace(/움$/, '워');
  }
  
  // 변환 실패 시 원본 반환 (하지만 로그 출력)
  console.warn(`감정 변환 실패: "${emotion}" → 원본 반환`);
  return emotion;
}

// 여러 감정을 자연스러운 문장으로 변환
function convertEmotionsToSentence(emotions: string[]): string {
  if (emotions.length === 0) return '';
  
  // "하"를 추가하면 안 되는 감정들 (예: "분" → "분했어요", "분하했어요" ❌)
  // "당황"은 "당황하"로 변환되어야 하므로 제외
  const noHaEmotions = ['분', '억울', '답답', '서운', '속상', '불안', '피곤', '난처', '무서', '부끄러', '두려'];
  
  if (emotions.length === 1) {
    const converted = convertEmotionToNatural(emotions[0]);
    // "~하"로 끝나면 그대로, "하"를 추가하면 안 되는 감정이면 그대로, 아니면 "~하" 추가
    if (converted.endsWith('하') || converted.endsWith('나') || converted.endsWith('워')) {
      return converted;
    }
    if (noHaEmotions.includes(converted)) {
      return converted; // "분" → "분했어요" (직접 "했어요" 붙임)
    }
    return converted + '하';
  }
  
    const converted = emotions.map(e => {
    let natural = convertEmotionToNatural(e);
    // 여러 감정을 연결할 때는 "~하"를 추가해야 함 (단독 사용 시에만 "하" 없이)
    // "~하", "~나", "~워"로 끝나지 않으면 "~하" 추가
    // 단, "~워"로 끝나는 경우는 "하"를 추가하지 않음 (예: "실망스러워", "혼란스러워")
    // "억울", "분", "답답" 등은 "하"를 추가하면 안 됨 (noHaEmotions)
    // "당황하"는 이미 "하"가 포함되어 있으므로 그대로 사용
    if (!natural.endsWith('하') && !natural.endsWith('나') && !natural.endsWith('워')) {
      // noHaEmotions에 포함된 감정은 "하"를 추가하지 않음
      if (!noHaEmotions.includes(natural)) {
        natural = natural + '하';
      }
    }
    return natural;
  });
  
  if (converted.length === 2) {
    return `${converted[0]}고 ${converted[1]}`;
  }
  
  // 3개 이상: "화나고 불안하고 답답하"
  const last = converted[converted.length - 1];
  const others = converted.slice(0, -1).map(e => `${e}고`).join(' ');
  return `${others} ${last}`;
}

// 대화에서 가장 구체적인 상황 추출
function extractConversationData(messages: any[]): any {
  const userMessages = messages.filter((m: any) => m.role === 'user');
  
  // 1. 상황 (observation stage의 사용자 입력 중 구체적인 것)
  const observationMessages = [];
  for (let i = 0; i < userMessages.length; i++) {
    const msg = userMessages[i].content;
    // JSON 배열이면 감정 단계 시작
    try {
      const parsed = JSON.parse(msg);
      if (Array.isArray(parsed)) {
        break; // 감정 선택 메시지 발견
      }
    } catch {
      // JSON이 아니면 observation 단계 메시지
      // "네", "예", "맞아요" 같은 단순 응답 제외
      const trimmed = msg.trim();
      if (trimmed && trimmed.length > 3 && !['네', '예', '맞아요', '맞아', '응', '어', '그래'].includes(trimmed)) {
        observationMessages.push(msg);
      }
    }
  }
  
  // 가장 구체적인 상황 추출 (더 강화된 로직)
  let specificSituation = '';
  
  // 1순위: 가장 긴 메시지 (보통 가장 구체적)
  if (observationMessages.length > 0) {
    const longestMessage = observationMessages.reduce((longest, current) => 
      current.length > longest.length ? current : longest
    );
    specificSituation = longestMessage;
  }
  
  // 2순위: 두 번째 입력이 있으면 그게 가장 구체적일 가능성이 높음
  if (observationMessages.length >= 2) {
    // 두 번째 입력이 첫 번째보다 길거나 구체적이면 사용
    if (observationMessages[1].length >= observationMessages[0].length) {
      specificSituation = observationMessages[1];
    }
  }
  
  // 3순위: 첫 번째 입력
  if (!specificSituation && observationMessages.length >= 1) {
    specificSituation = observationMessages[0];
  }
  
  // 모든 observation 메시지를 합쳐서 사용 (더 안전한 방법)
  if (!specificSituation || specificSituation.length < 10) {
    const allObservationText = observationMessages.join(' ');
    if (allObservationText.length > specificSituation.length) {
      specificSituation = allObservationText;
    }
  }
  
  // 2. 감정 (feeling stage의 사용자 선택)
  let selectedEmotions: string[] = [];
  const feelingMessage = userMessages.find((m: any) => {
    const content = m.content;
    // 쉼표로 구분된 감정 리스트 또는 JSON 배열
    if (content.includes(',')) {
      const parts = content.split(',').map((e: string) => e.trim());
      // 감정 키워드가 포함되어 있으면 감정 선택 메시지로 간주
      const emotionKeywords = ['화남', '서운함', '속상함', '불안함', '외로움', '답답함', '억울함', '짜증남', '실망스러움', '무시당함'];
      if (parts.some((p: string) => emotionKeywords.some((k: string) => p.includes(k)))) {
        return true;
      }
    }
    // JSON 배열 체크
    try {
      const parsed = JSON.parse(content);
      return Array.isArray(parsed);
    } catch {
      return false;
    }
  });
  
  if (feelingMessage) {
    try {
      const parsed = JSON.parse(feelingMessage.content);
      selectedEmotions = Array.isArray(parsed) ? parsed : [feelingMessage.content];
    } catch {
      // JSON 파싱 실패 시 쉼표로 구분된 문자열 처리
      selectedEmotions = feelingMessage.content.split(',').map((e: string) => e.trim()).filter((e: string) => e);
    }
  }
  
  return {
    specificSituation,
    selectedEmotions,
  };
}

// Before 메시지 생성 (사용자가 원래 말했을 법한 메시지)
function generateBeforeMessage(conversationData: any): string {
  const situation = conversationData.specificSituation || '';
  const emotions = conversationData.selectedEmotions || [];
  
  // 감정을 자연스러운 문장으로 변환
  const emotionText = emotions.length > 0
    ? emotions.map((e: string) => {
        // 감정을 자연스러운 표현으로 변환
        const emotionMap: { [key: string]: string } = {
          '화남': '화가 났어',
          '답답함': '답답했어',
          '서운함': '서운했어',
          '속상함': '속상했어',
          '불안함': '불안했어',
          '외로움': '외로웠어',
          '억울함': '억울했어',
          '짜증남': '짜증났어',
          '실망스러움': '실망스러웠어',
          '무시당함': '무시당한 느낌이었어',
        };
        return emotionMap[e] || e;
      }).join('고 ')
    : '힘들었어';
  
  // Before 메시지 생성 (비난적이거나 감정적인 표현)
  if (situation.includes('못') || situation.includes('실수')) {
    return `"왜 이렇게 못하니? 제대로 좀 해봐!"`;
  } else if (situation.includes('늦') || situation.includes('약속')) {
    return `"왜 또 늦었어? 약속을 지켜야지!"`;
  } else if (situation.includes('무시') || situation.includes('반말')) {
    return `"왜 나를 무시하는 거야? 예의 좀 지켜!"`;
  } else if (situation.includes('말') || situation.includes('듣지')) {
    return `"내 말 좀 들어봐! 왜 자꾸 끼어들어?"`;
  } else {
    return `"${situation}... 정말 ${emotionText}!"`;
  }
}

// 욕구 + 상황에서 부탁 자동 생성 (OpenAI API 사용)
async function generateRequestFromContext(needs: string[], situation: string, apiKey: string): Promise<string> {
  try {
    const openai = new OpenAI({ apiKey });
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `당신은 상황과 욕구를 분석해서 적절한 부탁을 생성하는 전문가입니다.
사용자가 경험한 상황과 선택한 욕구를 분석해서, 긍정적이고 구체적인 행동 요구를 생성해주세요.

**중요 규칙:**
1. 부탁은 "~해주세요" 형태로 사용될 예정이므로, "~해달라고 얘기해줄" 또는 "~해줄" 형태로 끝나야 합니다.
2. 부탁은 반드시 자연스러운 한국어 표현이어야 합니다.
3. 설명이나 이유는 포함하지 마세요. 부탁만 생성하세요.
4. 상황에 직접적으로 관련된 구체적인 행동만 포함하세요.
5. **이 부탁은 갈등의 상대방에게 직접 전달하는 말입니다.**
6. **"~에게" 같은 간접 표현을 사용하지 마세요.** 상대방에게 직접 말하는 것처럼 자연스럽게 작성하세요.
7. **긍정적이고 구체적이며 친절한 표현**을 사용하세요
8. **"~해줄" 또는 "~해달라고 얘기해줄" 형태로 끝나야 합니다.** 끝에 "할"만 붙이지 마세요.
9. **사용자 입장에서 상대방에게 직접 부탁하는 형태로 작성하세요.** 예를 들어:
   - "보고서 작성에 대한 지침을 분명하게 해주세요" ❌ (3인칭, 지시적)
   - "보고서 작성하다 잘 모르겠으면 바로 물어봐줄래?" ✅ (1인칭, 직접적, 질문형)
   - "다음부터는 늦을 것 같으면 미리 연락해줄래?" ✅ (1인칭, 직접적, 질문형)
10. **부탁은 구체적이고 대안을 제시하는 것이 좋습니다:**
    - "내 시간을 존중해주고 예의를 갖춰 약속을 지켜달라고 부탁할게요" ❌ (너무 길고 복잡)
    - "다음에는 약속을 지키면 좋겠고, 혹시 지키기 어려우면 1시간 전에는 얘기해줄래?" ✅ (구체적이고 대안 제시)

**올바른 예시:**
- "카드를 제대로 찍어달라고 친절하게 요청해줄" (상대방에게 직접, 친절하게)
- "평소 목소리로 카드를 다시 찍어달라고 얘기해줄" (상대방에게 직접)
- "내 말을 끝까지 들어줄"
- "약속 시간을 지켜달라고 얘기해줄" (상대방에게 직접)
- "다음에는 약속을 지키면 좋겠고, 혹시 지키기 어려우면 1시간 전에는 얘기해줄래?" (구체적이고 대안 제시)

**잘못된 예시 (절대 하지 마세요):**
- "아저씨에게 평소 목소리로 카드를 똑바로 찍어달라고 얘기해줄" ❌ ("~에게" 간접 표현)
- "카드를 제대로 찍을 수 있도록 조언해줄" ❌ (어색한 표현)
- "카드를 찍어달라고 할" ❌ (끝에 "할"만 붙임)
- "마음이 상할 때, 상대방이 예의를 지켜주는 것은 정말 중요한 일입니다..." ❌ (너무 길고 설명적)
- "상대방이 예의를 지켜주길 바랄" ❌ (이유 포함)
- "내 마음을 이해해줄" ❌ (너무 막연함)
- "보고서 작성에 대한 지침을 분명하게 해주세요" ❌ (3인칭, 지시적, 사용자 입장 아님)
- "내 시간을 존중해주고 예의를 갖춰 약속을 지켜달라고 부탁할게요" ❌ (너무 길고 복잡)`
        },
        {
          role: "user",
          content: `다음 상황과 욕구에 맞는 구체적인 부탁을 생성해주세요:\n상황: ${situation}\n욕구: ${needs.join(', ')}`
        }
      ],
      temperature: 0.7,
      max_tokens: 100,
    });
    
    const response = completion.choices[0].message?.content || "";
    let request = response.trim();
    
    // 따옴표 제거
    request = request.replace(/^["']|["']$/g, '');
    
    // "할 수 있을까요?" 같은 중복 제거
    request = request.replace(/할 수 있을까요\?/g, '');
    request = request.replace(/수 있을까요\?/g, '');
    request = request.trim();
    
    // 설명적인 문장 제거 (예: "마음이 상할 때, 상대방이...")
    if (request.includes('때') && request.includes(',')) {
      // 쉼표 이후 부분만 사용
      const parts = request.split(',');
      if (parts.length > 1) {
        request = parts[parts.length - 1].trim();
      }
    }
    
    // "저에게", "저에게는", "상대방에게", "아저씨에게" 같은 간접 표현 제거
    request = request.replace(/^저에게는?\s*/, '');
    request = request.replace(/^상대방에게\s*/, '');
    request = request.replace(/^상대방이\s*/, '');
    request = request.replace(/아저씨에게\s*/g, '');
    request = request.replace(/에게\s*/g, '');
    
    if (request && request.length > 0) {
    // "~해줄" 또는 "~해달라고 얘기해줄" 형태로 끝나도록 보정
    if (!request.endsWith('해줄') && !request.endsWith('해달라고 얘기해줄') && !request.endsWith('줄')) {
      // "~해주세요" → "~해줄"
      if (request.endsWith('해주세요')) {
        request = request.replace(/해주세요$/, '해줄');
      } else if (request.endsWith('주세요')) {
        request = request.replace(/주세요$/, '줄');
      } else if (request.endsWith('할')) {
        // 끝에 "할"만 있으면 제거하고 "해줄" 추가
        request = request.replace(/할$/, '해줄');
      } else {
        // 기본적으로 "해줄" 추가
        request = request + '해줄';
      }
    }
    // 끝에 의미 없는 "할"만 있는 경우 제거
    if (request.endsWith('할') && request.length <= 3) {
      request = request.replace(/할$/, '해줄');
    }
    return request;
    }
  } catch (error) {
    console.error('OpenAI API Error in generateRequestFromContext:', error);
  }
  
  // Fallback: 기본 부탁 (자연스러운 한국어 표현, 상대방에게 직접)
  const needsText = needs.join(' ').toLowerCase();
  const situationLower = situation.toLowerCase();
  
  if (situationLower.includes('소리') || situationLower.includes('지르')) {
    if (situationLower.includes('카드') || situationLower.includes('찍')) {
      return '평소 목소리로 카드를 다시 찍어달라고 얘기해줄';
    }
    return '평소 목소리로 말해달라고 얘기해줄';
  }
  if (situationLower.includes('카드') && situationLower.includes('찍')) {
    return '평소 목소리로 카드를 다시 찍어달라고 얘기해줄';
  }
  if (situationLower.includes('말') || situationLower.includes('듣지')) {
    return '내 말을 끝까지 들어줄';
  }
  if (needsText.includes('안전') || needsText.includes('편안')) {
    return '내 주변 환경이 안전하고 편안했으면 좋겠을';
  }
  
  return '내 마음을 이해해줄';
}

// NVC 메시지 자동 생성 (기존 함수 유지 - 호환성)
async function generateNVCMessage(conversationData: any, needs: string[], apiKey: string): Promise<string> {
  const nvcData = await generateNVCData(conversationData, needs, apiKey);
  return nvcData.fullMessage;
}

// NVC 데이터 구조화 함수 (완전 재작성)
async function generateNVCData(conversationData: any, needs: string[], apiKey: string): Promise<any> {
  // 1. 관찰: 사용자가 입력한 구체적 상황
  const situation = conversationData.specificSituation || '';
  
  // 2. 감정: 사용자가 선택한 감정들
  const emotions = conversationData.selectedEmotions || [];
  
  // 감정 텍스트 (원본, 표시용)
  const emotionText = emotions.length > 0
    ? emotions.join(', ')
    : '힘들었어요';
  
  // 감정 (자연스러운 형태, 메시지용)
  // 명사형(화남, 당황함, 억울함) → 동사형(화나고, 당황하고, 억울하고) 변환
  // "하"를 추가하면 안 되는 감정들 (예: "분" → "분했어요", "분하했어요" ❌)
  // "당황"은 "당황하"로 변환되어야 하므로 제외
  const noHaEmotions = ['분', '억울', '답답', '서운', '속상', '불안', '피곤', '난처', '무서', '부끄러', '두려', '힘들'];
  
  const emotionNatural = emotions.length > 1
    ? emotions.map((e: string) => {
        // 명사형 감정을 동사형으로 변환
        let natural = convertEmotionToNatural(e);
        // 여러 감정을 연결할 때는 "~하"를 추가해야 함
        // "~하", "~나", "~워"로 끝나지 않으면 "~하" 추가
        // 단, noHaEmotions에 포함된 감정은 "하"를 추가하지 않음
        if (!natural.endsWith('하') && !natural.endsWith('나') && !natural.endsWith('워')) {
          if (!noHaEmotions.includes(natural)) {
            natural = natural + '하';
          }
        }
        return natural;
      }).join('고 ') // "화나고 당황하고 억울하고"
    : emotions.length > 0
    ? (() => {
        // 명사형 감정을 동사형으로 변환
        const natural = convertEmotionToNatural(emotions[0]);
        // 단독 사용 시에는 "하"를 추가하면 안 되는 감정은 제외
        if (!natural.endsWith('하') && !natural.endsWith('나') && !natural.endsWith('워')) {
          if (!noHaEmotions.includes(natural)) {
            return natural + '하';
          }
        }
        return natural;
      })()
    : '힘들';
  
  // 3. 욕구: 사용자가 선택한 욕구들을 자연스러운 문장으로 변환
  let needText = '';
  if (needs.length === 0) {
    needText = '존중받는 것';
  } else if (needs.length === 1) {
    // "존중받고 싶었어요" → "존중받는 것"
    // "예의를 지켜주길 바랐어요" → "예의를 지켜주는 것"
    needText = needs[0]
      .replace(/길 바랐어요$/, '는 것')
      .replace(/받고 싶었어요$/, '받는 것')
      .replace(/하고 싶었어요$/, '하는 것')
      .replace(/고 싶었어요$/, '는 것')
      .replace(/지켜주길 바랐어요$/, '지켜주는 것')
      .replace(/느끼고 싶었어요$/, '느끼는 것')
      .replace(/되고 싶었어요$/, '되는 것');
  } else if (needs.length === 2) {
    const first = needs[0]
      .replace(/길 바랐어요$/, '는 것')
      .replace(/받고 싶었어요$/, '받는 것')
      .replace(/하고 싶었어요$/, '하는 것')
      .replace(/고 싶었어요$/, '는 것')
      .replace(/지켜주길 바랐어요$/, '지켜주는 것')
      .replace(/느끼고 싶었어요$/, '느끼는 것')
      .replace(/되고 싶었어요$/, '되는 것');
    const second = needs[1]
      .replace(/길 바랐어요$/, '는 것')
      .replace(/받고 싶었어요$/, '받는 것')
      .replace(/하고 싶었어요$/, '하는 것')
      .replace(/고 싶었어요$/, '는 것')
      .replace(/지켜주길 바랐어요$/, '지켜주는 것')
      .replace(/느끼고 싶었어요$/, '느끼는 것')
      .replace(/되고 싶었어요$/, '되는 것');
    needText = `${first}과 ${second}`;
  } else {
    // 3개 이상
    const converted = needs.map(n => n
      .replace(/길 바랐어요$/, '는 것')
      .replace(/받고 싶었어요$/, '받는 것')
      .replace(/하고 싶었어요$/, '하는 것')
      .replace(/고 싶었어요$/, '는 것')
      .replace(/지켜주길 바랐어요$/, '지켜주는 것')
      .replace(/느끼고 싶었어요$/, '느끼는 것')
      .replace(/되고 싶었어요$/, '되는 것'));
    const last = converted[converted.length - 1];
    const rest = converted.slice(0, -1).join(', ');
    needText = `${rest}, 그리고 ${last}`;
  }
  
  // 욕구 텍스트 (표시용) - 여러 욕구를 "~고"로 연결
  let needTextDisplay = '';
  if (needs.length === 0) {
    needTextDisplay = '존중받고 싶었어요';
  } else if (needs.length === 1) {
    needTextDisplay = needs[0];
  } else {
      // 여러 욕구를 "~고"로 연결 (예: "존중받고 싶고 배려받고 싶어요")
      // "싶었고" → "싶고", "싶었어요" → "싶어요"로 자연스럽게 변환
      const convertedNeeds = needs.map((need, index) => {
        // 마지막 욕구는 "~싶어요" 형태로 변환
        if (index === needs.length - 1) {
          return need
            .replace(/받고 싶었어요$/, '받고 싶어요')
            .replace(/하고 싶었어요$/, '하고 싶어요')
            .replace(/고 싶었어요$/, '고 싶어요')
            .replace(/길 바랐어요$/, '길 바래요');
        }
        
        // 앞부분 욕구는 "~고"로 연결
        // "~길 바랐어요" → "~길 바랬고"
        if (need.endsWith('길 바랐어요')) {
          return need.replace(/길 바랐어요$/, '길 바랬고');
        }
        // "~받고 싶었어요" → "~받고 싶고"
        if (need.endsWith('받고 싶었어요')) {
          return need.replace(/받고 싶었어요$/, '받고 싶고');
        }
        // "~하고 싶었어요" → "~하고 싶고"
        if (need.endsWith('하고 싶었어요')) {
          return need.replace(/하고 싶었어요$/, '하고 싶고');
        }
        // "~고 싶었어요" → "~고 싶고"
        if (need.endsWith('고 싶었어요')) {
          return need.replace(/고 싶었어요$/, '고 싶고');
        }
        return need;
      });
      
      needTextDisplay = convertedNeeds.join(' ');
  }
  
  // 4. 부탁: 상황과 욕구 기반 자동 생성
  const request = await generateRequestFromContext(needs, situation, apiKey);
  
  // 5. 완성된 메시지 (올바른 문법으로 조합)
  // 상황이 비어있으면 에러 로그와 함께 기본값 반환
  if (!situation || situation.trim() === '' || situation === '상황 정보 없음') {
    console.error('ERROR: situation is empty in generateNVCData!', { 
      conversationData, 
      needs,
      situation,
      emotions 
    });
    return {
      observation: '상황 정보 없음',
      emotions: emotionText || '감정 정보 없음',
      needs: needTextDisplay || '욕구 정보 없음',
      request: request || '부탁 정보 없음',
      fullMessage: '상황 정보가 부족합니다. 다시 시작해주세요.'
    };
  }
  
  // 완성된 메시지 생성 (자연스러운 문장, 순서: 상황 - 감정 - 욕구 - 부탁)
  // 1. 상황을 자연스럽게 포함 (반드시 포함되어야 함)
  let situationText = situation.trim();
  
  // 상황이 이미 자연스러운 문장이면 그대로 사용
  // "~했어요" → "~했을 때" 또는 "~해서"로 자연스럽게 변환
  if (situationText.endsWith('했어요') || situationText.endsWith('했어')) {
    // "~했어요"를 "~했을 때"로 변환 (예: "소리를 질렀을 때")
    situationText = situationText.replace(/했어요?$/, '했을 때');
  } else if (situationText.endsWith('요')) {
    // "~요"를 제거하고 "~했을 때" 추가
    situationText = situationText.replace(/요$/, '') + '했을 때';
  } else if (!situationText.includes('때') && !situationText.includes('서')) {
    // "때"나 "서"가 없으면 "했을 때" 추가
    situationText = situationText + '했을 때';
  }
  
  // 2. 감정을 자연스럽게 표현 (명사형 제거, 동사형으로 변환)
  // emotionNatural은 이미 "당황하고 속상하고..." 형태로 변환되어 있음
  // 하지만 혹시 모르니 다시 확인
  let emotionFinal = emotionNatural;
  if (!emotionFinal || emotionFinal === '힘든' || emotionFinal === '힘들') {
    // 감정이 없으면 기본값
    emotionFinal = '힘들';
  }
  
  // "힘든하" → "힘들" 수정
  emotionFinal = emotionFinal.replace(/힘든하/g, '힘들');
  emotionFinal = emotionFinal.replace(/힘들하/g, '힘들');
  
  // "분고" → "분하고"로 수정 (고가 빠진 경우)
  emotionFinal = emotionFinal.replace(/분고/g, '분하고');
  // "억울고" → "억울하고"로 수정 (고가 빠진 경우)
  emotionFinal = emotionFinal.replace(/억울고/g, '억울하고');
  // "억울하" → "억울"로 수정 (여러 감정 연결 시 "억울하"가 잘못 생성되는 경우)
  emotionFinal = emotionFinal.replace(/억울하고/g, '억울하고'); // 먼저 "억울하고"로 수정
  emotionFinal = emotionFinal.replace(/억울하/g, '억울'); // 그 다음 "억울하" → "억울"
  // "답답고" → "답답하고"로 수정 (고가 빠진 경우)
  emotionFinal = emotionFinal.replace(/답답고/g, '답답하고');
  // "당황고" → "당황하고"로 수정 (고가 빠진 경우)
  emotionFinal = emotionFinal.replace(/당황고/g, '당황하고');
  // "당황하" → "당황"으로 수정 (여러 감정 연결 시 "당황하"가 잘못 생성되는 경우)
  emotionFinal = emotionFinal.replace(/당황하하고/g, '당황하고');
  // "분하" → "분"으로 수정 (예: "분하했어요" → "분했어요") - 단독 사용 시에만
  // 하지만 여러 감정 연결 시에는 "분하고"가 맞으므로 이건 제거
  
  // 3. 욕구를 자연스럽게 표현 (선택한 욕구를 그대로 반영)
  // "~하고 싶어요" 형태로 자연스럽게 표현
  let needTextNatural = '';
  if (needs.length === 1) {
    const need = needs[0];
    if (need.includes('안전')) {
      needTextNatural = '제 주변 환경이 안전했으면 좋겠어요';
    } else if (need.includes('편안')) {
      needTextNatural = '제 주변 환경이 편안했으면 좋겠어요';
    } else if (need.includes('존중') && need.includes('배려')) {
      needTextNatural = '저는 존중받고 배려받고 싶어요';
    } else if (need.includes('존중') && need.includes('이해')) {
      if (need.includes('의견')) {
        needTextNatural = '제 의견이 존중받고 이해받고 싶어요';
      } else {
        needTextNatural = '저는 존중받고 이해받고 싶어요';
      }
    } else if (need.includes('존중') && !need.includes('예의') && !need.includes('의견')) {
      needTextNatural = '저는 존중받고 싶어요';
    } else if (need.includes('이해')) {
      needTextNatural = '저는 이해받고 싶어요';
    } else if (need.includes('배려')) {
      needTextNatural = '저는 배려받고 싶어요';
    } else if (need.includes('예의')) {
      needTextNatural = '저는 예의를 지켜주고 싶어요';
    } else if (need.includes('의견')) {
      needTextNatural = '제 의견이 존중받고 이해받고 싶어요';
    } else {
      // 선택한 욕구를 "~하고 싶어요" 형태로 변환
      const needBase = need
        .replace(/받고 싶었어요$/, '받고')
        .replace(/하고 싶었어요$/, '하고')
        .replace(/고 싶었어요$/, '고')
        .replace(/길 바랐어요$/, '고');
      needTextNatural = `저는 ${needBase} 싶어요`;
    }
  } else if (needs.length === 2) {
    // 두 개의 욕구를 자연스럽게 결합
    const need1 = needs[0];
    const need2 = needs[1];
    if ((need1.includes('존중') || need2.includes('존중')) && (need1.includes('배려') || need2.includes('배려'))) {
      needTextNatural = '저는 존중받고 배려받고 싶어요';
    } else if ((need1.includes('존중') || need2.includes('존중')) && (need1.includes('이해') || need2.includes('이해'))) {
      if (need1.includes('의견') || need2.includes('의견')) {
        needTextNatural = '제 의견이 존중받고 이해받고 싶어요';
      } else {
        needTextNatural = '저는 존중받고 이해받고 싶어요';
      }
    } else {
      // 두 욕구를 "~하고 ~하고 싶어요" 형태로 결합
      const need1Base = need1
        .replace(/받고 싶었어요$/, '받고')
        .replace(/하고 싶었어요$/, '하고')
        .replace(/고 싶었어요$/, '고')
        .replace(/길 바랐어요$/, '고');
      const need2Base = need2
        .replace(/받고 싶었어요$/, '받고')
        .replace(/하고 싶었어요$/, '하고')
        .replace(/고 싶었어요$/, '고')
        .replace(/길 바랐어요$/, '고');
      needTextNatural = `저는 ${need1Base} ${need2Base} 싶어요`;
    }
  } else {
    // 여러 욕구를 자연스럽게 표현
    if (needs.some(n => n.includes('안전') || n.includes('편안'))) {
      const safeNeed = needs.find(n => n.includes('안전') || n.includes('편안'));
      if (safeNeed?.includes('안전')) {
        needTextNatural = '제 주변 환경이 안전했으면 좋겠어요';
      } else {
        needTextNatural = '제 주변 환경이 편안했으면 좋겠어요';
      }
    } else {
      // 여러 욕구를 "~하고 ~하고 ~하고 싶어요" 형태로 결합
      const needsBase = needs.map(n => n
        .replace(/받고 싶었어요$/, '받고')
        .replace(/하고 싶었어요$/, '하고')
        .replace(/고 싶었어요$/, '고')
        .replace(/길 바랐어요$/, '고')
      ).join(' ');
      needTextNatural = `저는 ${needsBase} 싶어요`;
    }
  }
  
  // 4. 완성된 메시지 생성 (OpenAI API로 자연스러운 한국어 메시지 생성)
  try {
    const openai = new OpenAI({ apiKey });
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `당신은 비폭력 대화(NVC) 전문가입니다. 사용자의 상황, 감정, 욕구, 부탁을 자연스러운 한국어로 하나의 완성된 메시지로 작성해주세요.

**절대 규칙:**
1. 반드시 다음 순서로 작성: 상황 - 감정 - 욕구 - 부탁 (4개 요소 모두 필수)
2. 상황은 반드시 포함되어야 합니다. 상황 없이 시작하지 마세요.
3. 욕구는 한 번만 표현하세요. 중복하지 마세요.
4. 한국어로 자연스럽고 읽기 쉽게 작성
5. 어색한 표현이나 중복된 단어 사용 금지
6. 문법적으로 완벽한 문장으로 작성
7. 각 문장은 줄바꿈(\n)으로 구분

**감정 표현 규칙 (매우 중요):**
- 감정은 동사형으로 변환하여 "~했어요" 형태로 표현
- "분함" → "분했어요" ✅ (올바름)
- "분하했어요" ❌ (절대 안 됨 - "분"에 "하"를 추가하지 않음)
- "억울함" → "억울했어요" ✅
- "억울하했어요" ❌ (절대 안 됨 - "억울"에 "하"를 추가하지 않음)
- "당황함" → "당황했어요" ✅ (당황은 "당황하"로 변환 후 "했어요" 붙임)
- "당황하했어요" ✅ (올바름 - "당황하" + "했어요")
- "부끄러움" → "부끄러웠어요" ✅
- 여러 감정은 "~고 ~고 ~했어요" 형태로 연결 (예: "당황하고 속상하고 분했어요")
- "짜증나고 당황하했어요" ✅ (올바름)
- "짜증나고 당황하했어요" ✅ (올바름 - "당황하"는 "하" 포함)

**욕구 표현 규칙 (매우 중요):**
- "저는 존중받고 배려받는 것이 중요했어요" ❌ (어색함)
- "저는 존중받고 배려받고 싶어요" ✅ (자연스러움)
- "제 시간을 존중받고 싶어요, 배려받고 싶어요" ❌ (절대 안 됨 - 쉼표 사용 금지)
- "제 시간을 존중받고 싶고 배려받고 싶어요" ✅ (자연스러움 - "~고"로 연결)
- "친구의 솔직한 속마음을 듣고 싶어요, 우리 관계에 대한 확신을 갖고 싶어요" ❌ (절대 안 됨 - 쉼표 사용)
- "친구의 솔직한 속마음을 듣고 싶고, 우리 관계에 대한 확신을 갖고 싶어요" ✅ (자연스러움 - "~고"로 연결)
- "제 주변 환경이 안전했으면 좋겠어요" ✅
- "저는 이해받고 싶어요" ✅
- "중요했어요"로 끝나지 않아도 됨. 다양한 자연스러운 표현 사용 가능
- 여러 욕구를 나열할 때는 반드시 "~고"로 연결 (예: "존중받고 싶고 배려받고 싶어요")
- "~싶었고" → "~싶고"로 자연스럽게 변환 (예: "존중받고 싶었고 배려받고 싶었어요" ❌ → "존중받고 싶고 배려받고 싶어요" ✅)
- 욕구는 절대 중복하지 마세요. 같은 욕구를 두 번 표현하지 마세요.

**부탁 표현 규칙 (매우 중요):**
- 이 메시지는 갈등의 상대방에게 직접 전달하는 말입니다.
- **사용자 입장에서 상대방에게 직접 부탁하는 형태로 작성하세요.**
- **부탁은 구체적이고 긍정적이며, 대안을 제시하는 것이 좋습니다.**
- "아저씨에게 평소 목소리로..." ❌ (간접적이고 어색함)
- "평소 목소리로 카드를 다시 찍어달라고 얘기해주세요" ✅ (직접적이고 자연스러움)
- "보고서 작성에 대한 지침을 분명하게 해주세요" ❌ (3인칭, 지시적, 사용자 입장 아님)
- "보고서 작성하다 잘 모르겠으면 바로 물어봐줄래?" ✅ (1인칭, 직접적, 사용자 입장, 질문형)
- "내 시간을 존중해주고 예의를 갖춰 약속을 지켜달라고 부탁할게요" ❌ (너무 길고 복잡)
- "다음에는 약속을 지키면 좋겠고, 혹시 지키기 어려우면 1시간 전에는 얘기해줄래?" ✅ (구체적이고 대안 제시)
- "너의 솔직한 속마음을 듣고 싶어, 우리 관계에 대한 확신을 갖고 싶어해줄래?" ❌ (욕구와 부탁 혼재)
- "다음에는 솔직하게 속마음을 나눠줄래?" ✅ (부탁만 표현)
- "~에게" 같은 간접 표현 제거
- 상대방에게 직접 말하는 것처럼 자연스럽게 작성
- 사용자가 상대방에게 직접 말하는 것처럼 작성 (1인칭 관점)
- 부탁은 "~해주세요", "~해줄래?", "~하면 좋겠어요" 형태로 자연스럽게 표현
- "~해줄래?" → "~해주세요"로 변환 (더 정중한 표현)

**형식 (반드시 이 순서로):**
[누가] [상황]했을 때, [감정]했어요.
[욕구 표현].
다음부터는 [부탁].

**관찰(상황) 규칙:**
- 반드시 "누가"를 포함해야 합니다.
- 예: "버스를 탔는데 기사 아저씨가 카드 똑바로 찍으라며 소리를 질렀을 때" ✅
- 예: "후임이 보고서를 제대로 작성하지 않았을 때" ✅
- 예: "친구가 약속 시간에 늦었을 때" ✅

**잘못된 예시 (절대 하지 마세요):**
- 상황 없이 시작: "저는 불안했고 혼란스러웠어요." ❌ (상황 빠짐)
- 욕구 중복: "친구의 솔직한 속마음을 듣고 싶고... 친구의 솔직한 의견을 듣고 싶고..." ❌ (욕구 두 번 반복)
- 부탁 이상: "너의 솔직한 속마음을 듣고 싶어, 우리 관계에 대한 확신을 갖고 싶어해줄래?" ❌ (욕구와 부탁 혼재)

**올바른 예시:**
버스를 탔는데 기사 아저씨가 카드 똑바로 찍으라며 소리를 질렀을 때, 당황하고 속상했어요.
저는 존중받고 싶어요.
다음부터는 카드를 제대로 찍어달라고 친절하게 요청해주세요.

친구가 약속 시간에 늦었을 때, 서운하고 답답했어요.
제 시간을 존중받고 싶고 배려받고 싶어요.
다음에는 약속을 지키면 좋겠고, 혹시 지키기 어려우면 1시간 전에는 얘기해줄래?

후임이 보고서를 제대로 작성하지 않았을 때, 답답하고 불안했어요.
저는 후임으로부터 책임감 있는 태도를 받고 싶었어요.
다음에는 보고서 작성하다 잘 모르겠으면 바로 물어봐줄래?

**잘못된 예시:**
버스를 탔는데 기사 아저씨가 카드 똑바로 찍으라며 소리를 질렀을 때, 당황하고 속상했어요.
저는 존중받는 것이 중요했어요. ❌
다음부터는 아저씨에게 평소 목소리로 카드를 똑바로 찍어달라고 얘기해주세요. ❌
다음부터는 카드를 찍어달라고 할. ❌ (끝에 "할"만 붙임)

약속 시간에 늦었을 때, 당황하고 억울하했어요. ❌ (억울하 → 억울)
제 시간을 존중받고 싶었고 배려받고 싶었어요. ❌ (싶었고 → 싶고)
내 시간을 존중해주고 예의를 갖춰 약속을 지켜달라고 부탁할게요. ❌ (너무 길고 복잡)`
        },
        {
          role: "user",
          content: `다음 정보를 바탕으로 자연스러운 한국어 메시지를 작성해주세요:
상황: ${situation} → 반드시 "누가"를 포함하여 작성 (예: "기사 아저씨가 카드 똑바로 찍으라며 소리를 질렀을 때")
감정: ${emotions.join(', ')} → 자연스러운 동사형으로 변환 (예: 당황하고 속상하고)
욕구: ${needs.join(', ')} → 자연스러운 표현으로 변환
- **욕구의 주체는 반드시 "나(저)"여야 합니다.**
- "후임이 ~하길 바랐어요" → "내가 후임으로부터 ~받고 싶었어요" 형태로 변환
- 예: "내가 후임으로부터 책임감 있는 태도를 받고 싶었어요", "내가 존중받고 싶어요", "내가 배려받고 싶어요"
부탁: ${request} → 자연스러운 표현으로 변환 (예: "카드를 제대로 찍어달라고 친절하게 요청해주세요")
- 부탁은 상대방에게 직접 말하는 것처럼 작성 (예: "~에게" 같은 간접 표현 제거)
- 부탁은 친절하고 구체적인 표현 사용 (예: "~해달라고 친절하게 요청해주세요")
- 끝에 의미 없는 "할" 붙이지 않기

**형식 (반드시 이 순서로):**
[누가] [상황]했을 때, [감정]했어요.
[욕구 표현] (주체는 반드시 "나").
다음부터는 [부탁].

위 정보를 바탕으로 자연스럽고 읽기 쉬운 한국어 메시지를 작성해주세요.`
        }
      ],
      temperature: 0.7,
      max_tokens: 300,
    });
    
    const generatedMessage = completion.choices[0].message?.content || "";
    
    if (generatedMessage && generatedMessage.trim().length > 0) {
      // 생성된 메시지가 있으면 사용
      let nvcMessage = generatedMessage.trim();
      
      // 후처리: 표현 오류 수정 (포괄적이고 강력한 수정)
      // 0. 상황이 빠진 경우 확인 및 수정
      const lines = nvcMessage.split('\n');
      const hasSituation = lines[0]?.includes('때') || lines[0]?.includes('서') || lines[0]?.includes('했을');
      if (!hasSituation && situation && situation.trim() !== '') {
        // 상황이 빠진 경우 맨 앞에 추가
        let situationText = situation.trim();
        if (!situationText.includes('때') && !situationText.includes('서')) {
          if (situationText.endsWith('요')) {
            situationText = situationText.replace(/요$/, '') + '했을 때';
          } else {
            situationText = situationText + '했을 때';
          }
        }
        // 감정 라인 찾기
        const emotionLineIndex = lines.findIndex(line => line.includes('했어요') || line.includes('웠어요') || line.includes('났어요'));
        if (emotionLineIndex >= 0) {
          lines[emotionLineIndex] = `${situationText}, ${lines[emotionLineIndex]}`;
        } else {
          // 감정 라인이 없으면 첫 줄에 추가
          lines.unshift(`${situationText},`);
        }
        nvcMessage = lines.join('\n');
      }
      
      // 1. 감정 표현 오류 수정 (포괄적)
      // "~하했어요" → "~했어요" (모든 감정에 대해)
      nvcMessage = nvcMessage.replace(/(분|억울|답답|서운|속상|불안|피곤|난처|무서|부끄러|두려|힘들)하했어요/g, '$1했어요');
      nvcMessage = nvcMessage.replace(/(분|억울|답답|서운|속상|불안|피곤|난처|무서|부끄러|두려|힘들)하하고/g, '$1하고');
      nvcMessage = nvcMessage.replace(/(분|억울|답답|서운|속상|불안|피곤|난처|무서|부끄러|두려|힘들)하했을/g, '$1했을');
      // "힘든하" → "힘들" 수정
      nvcMessage = nvcMessage.replace(/힘든하/g, '힘들');
      nvcMessage = nvcMessage.replace(/힘들하/g, '힘들');
      // "당황하" → "당황" (당황은 "하"를 받음)
      nvcMessage = nvcMessage.replace(/당황하하고/g, '당황하고');
      nvcMessage = nvcMessage.replace(/당황하했어요/g, '당황했어요');
      nvcMessage = nvcMessage.replace(/당황하했을/g, '당황했을');
      // "짜증나고 당황하했어요" → "짜증나고 당황했어요"
      nvcMessage = nvcMessage.replace(/짜증나고 당황하했어요/g, '짜증나고 당황했어요');
      // "~고 ~하했어요" 패턴 수정
      nvcMessage = nvcMessage.replace(/(\w+고) (\w+)하했어요/g, '$1 $2했어요');
      
      // 2. 욕구 표현 오류 수정 (포괄적)
      // "후임이 ~하길 바랐어요" → "내가 후임으로부터 ~받고 싶었어요" 형태로 변환
      nvcMessage = nvcMessage.replace(/후임이 ([^가-힣]+)하길 바랐어요/g, '내가 후임으로부터 $1받고 싶었어요');
      nvcMessage = nvcMessage.replace(/후임이 ([^가-힣]+)를 갖길 바랐어요/g, '내가 후임으로부터 $1받고 싶었어요');
      nvcMessage = nvcMessage.replace(/후임이 ([^가-힣]+)를 하길 바랐어요/g, '내가 후임으로부터 $1받고 싶었어요');
      // "팀원들이 ~하길 바랐어요" → "내가 팀원들과 ~하고 싶었어요"
      nvcMessage = nvcMessage.replace(/팀원들이 ([^가-힣]+)하길 바랐어요/g, '내가 팀원들과 $1하고 싶었어요');
      // 상대방을 주어로 사용한 욕구를 "나" 중심으로 변환
      nvcMessage = nvcMessage.replace(/([가-힣]+)이 ([^가-힣]+)하길 바랐어요/g, '내가 $1으로부터 $2받고 싶었어요');
      nvcMessage = nvcMessage.replace(/([가-힣]+)가 ([^가-힣]+)하길 바랐어요/g, '내가 $1으로부터 $2받고 싶었어요');
      // "내가" 중복 제거 (예: "내가 친절한 대우를 받고 싶고 내가 존중받고 싶어요" → "내가 친절한 대우를 받고 싶고 존중받고 싶어요")
      nvcMessage = nvcMessage.replace(/내가 ([^가-힣]+) 내가/g, '내가 $1');
      nvcMessage = nvcMessage.replace(/저는 ([^가-힣]+) 저는/g, '저는 $1');
      // 쉼표로 구분된 욕구를 "~고"로 연결 (모든 패턴)
      nvcMessage = nvcMessage.replace(/([^,\.\n]+싶어요), ([^,\.\n]+싶어요)/g, (match, p1, p2) => {
        const need1 = p1.replace(/싶어요$/, '싶고');
        return `${need1} ${p2}`;
      });
      // "저는 ~, ~." 패턴
      nvcMessage = nvcMessage.replace(/저는 ([^,\.\n]+), ([^,\.\n]+)\./g, (match, p1, p2) => {
        if (p1.includes('싶어요') && p2.includes('싶어요')) {
          const need1 = p1.replace(/싶어요$/, '싶고');
          return `저는 ${need1} ${p2}.`;
        }
        return match;
      });
      // "제 시간을 ~, ~." 패턴
      nvcMessage = nvcMessage.replace(/제 시간을 ([^,\.\n]+), ([^,\.\n]+)\./g, (match, p1, p2) => {
        if (p1.includes('싶어요') && p2.includes('싶어요')) {
          const need1 = p1.replace(/싶어요$/, '싶고');
          return `제 시간을 ${need1} ${p2}.`;
        }
        return match;
      });
      // "~싶었고" → "~싶고"
      nvcMessage = nvcMessage.replace(/싶었고/g, '싶고');
      
      // 3. 부탁 표현 오류 수정 (포괄적)
      // "~해줄" → "~해주세요" (모든 경우, 전역 치환)
      nvcMessage = nvcMessage.replace(/요청해줄/g, '요청해주세요');
      nvcMessage = nvcMessage.replace(/해달라고 얘기해줄/g, '해달라고 얘기해주세요');
      // "~해줄래?" → "~해주세요" (부탁 부분만)
      nvcMessage = nvcMessage.replace(/해줄래\?/g, '해주세요');
      nvcMessage = nvcMessage.replace(/해줄래요\?/g, '해주세요');
      // "~해줄" → "~해주세요" (문장 끝, 공백 뒤, 줄바꿈 뒤 등, 전역 치환)
      nvcMessage = nvcMessage.replace(/해줄(?=\s|$|\.|\n|,)/g, '해주세요');
      nvcMessage = nvcMessage.replace(/해줄$/g, '해주세요');
      nvcMessage = nvcMessage.replace(/해줄\s/g, '해주세요 ');
      nvcMessage = nvcMessage.replace(/해줄\./g, '해주세요.');
      nvcMessage = nvcMessage.replace(/해줄\n/g, '해주세요\n');
      nvcMessage = nvcMessage.replace(/해줄,/g, '해주세요,');
      // "~해줄래?"는 질문형이지만 부탁이므로 "~해주세요"로 변환
      nvcMessage = nvcMessage.replace(/해줄래요\?/g, '해주세요');
      // 4. 욕구 중복 제거 (같은 욕구가 두 번 나오는 경우)
      let linesForDedup = nvcMessage.split('\n');
      const needPattern = /(친구의|너의|서로에 대한|우리 관계에 대한|솔직한|속마음|의견|확신)/g;
      const needMatches = nvcMessage.match(needPattern);
      if (needMatches && needMatches.length > 2) {
        // 욕구가 중복된 것으로 보이면, 첫 번째 욕구만 유지
        const needLineIndex = linesForDedup.findIndex(line => line.includes('싶어요') || line.includes('싶고') || line.includes('바랐어요'));
        if (needLineIndex >= 0) {
          // 욕구 라인에서 중복 제거
          let needLine = linesForDedup[needLineIndex];
          // 같은 패턴이 두 번 나오면 하나만 남기기
          let firstMatch = true;
          needLine = needLine.replace(/(친구의 솔직한 [^,\.\n]+),?/g, (match) => {
            if (firstMatch) {
              firstMatch = false;
              return match; // 첫 번째는 유지
            }
            return ''; // 나머지는 제거
          });
          linesForDedup[needLineIndex] = needLine;
          nvcMessage = linesForDedup.join('\n');
        }
      }
      
      // 5. 최종 검증 및 수정
      // 모든 줄을 다시 확인하여 오류 수정
      linesForDedup = nvcMessage.split('\n');
      nvcMessage = linesForDedup.map(line => {
        // 각 줄에서 오류 수정
        // "~하했어요" → "~했어요"
        line = line.replace(/(분|억울|답답|서운|속상|불안|피곤|난처|무서|부끄러|두려)하했어요/g, '$1했어요');
        line = line.replace(/(분|억울|답답|서운|속상|불안|피곤|난처|무서|부끄러|두려)하하고/g, '$1하고');
        // "~해줄" → "~해주세요" (부탁 라인만)
        if (line.includes('다음부터는') || line.includes('다음에는')) {
          line = line.replace(/해줄래\?/g, '해주세요');
          line = line.replace(/해줄래요\?/g, '해주세요');
          line = line.replace(/해줄$/g, '해주세요');
          line = line.replace(/해줄\s/g, '해주세요 ');
        }
        return line;
      }).join('\n');
      
      return {
        observation: situation || '상황 정보 없음',
        emotions: emotionText || '감정 정보 없음',
        needs: needTextDisplay || '욕구 정보 없음',
        request: request || '부탁 정보 없음',
        fullMessage: nvcMessage
      };
    }
  } catch (error) {
    console.error('OpenAI API Error in generateNVCData message generation:', error);
  }
  
  // Fallback: 기존 로직 사용 (하지만 더 간단하게)
  // 상황 텍스트 정리
  let finalSituationText = situation.trim();
  if (finalSituationText.endsWith('했어요') || finalSituationText.endsWith('했어')) {
    finalSituationText = finalSituationText.replace(/했어요?$/, '했을 때');
  } else if (!finalSituationText.includes('때') && !finalSituationText.includes('서')) {
    if (finalSituationText.endsWith('요')) {
      finalSituationText = finalSituationText.replace(/요$/, '') + '했을 때';
    } else {
      finalSituationText = finalSituationText + '했을 때';
    }
  }
  
  // 부탁 텍스트 정리 (상대방에게 직접 말하는 것처럼)
  let finalRequest = request.trim();
  
  // "~에게" 같은 간접 표현 제거 (상대방에게 직접 말하는 것이므로)
  finalRequest = finalRequest.replace(/아저씨에게\s*/g, '');
  finalRequest = finalRequest.replace(/상대방에게\s*/g, '');
  finalRequest = finalRequest.replace(/저에게\s*/g, '');
  finalRequest = finalRequest.replace(/에게\s*/g, '');
  
  // 중복 제거
  finalRequest = finalRequest.replace(/할래요\?할 수 있을까요\?/g, '해주세요');
  finalRequest = finalRequest.replace(/해줄래요\?.*?할 수 있을까요\?/g, '해주세요');
  // "~할 수 있을까요?" → "~해주세요"
  if (finalRequest.endsWith('할 수 있을까요?')) {
    finalRequest = finalRequest.replace(/할 수 있을까요\?$/, '해주세요');
  }
    // "~요청해줄" → "~요청해주세요" (먼저 처리)
    finalRequest = finalRequest.replace(/요청해줄/g, '요청해주세요');
    // "~해달라고 얘기해줄" → "~해달라고 얘기해주세요"
    finalRequest = finalRequest.replace(/해달라고 얘기해줄/g, '해달라고 얘기해주세요');
    // "~해줄래요?" → 질문형은 유지, 나머지 "~해줄" → "~해주세요"
    if (!finalRequest.endsWith('해줄래요?')) {
      finalRequest = finalRequest.replace(/해줄$/g, '해주세요');
      finalRequest = finalRequest.replace(/해줄\s/g, '해주세요 ');
      finalRequest = finalRequest.replace(/해줄\./g, '해주세요.');
      finalRequest = finalRequest.replace(/해줄\n/g, '해주세요\n');
    }
    // 끝에 의미 없는 "할" 제거
    if (finalRequest.endsWith('할') && !finalRequest.endsWith('해줄') && !finalRequest.endsWith('해달라고 얘기해줄') && !finalRequest.endsWith('해줄래요?')) {
      finalRequest = finalRequest.replace(/할$/, '');
    }
    // "똑바로" → "다시"로 자연스럽게 변경 (카드 찍기 상황)
    if (finalRequest.includes('카드') && finalRequest.includes('찍') && finalRequest.includes('똑바로')) {
      finalRequest = finalRequest.replace(/똑바로/g, '다시');
    }
    // "~해주세요"가 없으면 추가 (단, 끝에 "할"만 있는 경우는 제외)
    if (!finalRequest.endsWith('해주세요') && !finalRequest.endsWith('해줄') && !finalRequest.endsWith('할')) {
      finalRequest = finalRequest + '해주세요';
    }
  
  // emotionFinal 후처리: "당황하", "억울하" 등 오류 수정
  emotionFinal = emotionFinal.replace(/당황하하고/g, '당황하고');
  emotionFinal = emotionFinal.replace(/당황하했어요/g, '당황했어요');
  emotionFinal = emotionFinal.replace(/억울하하고/g, '억울하고');
  emotionFinal = emotionFinal.replace(/억울하했어요/g, '억울했어요');
  
  const nvcMessage = `${finalSituationText}, ${emotionFinal}했어요.\n${needTextNatural}.\n다음부터는 ${finalRequest}`;
  
  return {
    observation: situation || '상황 정보 없음',
    emotions: emotionText || '감정 정보 없음',
    needs: needTextDisplay || '욕구 정보 없음',
    request: finalRequest || '부탁 정보 없음',
    fullMessage: nvcMessage
  };
}

// 상황에 맞는 감정 리스트 생성 함수 (OpenAI API 사용)
async function getEmotionsForSituation(situation: string, apiKey: string): Promise<string[]> {
  try {
    const openai = new OpenAI({ apiKey });
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `당신은 상황을 분석해서 적절한 감정 리스트를 제공하는 전문가입니다.
사용자가 경험한 상황을 분석해서, 그 상황에서 느낄 수 있는 감정 8개를 추천해주세요.
감정은 다음 형식으로만 제공하세요: ["감정1", "감정2", "감정3", ...]
가능한 감정: 화남, 서운함, 속상함, 불안함, 외로움, 무시당함, 답답함, 억울함, 짜증남, 실망스러움, 피곤함, 자존심상함, 분함, 배신감, 혼란스러움, 무서움, 부끄러움, 두려움, 당황함
상황에 가장 적합한 감정만 선택하세요.`
        },
        {
          role: "user",
          content: `다음 상황에서 느낄 수 있는 감정 8개를 추천해주세요:\n${situation}`
        }
      ],
      temperature: 0.7,
      max_tokens: 200,
    });
    
    const response = completion.choices[0].message?.content || "";
    // JSON 배열 파싱
    let emotions: string[] = [];
    try {
      const parsed = JSON.parse(response);
      if (Array.isArray(parsed)) {
        emotions = parsed;
      }
    } catch {
      // JSON이 아니면 쉼표로 구분된 리스트로 파싱
      emotions = response
        .replace(/[\[\]"]/g, '')
        .split(',')
        .map((e: string) => e.trim())
        .filter(e => e);
    }
    
    // 중복 제거
    const uniqueEmotions = Array.from(new Set(emotions));
    return uniqueEmotions.slice(0, 8); // 최대 8개
  } catch (error) {
    console.error('OpenAI API Error in getEmotionsForSituation:', error);
  }
  
  // Fallback: 기본 감정 리스트
  return ['화남', '서운함', '속상함', '불안함', '외로움', '답답함', '억울함', '실망스러움'];
}

// 상황 + 감정 기반 욕구 리스트 생성 (OpenAI API 사용)
async function getNeedsForContext(situation: string, emotion: string, apiKey: string): Promise<string[]> {
  // 감정 키워드 목록 (욕구와 구분하기 위해)
  const emotionKeywords = [
    '화남', '서운함', '속상함', '불안함', '외로움', '무시당함', '답답함', '억울함', 
    '짜증남', '실망스러움', '피곤함', '자존심상함', '분함', '배신감', '혼란스러움', 
    '무서움', '부끄러움', '두려움', '당황함', '난처함'
  ];
  
  try {
    const openai = new OpenAI({ apiKey });
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `당신은 상황과 감정을 분석해서 적절한 욕구 리스트를 제공하는 전문가입니다.
사용자가 경험한 상황과 선택한 감정을 분석해서, 그 상황에서 충족되지 않은 욕구 6개를 추천해주세요.

**절대 규칙 (매우 중요):**
1. 욕구는 다음 형식으로만 제공하세요: ["욕구1", "욕구2", "욕구3", ...]
2. **절대 감정을 욕구로 포함하지 마세요.** 감정(화남, 불안함, 서운함 등)은 욕구가 아닙니다.
3. **욕구의 주체는 반드시 "나(저)"여야 합니다.**
4. **절대 상대방을 주어로 사용하지 마세요.** "후임이 ~하길 바랐어요" 같은 표현은 비난이 됩니다.
5. **욕구는 "내가 ~받고 싶었어요", "내가 ~하고 싶었어요" 형태로만 표현하세요.**

**올바른 욕구 표현 (주체가 "나"):**
- "내가 후임으로부터 책임감 있는 태도를 받고 싶었어요" ✅
- "내가 후임으로부터 정확한 업무 수행을 받고 싶었어요" ✅
- "내가 팀원들과의 협력을 하고 싶었어요" ✅
- "내가 정확한 지시를 받고 싶었어요" ✅
- "내가 전문적으로 대우받고 싶었어요" ✅
- "내가 존중받고 싶었어요" ✅
- "내가 이해받고 싶었어요" ✅
- "내가 배려받고 싶었어요" ✅
- "내가 소통하고 싶었어요" ✅

**잘못된 욕구 표현 (절대 사용 금지):**
- "후임이 제대로 일하길 바랐어요" ❌ (상대방을 주어로 사용, 비난)
- "후임이 책임감을 갖길 바랐어요" ❌ (상대방을 주어로 사용, 비난)
- "후임이 정확하게 일하길 바랐어요" ❌ (상대방을 주어로 사용, 비난)
- "팀원들이 협력하길 바랐어요" ❌ (상대방을 주어로 사용)

**상황별 올바른 욕구 예시:**
- 선임/상사 입장: "내가 후임으로부터 책임감 있는 태도를 받고 싶었어요", "내가 후임으로부터 정확한 업무 수행을 받고 싶었어요", "내가 팀원들과의 협력을 하고 싶었어요", "내가 팀의 효율적인 업무 환경을 받고 싶었어요"
- 후임/부하 입장: "내가 정확한 지시를 받고 싶었어요", "내가 전문적으로 대우받고 싶었어요", "내가 조언을 받고 싶었어요", "내가 자신감을 갖고 싶었어요", "내가 능력을 인정받고 싶었어요"
- 동등한 관계: "내가 존중받고 싶었어요", "내가 이해받고 싶었어요", "내가 배려받고 싶었어요", "내가 소통하고 싶었어요", "내가 예의를 받고 싶었어요", "내 시간이 존중받고 싶었어요"

상황과 감정에 가장 적합한 욕구만 선택하세요. **반드시 주체가 "나(저)"인 형태로만 제공하세요.**`
        },
        {
          role: "user",
          content: `다음 상황과 감정에서 충족되지 않은 욕구 6개를 추천해주세요:\n상황: ${situation}\n감정: ${emotion}`
        }
      ],
      temperature: 0.7,
      max_tokens: 200,
    });
    
    const response = completion.choices[0].message?.content || "";
    // JSON 배열 파싱
    let needs: string[] = [];
    try {
      const parsed = JSON.parse(response);
      if (Array.isArray(parsed)) {
        needs = parsed.slice(0, 6);
      }
    } catch {
      // JSON이 아니면 쉼표로 구분된 리스트로 파싱
      needs = response
        .replace(/[\[\]"]/g, '')
        .split(',')
        .map((e: string) => e.trim())
        .filter(e => e)
        .slice(0, 6);
    }
    
    // 감정이 욕구로 포함된 경우 필터링
    const filteredNeeds = needs.filter(need => {
      // 감정 키워드가 포함되어 있으면 제외
      return !emotionKeywords.some(emotion => need.includes(emotion));
    });
    
    if (filteredNeeds.length > 0) {
      return filteredNeeds.slice(0, 6);
    }
  } catch (error) {
    console.error('OpenAI API Error in getNeedsForContext:', error);
  }
  
  // Fallback: 기본 욕구 리스트
  return [
    '존중받고 싶었어요',
    '이해받고 싶었어요',
    '배려받고 싶었어요',
    '소통하고 싶었어요',
    '안정감을 느끼고 싶었어요',
    '인정받고 싶었어요'
  ];
}

export async function POST(request: Request) {
  try {
    const { messages: rawMessages, stage } = (await request.json()) as {
      messages: any[];
      stage: Stage;
    };

    // 메시지 role 정규화: 'ai' -> 'assistant' (모든 경우 처리)
    const messages: IncomingMessage[] = rawMessages.map((m: any) => {
      let normalizedRole: 'assistant' | 'user';
      if (m.role === 'user') {
        normalizedRole = 'user';
      } else if (m.role === 'ai' || m.role === 'assistant') {
        normalizedRole = 'assistant';
      } else {
        // 알 수 없는 role은 기본값으로 'assistant'
        normalizedRole = 'assistant';
      }
      return {
        role: normalizedRole,
        content: m.content || ''
      };
    });

    // 환경 변수 확인
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === "your_api_key_here" || apiKey.trim() === "") {
      return Response.json(
        { 
          error: "API 키가 설정되지 않았어요. .env.local 파일에 OPENAI_API_KEY를 입력하고 서버를 재시작해주세요.",
        },
        { status: 500 }
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { error: "메시지가 필요해요." },
        { status: 400 }
      );
    }

    // 사용자의 마지막 메시지 추출
    const userMessages = messages.filter((m) => m.role === "user");
    const lastUserMessage = userMessages[userMessages.length - 1]?.content || "";
    const userMessageCount = userMessages.length;
    // 모든 사용자 메시지를 합쳐서 상황 분석
    const allUserMessages = userMessages.map((m) => m.content).join(" ");

    // Stage별 명확한 로직
    let stagePrompt = "";
    let nextStage: Stage = stage;
    let options: string[] = [];
    let useOpenAI = true;

    if (stage === "observation") {
      if (userMessageCount === 1) {
        // 첫 번째 입력 분석
        const isSpecific = isSpecificEnough(lastUserMessage);
        
        if (isSpecific) {
          // 충분히 구체적 → 감정 단계로
          const emotions = await getEmotionsForSituation(lastUserMessage, apiKey);
          
          nextStage = "feeling";
          options = emotions;
          useOpenAI = false; // 직접 응답 생성
          
          // 직접 응답 생성 (공감 + 감정 질문) - 전체 텍스트 사용
          const directResponse = `힘드셨겠어요.\n그때 어떤 기분이 드셨나요?`;
          
          // 2초 딜레이 (실제 AI처럼)
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          return Response.json({
            content: directResponse,
            nextStage: "feeling",
            options: emotions,
            multiSelect: true,
            nvcData: undefined,
          });
        } else {
          // 막연한 입력 → 구체화 질문
          stagePrompt = `사용자가 막연한 표현을 사용했습니다: "${lastUserMessage}"
"그 사람이 정확히 어떤 말을 했나요? 또는 어떤 행동을 했나요?" 라고 물어보세요.
구체적인 상황을 파악하기 위해 더 직접적인 질문을 하세요.`;
          nextStage = "observation";
          options = [];
          useOpenAI = true;
        }
        
      } else if (userMessageCount === 2) {
        // 두 번째 입력 분석
        const isSpecific = isSpecificEnough(lastUserMessage);
        
        if (isSpecific) {
          // 충분히 구체적 → 감정 단계로 (공감 추가!)
          const emotions = await getEmotionsForSituation(allUserMessages, apiKey);
          
          nextStage = "feeling";
          options = emotions;
          useOpenAI = false; // 직접 응답 생성
          
          // 직접 응답 생성 (공감 + 감정 질문) - 전체 텍스트 사용
          const directResponse = `힘드셨겠어요.\n그때 어떤 기분이 드셨나요?`;
          
          // 2초 딜레이 (실제 AI처럼)
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          return Response.json({
            content: directResponse,
            nextStage: "feeling",
            options: emotions,
            multiSelect: true,
            nvcData: undefined,
          });
        } else {
          // 여전히 불충분 → 구체화 질문 2단계 (더 직접적)
          stagePrompt = `사용자가 상황을 설명했지만 아직 구체적이지 않습니다.
"그렇군요. 그 사람이 구체적으로 어떤 말을 했나요? 또는 어떤 행동을 했나요?" 라고 물어보세요.
더 직접적이고 구체적인 질문을 하세요.`;
          nextStage = "observation";
          options = [];
          useOpenAI = true;
        }
        
      } else if (userMessageCount >= 3) {
        // 세 번째 입력 이후 → 충분하지 않아도 강제로 감정 단계로 이동
        const emotions = await getEmotionsForSituation(allUserMessages, apiKey);
        
        nextStage = "feeling";
        options = emotions;
        useOpenAI = false; // 직접 응답 생성
        
        // 직접 응답 생성 (공감 + 감정 질문) - 전체 텍스트 사용
        const directResponse = `힘드셨겠어요.\n그때 어떤 기분이 드셨나요?`;
        
        // 2초 딜레이 (실제 AI처럼)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return Response.json({
          content: directResponse,
          nextStage: "feeling",
          options: emotions,
          multiSelect: true,
          nvcData: undefined,
        });
      }
      
    } else if (stage === "feeling") {
      // 선택된 감정들 파싱
      let selectedEmotions: string[] = [];
      try {
        const parsed = JSON.parse(lastUserMessage);
        selectedEmotions = Array.isArray(parsed) ? parsed : [lastUserMessage];
      } catch {
        // JSON 파싱 실패 시 쉼표로 구분된 문자열 처리
        selectedEmotions = lastUserMessage.split(',').map((e: string) => e.trim()).filter((e: string) => e);
      }
      
      // 직접 입력인 경우 (JSON이나 쉼표로 구분되지 않은 경우)
      if (selectedEmotions.length === 0 || (selectedEmotions.length === 1 && !selectedEmotions[0].includes(','))) {
        selectedEmotions = [lastUserMessage.trim()];
      }
      
      // 감정들을 자연스러운 문장으로 변환
      const emotionText = convertEmotionsToSentence(selectedEmotions);
      
      // 상황 + 감정 기반 욕구 리스트 (즉시 업데이트)
      const needs = await getNeedsForContext(allUserMessages, selectedEmotions.join(','), apiKey);
      
      // 감정 표현 수정: "~셨군요" 대신 "~했어요" 또는 "~웠어요" 형태로
      // emotionText는 "서운하고 당황하고 실망스러워" 형태
      let emotionDisplay = emotionText;
      
      // 여러 감정이 연결된 경우 마지막 감정만 변환
      if (emotionDisplay.includes('고 ')) {
        const parts = emotionDisplay.split('고 ');
        const lastPart = parts[parts.length - 1];
        let convertedLast = lastPart;
        
        // 마지막 감정 변환
        if (lastPart.endsWith('하')) {
          convertedLast = lastPart.replace(/하$/, '했어요');
        } else if (lastPart.endsWith('워')) {
          convertedLast = lastPart.replace(/워$/, '웠어요');
        } else if (lastPart.endsWith('나')) {
          convertedLast = lastPart.replace(/나$/, '났어요');
        } else {
          convertedLast = lastPart + '했어요';
        }
        
        // 앞부분은 "~고" 유지, 마지막만 변환
        const rest = parts.slice(0, -1).map(p => `${p}고`).join(' ');
        emotionDisplay = `${rest} ${convertedLast}`;
      } else {
        // 단일 감정
        if (emotionDisplay.endsWith('하')) {
          emotionDisplay = emotionDisplay.replace(/하$/, '했어요');
        } else if (emotionDisplay.endsWith('워')) {
          emotionDisplay = emotionDisplay.replace(/워$/, '웠어요');
        } else if (emotionDisplay.endsWith('나')) {
          emotionDisplay = emotionDisplay.replace(/나$/, '났어요');
        } else {
          emotionDisplay = emotionDisplay + '했어요';
        }
      }
      
      stagePrompt = `사용자가 "${selectedEmotions.join(', ')}"라는 감정을 선택했습니다.
"${emotionDisplay}. 이런 감정이 든 이유가 뭘까요? 나에게 중요한 건 뭘까요?" 라고 물어보세요.
**중요**: 질문에 감정 단어를 포함하지 마세요. "혼란스러우셨을까요?" 같은 표현은 절대 사용하지 마세요.
감정을 자연스럽게 반영한 따뜻한 톤으로 응답하세요.`;
      nextStage = "need";
      options = needs; // 즉시 업데이트된 욕구 리스트
      useOpenAI = true;
      
    } else if (stage === "need") {
      // 선택된 욕구들 파싱
      let selectedNeeds: string[] = [];
      try {
        const parsed = JSON.parse(lastUserMessage);
        selectedNeeds = Array.isArray(parsed) ? parsed : [lastUserMessage];
      } catch {
        // JSON 파싱 실패 시 쉼표로 구분된 문자열 처리
        selectedNeeds = lastUserMessage.split(',').map((e: string) => e.trim()).filter((e: string) => e);
      }
      
      // selectedNeeds가 비어있으면 기본값 사용
      if (selectedNeeds.length === 0) {
        selectedNeeds = ['존중받고 싶었어요'];
      }
      
      // 전체 대화 내용에서 상황, 감정 추출
      const conversationData = extractConversationData(messages);
      const { specificSituation } = conversationData;
      
      // 욕구를 자연스러운 문장으로 변환 (중복 제거)
      const needsList = selectedNeeds.map(n => {
        // "일이 제대로 되길 바랐어요" → "일이 제대로 되는 것"
        // "효율적으로 일하고 싶었어요" → "효율적으로 일하는 것"
        // "존중받고 싶었어요" → "존중받는 것"
        let converted = n
          .replace(/길 바랐어요$/, '는 것')
          .replace(/받고 싶었어요$/, '받는 것')
          .replace(/하고 싶었어요$/, '하는 것')
          .replace(/고 싶었어요$/, '는 것');
        
        // "것" 중복 제거 (예: "존중받는 것" → "존중받는 것")
        return converted;
      });
      
      // 공감 메시지 생성 (자연스럽게)
      let empathyMessage = '';
      
      if (selectedNeeds.length === 1) {
        const need = needsList[0];
        empathyMessage = `${need}이 중요하셨군요.`;
      } else if (selectedNeeds.length === 2) {
        empathyMessage = `${needsList[0]}과 ${needsList[1]}이 중요하셨군요.`;
      } else {
        // 3개 이상
        const last = needsList[needsList.length - 1];
        const rest = needsList.slice(0, -1).join(', ');
        empathyMessage = `${rest}, 그리고 ${last}이 중요하셨군요.`;
      }
      
      // 최종 공감 메시지 (욕구 공감 + 다음 단계 안내만)
      const finalMessage = `${empathyMessage}\n\n다음에 이런 상황이 온다면 나의 마음과 나에게 중요한 것을 상대에게 얘기해주세요.\n함께 정리해볼까요?`;
      
      // Stage 4 (empathy)로 전환
      nextStage = "empathy";
      
      // 2초 딜레이 (실제 AI처럼)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return Response.json({
        content: finalMessage,
        nextStage: "empathy",
        options: ['좋아요', '괜찮아요'], // "좋아요", "괜찮아요" 버튼 추가
        multiSelect: false,
        showContinueButton: true, // "정리 시작하기" 버튼 표시
        conversationData: {
          ...conversationData,
          selectedNeeds,
        },
      });
      
    } else if (stage === "empathy") {
      // "정리 시작하기" 버튼 클릭 시 또는 사용자가 계속 진행
      // conversationData 추출
      const conversationData = extractConversationData(messages);
      
      // 디버깅: 상황 추출 확인
      console.log('DEBUG: extractConversationData result:', {
        specificSituation: conversationData.specificSituation,
        selectedEmotions: conversationData.selectedEmotions,
        allUserMessages: userMessages.map(m => m.content)
      });
      
      // 욕구 추출 (need 단계의 마지막 사용자 메시지에서)
      let selectedNeeds: string[] = [];
      
      // need 단계의 사용자 메시지 찾기 (feeling 이후, empathy 이전)
      const feelingIndex = userMessages.findIndex((m, idx) => {
        const content = m.content;
        try {
          const parsed = JSON.parse(content);
          return Array.isArray(parsed);
        } catch {
          return content.includes(',') && content.length < 100;
        }
      });
      
      if (feelingIndex >= 0 && feelingIndex < userMessages.length - 1) {
        // feeling 다음 메시지가 need 단계 메시지
        const needMessage = userMessages[feelingIndex + 1];
        try {
          const parsed = JSON.parse(needMessage.content);
          selectedNeeds = Array.isArray(parsed) ? parsed : [needMessage.content];
        } catch {
          selectedNeeds = needMessage.content.split(',').map(e => e.trim()).filter(e => e);
        }
      } else {
        // fallback: 마지막 사용자 메시지에서 시도
        const lastMsg = lastUserMessage;
        try {
          const parsed = JSON.parse(lastMsg);
          selectedNeeds = Array.isArray(parsed) ? parsed : [];
        } catch {
          selectedNeeds = lastMsg.split(',').map(e => e.trim()).filter(e => e);
        }
      }
      
      // selectedNeeds가 비어있으면 기본값 사용
      if (selectedNeeds.length === 0) {
        selectedNeeds = ['존중받고 싶었어요'];
      }
      
      // conversationData에 selectedNeeds 추가
      conversationData.selectedNeeds = selectedNeeds;
      
      // 상황이 비어있으면 모든 사용자 메시지에서 다시 추출 시도
      if (!conversationData.specificSituation || conversationData.specificSituation.trim() === '') {
        // observation 단계의 모든 메시지를 합쳐서 상황으로 사용
        const observationMsgs = userMessages
          .filter((m, idx) => {
            // feeling 이전의 메시지만
            const content = m.content;
            try {
              const parsed = JSON.parse(content);
              return !Array.isArray(parsed);
            } catch {
              return true;
            }
          })
          .map(m => m.content)
          .filter(msg => {
            const trimmed = msg.trim();
            return trimmed.length > 3 && !['네', '예', '맞아요', '맞아', '응', '어', '그래'].includes(trimmed);
          });
        
        if (observationMsgs.length > 0) {
          // 가장 긴 메시지 또는 마지막 메시지를 상황으로 사용
          conversationData.specificSituation = observationMsgs[observationMsgs.length - 1] || observationMsgs[0];
          console.log('DEBUG: 상황 재추출:', conversationData.specificSituation);
        }
      }
      
      // Before 메시지 생성
      const beforeMessage = generateBeforeMessage(conversationData);
      
      // 구조화된 NVC 데이터 생성
      const nvcData = await generateNVCData(conversationData, selectedNeeds, apiKey);
      
      // 디버깅: 최종 NVC 데이터 확인
      console.log('DEBUG: Final nvcData:', {
        observation: nvcData.observation,
        emotions: nvcData.emotions,
        needs: nvcData.needs,
        request: nvcData.request,
        fullMessage: nvcData.fullMessage
      });
      
      // Stage 5 (result)로 전환
      nextStage = "result";
      
      // 2초 딜레이 (실제 AI처럼)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return Response.json({
        content: "📝 이렇게 바뀌었어요",
        nextStage: "result",
        options: [],
        multiSelect: false,
        beforeMessage, // Before 메시지
        nvcData, // After 메시지 (NVC)
        advantages: [
          '상대방을 비난하지 않아요',
          '내 감정과 욕구를 명확히 전달해요',
          '구체적인 부탁으로 변화를 이끌어요',
        ],
      });
    }

    // OpenAI API 호출이 필요한 경우
    if (useOpenAI) {
      const openai = new OpenAI({
        apiKey: apiKey,
      });

      const systemMessage = `${SYSTEM_PROMPT}

현재 단계: ${stage}
${stagePrompt}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemMessage },
          ...messages.map((m) => ({ 
            role: m.role, // 이미 정규화됨
            content: m.content 
          })),
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const response = completion.choices[0].message?.content || "";

      if (!response) {
        return Response.json(
          { error: "응답을 받지 못했어요. 다시 시도해주세요." },
          { status: 500 }
        );
      }

      return Response.json({
        content: response,
        nextStage: nextStage,
        options: options,
        multiSelect: nextStage === "need" || nextStage === "feeling",
        nvcData: undefined, // Stage 3가 아닌 경우 undefined
      });
    } else {
      // 직접 응답 생성 (Stage 1 → Stage 2 전환 시)
      // stagePrompt에서 공감 표현과 질문을 추출
      const promptLines = stagePrompt.split('\n');
      const empathyLine = promptLines.find(line => line.includes('힘드셨겠어요') || line.includes('그랬군요'));
      const questionLine = promptLines.find(line => line.includes('어떤 기분'));
      
      // 공감 표현과 질문을 결합
      let directResponse = "";
      if (empathyLine && questionLine) {
        // stagePrompt에서 따옴표 안의 내용 추출
        const empathyMatch = empathyLine.match(/"([^"]+)"/);
        const questionMatch = questionLine.match(/"([^"]+)"/);
        if (empathyMatch && questionMatch) {
          directResponse = `${empathyMatch[1]}\n${questionMatch[1]}`;
        } else {
          // 매칭 실패 시 기본값 - 전체 텍스트 사용
          directResponse = `힘드셨겠어요.\n그때 어떤 기분이 드셨나요?`;
        }
      } else {
        // 기본 응답 - 전체 텍스트 사용
        directResponse = `힘드셨겠어요.\n그때 어떤 기분이 드셨나요?`;
      }
      
      // 2초 딜레이 (실제 AI처럼)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return Response.json({
        content: directResponse,
        nextStage: nextStage,
        options: options,
        multiSelect: true,
        nvcData: undefined,
      });
    }
  } catch (error) {
    console.error("API Error:", error);
    console.error("Error details:", {
      message: (error as any)?.message,
      stack: (error as any)?.stack,
      name: (error as any)?.name,
    });

    const err = error as { message?: string; status?: number };
    let errorMessage = "잠시 문제가 생겼어요. 다시 시도해주세요.";
    
    if (err?.message?.includes("quota") || err?.message?.includes("billing")) {
      errorMessage = "API 사용량 한도에 도달했어요. OpenAI 계정의 결제 정보와 사용량을 확인해주세요.";
    } else if (err?.message?.includes("API key")) {
      errorMessage = "API 키에 문제가 있어요. 확인해주세요.";
    } else if (err?.message?.includes("rate limit")) {
      errorMessage = "요청이 너무 많아요. 잠시 후 다시 시도해주세요.";
    } else if (err?.message?.includes("does not exist")) {
      errorMessage = "사용할 수 없는 모델이에요. 다른 모델로 변경이 필요해요.";
    } else if (err?.message) {
      errorMessage = `오류: ${err.message}`;
    }

    return Response.json({ 
      error: errorMessage,
      errorCode: err?.status || 500,
      errorDetails: process.env.NODE_ENV === 'development' ? String((error as any)?.message || 'Unknown error') : undefined,
    }, { status: 500 });
  }
}
