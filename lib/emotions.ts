export const emotionCategories = {
  uncomfortable: {
    label: "불편한 감정",
    emoji: "😔",
    subcategories: [
      {
        id: "anger",
        label: "분노/좌절",
        emoji: "😤",
        preview: "화남, 답답함, 짜증",
        emotions: [
          { label: "화남", emoji: "😠" },
          { label: "답답함", emoji: "😤" },
          { label: "짜증", emoji: "😡" },
          { label: "성남", emoji: "🤬" },
          { label: "분노", emoji: "😠" },
          { label: "좌절감", emoji: "😮‍💨" }
        ]
      },
      {
        id: "sadness",
        label: "슬픔/상실",
        emoji: "😔",
        preview: "슬픔, 외로움, 상실감",
        emotions: [
          { label: "슬픔", emoji: "😔" },
          { label: "서글픔", emoji: "😥" },
          { label: "울적함", emoji: "😔" },
          { label: "외로움", emoji: "😞" },
          { label: "상실감", emoji: "😞" }
        ]
      },
      {
        id: "anxiety",
        label: "불안/두려움",
        emoji: "😟",
        preview: "불안함, 걱정, 초조함",
        emotions: [
          { label: "불안함", emoji: "😟" },
          { label: "걱정", emoji: "😟" },
          { label: "초조함", emoji: "😵‍💫" },
          { label: "긴장됨", emoji: "😰" },
          { label: "무서움", emoji: "😨" }
        ]
      },
      {
        id: "dissatisfaction",
        label: "불만/거리감",
        emoji: "🙁",
        preview: "서운함, 실망, 억울함",
        emotions: [
          { label: "서운함", emoji: "🙁" },
          { label: "실망", emoji: "😞" },
          { label: "질투", emoji: "😒" },
          { label: "소외감", emoji: "😶" },
          { label: "억울함", emoji: "😶" }
        ]
      },
      {
        id: "fatigue",
        label: "피로/부담",
        emoji: "😫",
        preview: "피곤함, 지침, 무기력함",
        emotions: [
          { label: "피곤함", emoji: "😫" },
          { label: "지침", emoji: "😫" },
          { label: "부담감", emoji: "😮‍💨" },
          { label: "무기력함", emoji: "🫠" }
        ]
      }
    ]
  },
  pleasant: {
    label: "기분 좋은 감정",
    emoji: "😊",
    subcategories: [
      {
        id: "joy",
        label: "기쁨/만족",
        emoji: "😄",
        preview: "기쁨, 만족, 신남",
        emotions: [
          { label: "기쁨", emoji: "😄" },
          { label: "만족", emoji: "😊" },
          { label: "흥분", emoji: "🤗" },
          { label: "신남", emoji: "🥳" },
          { label: "행복함", emoji: "😊" },
          { label: "홀가분함", emoji: "😌" }
        ]
      },
      {
        id: "peace",
        label: "평온/안정",
        emoji: "😌",
        preview: "평온함, 안정감, 편안함",
        emotions: [
          { label: "평온함", emoji: "😌" },
          { label: "안정감", emoji: "🙂" },
          { label: "안심", emoji: "😮‍💨" },
          { label: "편안함", emoji: "😌" },
          { label: "고요함", emoji: "🙂" }
        ]
      },
      {
        id: "gratitude",
        label: "감사/친밀함",
        emoji: "🥰",
        preview: "감사함, 친밀감, 사랑",
        emotions: [
          { label: "감사함", emoji: "🥰" },
          { label: "고마움", emoji: "🥰" },
          { label: "친밀감", emoji: "🤗" },
          { label: "사랑", emoji: "❤️" },
          { label: "존경", emoji: "🫶" },
          { label: "신뢰", emoji: "🤝" }
        ]
      },
      {
        id: "vitality",
        label: "활력/자신감",
        emoji: "🤩",
        preview: "활력, 자신감, 설렘",
        emotions: [
          { label: "활력", emoji: "💪" },
          { label: "자신감", emoji: "😎" },
          { label: "설렘", emoji: "🥰" },
          { label: "흥미로움", emoji: "🤩" },
          { label: "충족감", emoji: "😌" }
        ]
      }
    ]
  }
};

export const needOptions = [
  { id: 'respect', label: '존중받고 싶었어요' },
  { id: 'listening', label: '내 말도 들어주길 바랐어요' },
  { id: 'understanding', label: '이해받고 싶었어요' },
  { id: 'consideration', label: '내 생각도 중요하게 다뤄지길 바랐어요' },
  { id: 'connection', label: '연결되고 싶었어요' },
  { id: 'recognition', label: '인정받고 싶었어요' },
  { id: 'safety', label: '안전하고 싶었어요' },
  { id: 'autonomy', label: '내 선택을 존중받고 싶었어요' },
  { id: 'custom', label: '다른 이유 (직접 입력)' }
];

