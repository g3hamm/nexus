/**
 * The crisis card's own words.
 *
 * Hand-written per language rather than machine-translated at render time,
 * because this text has to appear instantly and correctly on the worst day
 * someone using Nexus will have. A translation call is one more thing that
 * can be slow, rate-limited, or down.
 *
 * Tone matters as much as accuracy here. Every one of these says the same
 * three things and no more: *you have not done anything wrong*, *you can
 * stay*, and *there are people who can help right now*. Nothing warns,
 * nothing scolds, and nothing suggests the conversation is being taken
 * away from them — because it is not.
 *
 * These are the strings a native speaker should review first. They are short,
 * they are read under distress, and English is the fallback for anything not
 * listed, which is a safe default rather than a good one.
 */
export interface CrisisStrings {
  readonly heading: string;
  readonly body: string;
  readonly emergencyLabel: string;
  readonly directoryLabel: string;
  readonly dismiss: string;
}

export const CRISIS_STRINGS: Readonly<Record<string, CrisisStrings>> = {
  en: {
    heading: "If you need help right now",
    body: "You can keep talking here. If you are in danger, or thinking about hurting yourself, please also reach someone who can help right away.",
    emergencyLabel: "Emergency services",
    directoryLabel: "Find a helpline where you are",
    dismiss: "Close",
  },
  es: {
    heading: "Si necesitas ayuda ahora mismo",
    body: "Puedes seguir hablando aquí. Si estás en peligro o piensas en hacerte daño, busca también a alguien que pueda ayudarte de inmediato.",
    emergencyLabel: "Servicios de emergencia",
    directoryLabel: "Encuentra una línea de ayuda donde estás",
    dismiss: "Cerrar",
  },
  pt: {
    heading: "Se você precisa de ajuda agora",
    body: "Você pode continuar conversando aqui. Se estiver em perigo ou pensando em se machucar, procure também alguém que possa ajudar imediatamente.",
    emergencyLabel: "Serviços de emergência",
    directoryLabel: "Encontre uma linha de apoio onde você está",
    dismiss: "Fechar",
  },
  fr: {
    heading: "Si vous avez besoin d'aide maintenant",
    body: "Vous pouvez continuer à parler ici. Si vous êtes en danger ou si vous pensez à vous faire du mal, contactez aussi quelqu'un qui peut vous aider immédiatement.",
    emergencyLabel: "Services d'urgence",
    directoryLabel: "Trouver une ligne d'écoute près de chez vous",
    dismiss: "Fermer",
  },
  de: {
    heading: "Wenn Sie jetzt Hilfe brauchen",
    body: "Sie können hier weiter sprechen. Wenn Sie in Gefahr sind oder daran denken, sich etwas anzutun, wenden Sie sich bitte auch an jemanden, der sofort helfen kann.",
    emergencyLabel: "Notruf",
    directoryLabel: "Eine Hilfe-Hotline in Ihrer Nähe finden",
    dismiss: "Schließen",
  },
  it: {
    heading: "Se hai bisogno di aiuto adesso",
    body: "Puoi continuare a parlare qui. Se sei in pericolo o stai pensando di farti del male, contatta anche qualcuno che può aiutarti subito.",
    emergencyLabel: "Servizi di emergenza",
    directoryLabel: "Trova una linea di ascolto dove ti trovi",
    dismiss: "Chiudi",
  },
  nl: {
    heading: "Als je nu hulp nodig hebt",
    body: "Je kunt hier gewoon verder praten. Als je in gevaar bent of eraan denkt jezelf iets aan te doen, neem dan ook contact op met iemand die meteen kan helpen.",
    emergencyLabel: "Alarmnummer",
    directoryLabel: "Zoek een hulplijn bij jou in de buurt",
    dismiss: "Sluiten",
  },
  pl: {
    heading: "Jeśli potrzebujesz pomocy teraz",
    body: "Możesz dalej tu rozmawiać. Jeśli jesteś w niebezpieczeństwie lub myślisz o zrobieniu sobie krzywdy, skontaktuj się także z kimś, kto może pomóc natychmiast.",
    emergencyLabel: "Numer alarmowy",
    directoryLabel: "Znajdź telefon zaufania w swoim kraju",
    dismiss: "Zamknij",
  },
  ru: {
    heading: "Если вам нужна помощь прямо сейчас",
    body: "Вы можете продолжать разговор здесь. Если вам угрожает опасность или вы думаете о том, чтобы причинить себе вред, пожалуйста, обратитесь также к тем, кто может помочь немедленно.",
    emergencyLabel: "Экстренные службы",
    directoryLabel: "Найти телефон доверия в вашей стране",
    dismiss: "Закрыть",
  },
  uk: {
    heading: "Якщо вам потрібна допомога зараз",
    body: "Ви можете продовжувати розмову тут. Якщо вам загрожує небезпека або ви думаєте про те, щоб завдати собі шкоди, будь ласка, зверніться також до тих, хто може допомогти негайно.",
    emergencyLabel: "Екстрені служби",
    directoryLabel: "Знайти лінію довіри у вашій країні",
    dismiss: "Закрити",
  },
  ar: {
    heading: "إذا كنت بحاجة إلى مساعدة الآن",
    body: "يمكنك متابعة الحديث هنا. وإذا كنت في خطر أو تفكر في إيذاء نفسك، فتواصل أيضًا مع من يستطيع مساعدتك فورًا.",
    emergencyLabel: "خدمات الطوارئ",
    directoryLabel: "ابحث عن خط مساعدة في بلدك",
    dismiss: "إغلاق",
  },
  fa: {
    heading: "اگر همین حالا به کمک نیاز دارید",
    body: "می‌توانید همین‌جا به گفت‌وگو ادامه دهید. اگر در خطر هستید یا به آسیب‌رساندن به خود فکر می‌کنید، لطفاً با کسی که می‌تواند فوراً کمک کند نیز تماس بگیرید.",
    emergencyLabel: "خدمات اورژانس",
    directoryLabel: "یافتن خط کمک در کشور شما",
    dismiss: "بستن",
  },
  zh: {
    heading: "如果你现在需要帮助",
    body: "你可以继续在这里聊。如果你正处于危险中，或者有伤害自己的念头，也请联系能够立即提供帮助的人。",
    emergencyLabel: "紧急服务",
    directoryLabel: "查找你所在地区的求助热线",
    dismiss: "关闭",
  },
  ja: {
    heading: "今すぐ助けが必要なとき",
    body: "ここでの会話は続けて大丈夫です。もし危険な状況にいる場合や、自分を傷つけたいと考えている場合は、すぐに助けてくれる人にも連絡してください。",
    emergencyLabel: "緊急通報",
    directoryLabel: "お住まいの地域の相談窓口を探す",
    dismiss: "閉じる",
  },
  ko: {
    heading: "지금 도움이 필요하다면",
    body: "여기서 계속 이야기하셔도 괜찮습니다. 위험한 상황에 있거나 자신을 해치고 싶은 생각이 든다면, 즉시 도와줄 수 있는 곳에도 연락해 주세요.",
    emergencyLabel: "긴급 전화",
    directoryLabel: "내가 있는 곳의 상담 전화 찾기",
    dismiss: "닫기",
  },
  hi: {
    heading: "अगर आपको अभी मदद चाहिए",
    body: "आप यहाँ बात करना जारी रख सकते हैं। अगर आप खतरे में हैं या खुद को नुकसान पहुँचाने के बारे में सोच रहे हैं, तो कृपया किसी ऐसे व्यक्ति से भी संपर्क करें जो तुरंत मदद कर सके।",
    emergencyLabel: "आपातकालीन सेवाएँ",
    directoryLabel: "अपने देश में हेल्पलाइन खोजें",
    dismiss: "बंद करें",
  },
  id: {
    heading: "Jika Anda butuh bantuan sekarang",
    body: "Anda boleh terus berbicara di sini. Jika Anda dalam bahaya atau berpikir untuk menyakiti diri sendiri, hubungi juga seseorang yang dapat menolong segera.",
    emergencyLabel: "Layanan darurat",
    directoryLabel: "Temukan layanan bantuan di tempat Anda",
    dismiss: "Tutup",
  },
  tr: {
    heading: "Şu anda yardıma ihtiyacınız varsa",
    body: "Burada konuşmaya devam edebilirsiniz. Tehlikedeyseniz ya da kendinize zarar vermeyi düşünüyorsanız, lütfen hemen yardım edebilecek birine de ulaşın.",
    emergencyLabel: "Acil servisler",
    directoryLabel: "Bulunduğunuz yerde bir yardım hattı bulun",
    dismiss: "Kapat",
  },
  vi: {
    heading: "Nếu bạn cần giúp đỡ ngay bây giờ",
    body: "Bạn có thể tiếp tục trò chuyện ở đây. Nếu bạn đang gặp nguy hiểm hoặc đang nghĩ đến việc làm hại bản thân, xin hãy liên hệ với người có thể giúp ngay lập tức.",
    emergencyLabel: "Dịch vụ khẩn cấp",
    directoryLabel: "Tìm đường dây trợ giúp nơi bạn ở",
    dismiss: "Đóng",
  },
  sw: {
    heading: "Kama unahitaji msaada sasa hivi",
    body: "Unaweza kuendelea kuzungumza hapa. Kama uko hatarini au unafikiria kujidhuru, tafadhali wasiliana pia na mtu anayeweza kusaidia mara moja.",
    emergencyLabel: "Huduma za dharura",
    directoryLabel: "Tafuta simu ya msaada mahali ulipo",
    dismiss: "Funga",
  },
};
