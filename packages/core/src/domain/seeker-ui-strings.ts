import type { LanguageCode } from "./language.js";

/**
 * The front door's own words, before a seeker has typed anything.
 *
 * The rest of Nexus solves "any language" by translating what someone
 * writes. This solves the step before that: someone who cannot read the
 * Latin alphabet at all has no way to know what "What can we call you?"
 * means, and so no way to write anything in the first place. A visitor
 * chooses their language here — see `LanguageProvider` — and these strings
 * swap in, client-side, on the page they have not yet interacted with.
 *
 * **Nothing about the conversation itself changes.** Choosing a language
 * here only relabels the form; it does not set `seekerLanguage`, does not
 * touch the session, and does not stop anyone writing their actual message
 * in a completely different language. That is still detected from the
 * message itself, exactly as before. This is a reading aid, not a setting.
 *
 * Same twenty languages as the crisis card, for the same reason the "You
 * belong." animation reuses that list: one deployment should not carry three
 * different opinions about which languages it speaks to.
 *
 * **These are a first draft, not vetted copy**, same as `BelongAnimation`'s
 * `PHRASES`. They are short and deliberately plain rather than idiomatic,
 * because a mistranslated form label blocks someone from using the product
 * at all, which is a worse failure than a stiff sentence. A native speaker
 * should still read these before they carry real traffic; English is the
 * fallback for anything not listed here, and for the fields it isn't.
 */
export interface SeekerUiStrings {
  /** The line under the animated heading. Always true, never conditional. */
  readonly tagline: string;
  readonly nameLabel: string;
  readonly namePlaceholder: string;
  readonly messageLabel: string;
  readonly messagePlaceholder: string;
  readonly startButton: string;
  readonly noAccountLine: string;
  /** The four states `coverageState()` can report. See `apps/web/src/app/page.tsx`. */
  readonly coverageOpen: string;
  readonly coverageBusy: string;
  readonly coverageClosed: string;
  /** Build-time prerender or a database miss — true in every failure mode. */
  readonly coverageUnknown: string;
  /** Shown when starting the conversation itself fails — a network drop, a dead API route. */
  readonly startError: string;
}

export const SEEKER_UI_STRINGS: Readonly<Record<string, SeekerUiStrings>> = {
  en: {
    tagline: "Come as you are. Talk with real Christians around the world.",
    nameLabel: "What can we call you?",
    namePlaceholder: "Any name you like",
    messageLabel: "What's on your mind?",
    messagePlaceholder: "Take your time.",
    startButton: "Start talking",
    noAccountLine: "No account. No email. Nothing to sign up for.",
    coverageOpen: "Someone is here now.",
    coverageBusy: "Everyone is with someone else right now, and you're next.",
    coverageClosed: "No one is on right now, but your message will be waiting.",
    coverageUnknown: "Write in any language — someone will read it.",
    startError: "Something went wrong. Please try again.",
  },
  es: {
    tagline: "Ven como eres. Habla con cristianos reales de todo el mundo.",
    nameLabel: "¿Cómo te llamamos?",
    namePlaceholder: "El nombre que quieras",
    messageLabel: "¿Qué tienes en mente?",
    messagePlaceholder: "Tómate tu tiempo.",
    startButton: "Empezar a hablar",
    noAccountLine: "Sin cuenta. Sin correo. Nada que registrar.",
    coverageOpen: "Alguien está aquí ahora.",
    coverageBusy: "Todos están con alguien más en este momento, y sigues tú.",
    coverageClosed: "Nadie está conectado ahora, pero tu mensaje quedará esperando.",
    coverageUnknown: "Escribe en cualquier idioma — alguien lo leerá.",
    startError: "Algo salió mal. Inténtalo de nuevo.",
  },
  pt: {
    tagline: "Venha como você é. Fale com cristãos de verdade ao redor do mundo.",
    nameLabel: "Como podemos te chamar?",
    namePlaceholder: "Qualquer nome que você quiser",
    messageLabel: "O que você tem em mente?",
    messagePlaceholder: "Sem pressa.",
    startButton: "Começar a conversar",
    noAccountLine: "Sem conta. Sem e-mail. Nada para se cadastrar.",
    coverageOpen: "Tem alguém aqui agora.",
    coverageBusy: "Todos estão com outra pessoa agora, e você é o próximo.",
    coverageClosed: "Ninguém está online agora, mas sua mensagem vai esperar.",
    coverageUnknown: "Escreva em qualquer idioma — alguém vai ler.",
    startError: "Algo deu errado. Tente novamente.",
  },
  fr: {
    tagline: "Viens comme tu es. Parle avec de vrais chrétiens du monde entier.",
    nameLabel: "Comment pouvons-nous t'appeler ?",
    namePlaceholder: "Le prénom que tu veux",
    messageLabel: "Qu'est-ce qui te préoccupe ?",
    messagePlaceholder: "Prends ton temps.",
    startButton: "Commencer à parler",
    noAccountLine: "Pas de compte. Pas d'e-mail. Rien à créer.",
    coverageOpen: "Quelqu'un est là maintenant.",
    coverageBusy:
      "Tout le monde est avec quelqu'un d'autre en ce moment, et c'est bientôt ton tour.",
    coverageClosed: "Personne n'est en ligne pour l'instant, mais ton message attendra.",
    coverageUnknown: "Écris dans n'importe quelle langue — quelqu'un le lira.",
    startError: "Une erreur s'est produite. Réessaie.",
  },
  de: {
    tagline: "Komm, wie du bist. Sprich mit echten Christen aus der ganzen Welt.",
    nameLabel: "Wie dürfen wir dich nennen?",
    namePlaceholder: "Ein beliebiger Name",
    messageLabel: "Was beschäftigt dich?",
    messagePlaceholder: "Lass dir Zeit.",
    startButton: "Gespräch beginnen",
    noAccountLine: "Kein Konto. Keine E-Mail. Nichts zum Anmelden.",
    coverageOpen: "Gerade ist jemand da.",
    coverageBusy:
      "Gerade ist jeder mit jemand anderem im Gespräch, du bist als Nächstes dran.",
    coverageClosed: "Gerade ist niemand online, aber deine Nachricht wartet.",
    coverageUnknown: "Schreib in jeder Sprache — jemand wird es lesen.",
    startError: "Etwas ist schiefgelaufen. Bitte versuch es noch einmal.",
  },
  it: {
    tagline: "Vieni come sei. Parla con veri cristiani da tutto il mondo.",
    nameLabel: "Come possiamo chiamarti?",
    namePlaceholder: "Il nome che preferisci",
    messageLabel: "Cosa hai in mente?",
    messagePlaceholder: "Prenditi il tuo tempo.",
    startButton: "Inizia a parlare",
    noAccountLine: "Nessun account. Nessuna email. Niente da registrare.",
    coverageOpen: "C'è qualcuno qui adesso.",
    coverageBusy:
      "In questo momento sono tutti impegnati con qualcun altro, e tocca a te tra poco.",
    coverageClosed: "Nessuno è online adesso, ma il tuo messaggio resterà in attesa.",
    coverageUnknown: "Scrivi in qualsiasi lingua — qualcuno lo leggerà.",
    startError: "Qualcosa è andato storto. Riprova.",
  },
  nl: {
    tagline: "Kom zoals je bent. Praat met echte christenen van over de hele wereld.",
    nameLabel: "Hoe mogen we je noemen?",
    namePlaceholder: "Een naam naar keuze",
    messageLabel: "Wat houdt je bezig?",
    messagePlaceholder: "Neem de tijd.",
    startButton: "Begin het gesprek",
    noAccountLine: "Geen account. Geen e-mail. Niets om aan te melden.",
    coverageOpen: "Er is nu iemand aanwezig.",
    coverageBusy:
      "Iedereen is nu met iemand anders in gesprek, jij bent zo aan de beurt.",
    coverageClosed: "Er is nu niemand online, maar je bericht blijft wachten.",
    coverageUnknown: "Schrijf in elke taal — iemand zal het lezen.",
    startError: "Er ging iets mis. Probeer het opnieuw.",
  },
  pl: {
    tagline:
      "Przyjdź taki, jaki jesteś. Porozmawiaj z prawdziwymi chrześcijanami z całego świata.",
    nameLabel: "Jak mamy się do ciebie zwracać?",
    namePlaceholder: "Dowolne imię",
    messageLabel: "Co masz na myśli?",
    messagePlaceholder: "Nie spiesz się.",
    startButton: "Zacznij rozmowę",
    noAccountLine: "Bez konta. Bez e-maila. Nic do rejestracji.",
    coverageOpen: "Ktoś jest tu teraz.",
    coverageBusy:
      "Wszyscy rozmawiają teraz z kimś innym, zaraz przyjdzie kolej na ciebie.",
    coverageClosed: "Nikt teraz nie jest dostępny, ale twoja wiadomość poczeka.",
    coverageUnknown: "Napisz w dowolnym języku — ktoś to przeczyta.",
    startError: "Coś poszło nie tak. Spróbuj ponownie.",
  },
  ru: {
    tagline:
      "Приходи таким, какой ты есть. Поговори с настоящими христианами со всего мира.",
    nameLabel: "Как нам к тебе обращаться?",
    namePlaceholder: "Любое имя на твой выбор",
    messageLabel: "Что у тебя на душе?",
    messagePlaceholder: "Не торопись.",
    startButton: "Начать разговор",
    noAccountLine: "Без аккаунта. Без почты. Нечего регистрировать.",
    coverageOpen: "Сейчас здесь кто-то есть.",
    coverageBusy: "Сейчас все заняты, но ты следующий.",
    coverageClosed: "Сейчас никого нет на связи, но твоё сообщение дождётся ответа.",
    coverageUnknown: "Пиши на любом языке — кто-нибудь это прочитает.",
    startError: "Что-то пошло не так. Попробуй ещё раз.",
  },
  uk: {
    tagline:
      "Прийди таким, яким ти є. Поговори зі справжніми християнами з усього світу.",
    nameLabel: "Як нам до тебе звертатися?",
    namePlaceholder: "Будь-яке ім'я на твій вибір",
    messageLabel: "Що в тебе на душі?",
    messagePlaceholder: "Не поспішай.",
    startButton: "Почати розмову",
    noAccountLine: "Без акаунта. Без пошти. Нічого реєструвати.",
    coverageOpen: "Зараз тут хтось є.",
    coverageBusy: "Зараз усі зайняті, але ти наступний.",
    coverageClosed:
      "Зараз нікого немає на зв'язку, але твоє повідомлення почекає на відповідь.",
    coverageUnknown: "Пиши будь-якою мовою — хтось це прочитає.",
    startError: "Щось пішло не так. Спробуй ще раз.",
  },
  ar: {
    tagline: "تعال كما أنت. تحدّث مع مسيحيين حقيقيين من مختلف أنحاء العالم.",
    nameLabel: "بماذا ننادونك؟",
    namePlaceholder: "أي اسم تريده",
    messageLabel: "ما الذي يشغل بالك؟",
    messagePlaceholder: "خذ وقتك.",
    startButton: "ابدأ الحديث",
    noAccountLine: "بلا حساب. بلا بريد إلكتروني. لا شيء للتسجيل.",
    coverageOpen: "هناك من هو متواجد الآن.",
    coverageBusy: "الجميع مشغولون مع شخص آخر الآن، ودورك قادم.",
    coverageClosed: "لا أحد متواجد الآن، لكن رسالتك ستبقى بانتظار الرد.",
    coverageUnknown: "اكتب بأي لغة — سيقرأها أحد.",
    startError: "حدث خطأ ما. حاول مرة أخرى.",
  },
  fa: {
    tagline: "همان‌طور که هستی بیا. با مسیحیان واقعی از سراسر جهان صحبت کن.",
    nameLabel: "چه چیزی صدایت کنیم؟",
    namePlaceholder: "هر نامی که دوست داری",
    messageLabel: "چه چیزی ذهنت را مشغول کرده؟",
    messagePlaceholder: "وقت بگذار.",
    startButton: "شروع گفتگو",
    noAccountLine: "بدون حساب کاربری. بدون ایمیل. چیزی برای ثبت‌نام نیست.",
    coverageOpen: "الان کسی اینجا هست.",
    coverageBusy: "الان همه با شخص دیگری صحبت می‌کنند، و نوبت تو بعدی است.",
    coverageClosed: "الان کسی آنلاین نیست، اما پیام تو منتظر می‌ماند.",
    coverageUnknown: "به هر زبانی بنویس — کسی آن را می‌خواند.",
    startError: "مشکلی پیش آمد. دوباره امتحان کن.",
  },
  zh: {
    tagline: "以真实的你前来。与来自世界各地的真实基督徒交流。",
    nameLabel: "我们该怎么称呼你？",
    namePlaceholder: "任何你喜欢的名字",
    messageLabel: "你在想什么？",
    messagePlaceholder: "慢慢来。",
    startButton: "开始交谈",
    noAccountLine: "无需账户。无需邮箱。无需注册。",
    coverageOpen: "现在有人在线。",
    coverageBusy: "现在大家都在和别人交谈，很快就轮到你了。",
    coverageClosed: "现在没有人在线，但你的留言会一直等着。",
    coverageUnknown: "用任何语言书写——都会有人读到。",
    startError: "出了点问题，请再试一次。",
  },
  ja: {
    tagline: "ありのままで来てください。世界中の本物のクリスチャンと話しましょう。",
    nameLabel: "何とお呼びすればいいですか？",
    namePlaceholder: "好きな名前でかまいません",
    messageLabel: "何が気になっていますか？",
    messagePlaceholder: "ゆっくりで大丈夫です。",
    startButton: "話を始める",
    noAccountLine: "アカウント不要。メール不要。登録するものはありません。",
    coverageOpen: "今、応対できる人がいます。",
    coverageBusy: "今はみんな他の方と話し中ですが、次はあなたの番です。",
    coverageClosed: "今はオンラインの人がいませんが、メッセージはそのまま届きます。",
    coverageUnknown: "どの言語で書いても、誰かが読みます。",
    startError: "問題が発生しました。もう一度お試しください。",
  },
  ko: {
    tagline: "있는 모습 그대로 오세요. 전 세계의 진짜 그리스도인과 이야기해보세요.",
    nameLabel: "뭐라고 부르면 될까요?",
    namePlaceholder: "원하는 이름 아무거나",
    messageLabel: "무슨 고민이 있으신가요?",
    messagePlaceholder: "천천히 하셔도 됩니다.",
    startButton: "대화 시작하기",
    noAccountLine: "계정 필요 없음. 이메일 필요 없음. 가입할 것도 없어요.",
    coverageOpen: "지금 응답할 수 있는 사람이 있어요.",
    coverageBusy: "지금은 모두 다른 분과 이야기 중이지만, 곧 당신 차례예요.",
    coverageClosed:
      "지금은 접속해 있는 사람이 없지만, 메시지는 그대로 기다리고 있을 거예요.",
    coverageUnknown: "어떤 언어로 써도 누군가 읽을 거예요.",
    startError: "문제가 발생했어요. 다시 시도해 주세요.",
  },
  hi: {
    tagline: "जैसे हो वैसे ही आओ। दुनिया भर के असली मसीहियों से बात करो।",
    nameLabel: "हम तुम्हें क्या कहकर बुलाएँ?",
    namePlaceholder: "कोई भी नाम जो तुम चाहो",
    messageLabel: "तुम्हारे मन में क्या है?",
    messagePlaceholder: "अपना समय लो।",
    startButton: "बात शुरू करें",
    noAccountLine: "कोई खाता नहीं। कोई ईमेल नहीं। कुछ भी दर्ज नहीं करना।",
    coverageOpen: "अभी कोई यहाँ मौजूद है।",
    coverageBusy: "अभी सब किसी और से बात कर रहे हैं, और अगली बारी तुम्हारी है।",
    coverageClosed: "अभी कोई ऑनलाइन नहीं है, पर तुम्हारा संदेश इंतज़ार करेगा।",
    coverageUnknown: "किसी भी भाषा में लिखो — कोई इसे पढ़ेगा।",
    startError: "कुछ गड़बड़ हो गई। फिर से कोशिश करो।",
  },
  id: {
    tagline:
      "Datanglah apa adanya. Bicaralah dengan orang Kristen sungguhan dari seluruh dunia.",
    nameLabel: "Kami memanggilmu siapa?",
    namePlaceholder: "Nama apa saja yang kamu suka",
    messageLabel: "Apa yang sedang kamu pikirkan?",
    messagePlaceholder: "Santai saja, tidak perlu buru-buru.",
    startButton: "Mulai bicara",
    noAccountLine: "Tanpa akun. Tanpa email. Tidak perlu daftar apa pun.",
    coverageOpen: "Sekarang ada orang yang siap membalas.",
    coverageBusy:
      "Semua orang sedang bicara dengan orang lain sekarang, dan giliranmu segera tiba.",
    coverageClosed: "Sekarang belum ada yang online, tapi pesanmu akan tetap menunggu.",
    coverageUnknown: "Tulis dalam bahasa apa pun — akan ada yang membacanya.",
    startError: "Terjadi kesalahan. Coba lagi.",
  },
  tr: {
    tagline:
      "Nasılsan öyle gel. Dünyanın dört bir yanından gerçek Hıristiyanlarla konuş.",
    nameLabel: "Sana nasıl hitap edelim?",
    namePlaceholder: "İstediğin herhangi bir isim",
    messageLabel: "Aklında ne var?",
    messagePlaceholder: "Acele etme.",
    startButton: "Konuşmaya başla",
    noAccountLine: "Hesap yok. E-posta yok. Kaydolacak hiçbir şey yok.",
    coverageOpen: "Şu anda burada biri var.",
    coverageBusy: "Şu anda herkes başka biriyle ilgileniyor, sıra az sonra sende.",
    coverageClosed: "Şu anda çevrimiçi kimse yok, ama mesajın orada bekleyecek.",
    coverageUnknown: "Hangi dilde yazarsan yaz — biri okuyacak.",
    startError: "Bir şeyler ters gitti. Tekrar dene.",
  },
  vi: {
    tagline:
      "Hãy đến như chính con người bạn. Trò chuyện với những Cơ Đốc nhân thật sự trên khắp thế giới.",
    nameLabel: "Chúng tôi nên gọi bạn là gì?",
    namePlaceholder: "Bất kỳ tên nào bạn thích",
    messageLabel: "Bạn đang nghĩ gì?",
    messagePlaceholder: "Cứ từ từ.",
    startButton: "Bắt đầu trò chuyện",
    noAccountLine: "Không cần tài khoản. Không cần email. Không có gì để đăng ký.",
    coverageOpen: "Hiện đang có người trực.",
    coverageBusy:
      "Hiện mọi người đều đang trò chuyện với người khác, sắp đến lượt bạn rồi.",
    coverageClosed:
      "Hiện chưa có ai trực tuyến, nhưng tin nhắn của bạn sẽ được chờ trả lời.",
    coverageUnknown: "Viết bằng bất kỳ ngôn ngữ nào — sẽ có người đọc.",
    startError: "Đã có lỗi xảy ra. Vui lòng thử lại.",
  },
  sw: {
    tagline: "Njoo jinsi ulivyo. Ongea na Wakristo halisi kutoka duniani kote.",
    nameLabel: "Tukuite nani?",
    namePlaceholder: "Jina lolote unalopenda",
    messageLabel: "Kuna nini akilini mwako?",
    messagePlaceholder: "Chukua muda wako.",
    startButton: "Anza mazungumzo",
    noAccountLine: "Hakuna akaunti. Hakuna barua pepe. Hakuna cha kujisajili.",
    coverageOpen: "Kuna mtu hapa sasa hivi.",
    coverageBusy: "Kila mtu yuko na mtu mwingine sasa hivi, na zamu yako inakaribia.",
    coverageClosed: "Hakuna aliye mtandaoni sasa hivi, lakini ujumbe wako utangoja.",
    coverageUnknown: "Andika kwa lugha yoyote — mtu ataisoma.",
    startError: "Hitilafu imetokea. Jaribu tena.",
  },
};

/** Ordered for the language switcher. English first, then the rest as above. */
export const SEEKER_UI_LANGUAGES: readonly LanguageCode[] =
  Object.keys(SEEKER_UI_STRINGS);

/** Always answers — English is the fallback for a language nobody has written yet. */
export function seekerUiStringsFor(language: LanguageCode): SeekerUiStrings {
  const primary = language.split("-")[0]?.toLowerCase() ?? "";
  return SEEKER_UI_STRINGS[primary] ?? SEEKER_UI_STRINGS.en!;
}
