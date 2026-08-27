import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  X,
  MoreHorizontal,
  Plus,
  Send,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  RotateCcw,
  FileCheck,
  FileUp,
  SlidersHorizontal,
  MessageSquarePlus,
  Trash2,
  Loader2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import TextareaAutosize from "react-textarea-autosize";
import { ThinkingOrb } from "./ui/thinking-orbs";

interface FloatingChatbotProps {
  userName?: string;
  contextData?: any;
}

type Message = {
  id: string;
  role: "bot" | "user";
  content: React.ReactNode;
  feedback?: "sad" | "neutral" | "happy";
  feedbackText?: string;
  showFeedbackTextarea?: boolean;
  feedbackSubmitted?: boolean;
  attachedReportLabels?: string[];
};

// Persisted form of a Message: content is always plain text here (the only non-string
// content is the transient "initial" greeting, which is never saved).
type StoredMessage = {
  id: string;
  role: "bot" | "user";
  content: string;
  attachedReportLabels?: string[];
};

type ChatSession = {
  id: string;
  title: string;
  messages: StoredMessage[];
  updatedAt: number;
};

const CHAT_SESSIONS_STORAGE_KEY = "qodai_chat_sessions";
const PROMPT_COUNT_STORAGE_KEY = "qodai_prompt_count";
const MAX_USER_PROMPTS = 10;
const PROMPT_LIMIT_MESSAGE =
  "This is an early access. Thank you! You are one of the first members to contribute in this program. We are soon releasing our final product";

// Logged-in users get their prompt count and chat history synced to the backend
// (keyed by user id) so both stay consistent across every device they log into.
// Without a profile (e.g. not logged in), everything falls back to localStorage.
function getCurrentUserId(): string | null {
  try {
    const raw = localStorage.getItem("userProfile");
    if (!raw) return null;
    const profile = JSON.parse(raw);
    return profile?.id != null ? String(profile.id) : null;
  } catch (e) {
    return null;
  }
}

const CustomCodeBlock = ({
  node,
  inline,
  className,
  children,
  ...props
}: any) => {
  const match = /language-(\w+)/.exec(className || "");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(String(children).replace(/\n$/, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inline && match) {
    return (
      <div className="relative group mt-4 mb-2">
        <button
          onClick={handleCopy}
          className="absolute right-2 top-2 p-1.5 rounded-md bg-white border border-[#E8E8E5] text-[#8B8B86] hover:text-[#1A1A19] transition-colors z-10 shadow-sm opacity-0 group-hover:opacity-100"
          title="Copy code"
        >
          {copied ? (
            <Check size={14} className="text-green-600" />
          ) : (
            <Copy size={14} />
          )}
        </button>
        <code className={className} {...props}>
          {children}
        </code>
      </div>
    );
  }
  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
};

export default function FloatingChatbot({
  userName = "User",
  contextData,
}: FloatingChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [message, setMessage] = useState("");

  const displayName = userName?.trim() || "User";

  const getInitialMessage = (): Message => ({
    id: "initial",
    role: "bot",
    content: (
      <>
        <p className="mb-3">Hi {displayName}! 👋</p>
        <p className="mb-3">
          I'm your AI assistant. Ask me anything about your genomic profile,
          caffeine response, sleep, hair health or personalized
          recommendations.
        </p>
        <p className="mb-0">How can I help you today?</p>
      </>
    ),
  });

  const [messages, setMessages] = useState<Message[]>([getInitialMessage()]);

  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Early-access prompt cap: counts real user-initiated sends (not retries), persists across
  // sessions/reloads/new chats so it can't be bypassed by starting a fresh conversation.
  // Logged-in users get this from the backend (synced across devices); guests fall back
  // to a per-browser localStorage count.
  const [promptCount, setPromptCount] = useState<number>(() => {
    if (getCurrentUserId()) return 0;
    try {
      const raw = localStorage.getItem(PROMPT_COUNT_STORAGE_KEY);
      const parsed = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch (e) {
      return 0;
    }
  });
  const isPromptLimitReached = promptCount >= MAX_USER_PROMPTS;

  useEffect(() => {
    const userId = getCurrentUserId();
    if (!userId) return;
    fetch(`/api/chat/usage/${userId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.promptCount === "number") {
          setPromptCount(data.promptCount);
        }
      })
      .catch((e) => console.error("Failed to load chat usage", e));
  }, []);

  // App/Chat feedback states
  const [showAppFeedbackPrompt, setShowAppFeedbackPrompt] = useState(false);
  const [lastFeedbackPromptAt, setLastFeedbackPromptAt] = useState(0);
  const [selectedAppEmoji, setSelectedAppEmoji] = useState<string | null>(null);
  const [showAppTextarea, setShowAppTextarea] = useState(false);
  const [appFeedbackInput, setAppFeedbackInput] = useState('');
  const [submittingAppFeedback, setSubmittingAppFeedback] = useState(false);

  useEffect(() => {
    const botMsgCount = messages.filter(m => m.role === 'bot' && m.id !== 'initial').length;
    if (!isTyping && botMsgCount > 0 && botMsgCount % 3 === 0 && lastFeedbackPromptAt !== botMsgCount) {
      setShowAppFeedbackPrompt(true);
      setLastFeedbackPromptAt(botMsgCount);
    }
  }, [messages, isTyping, lastFeedbackPromptAt]);

  // The input area is absolutely positioned over the message body so the gradient/blur
  // effect can show through; its height changes (attached-report chips, multi-line text)
  // so the body's bottom padding must track it or the last message/suggestions get covered.
  const inputAreaRef = useRef<HTMLDivElement>(null);
  const [inputAreaHeight, setInputAreaHeight] = useState(0);

  useEffect(() => {
    const el = inputAreaRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setInputAreaHeight(entries[0].contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Full-screen mode covers the whole viewport, but the page underneath is still the
  // scroll container — without this, scrolling inside the chat also scrolls the dashboard.
  useEffect(() => {
    if (isOpen && isFullScreen) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
  }, [isOpen, isFullScreen]);

  // Chat history: conversations persist to localStorage so the "..." menu can list them
  // and let the user pick up an old thread or start a fresh one.
  const [showHistoryMenu, setShowHistoryMenu] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const historyMenuRef = useRef<HTMLDivElement>(null);
  // null while the current conversation hasn't been saved yet (fresh chat, no messages sent).
  const sessionIdRef = useRef<string | null>(null);

  // Logged-in users load their chat history from the backend (synced across devices);
  // guests fall back to a per-browser localStorage list.
  useEffect(() => {
    const userId = getCurrentUserId();
    if (userId) {
      fetch(`/api/chat/sessions/${userId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.sessions) {
            setChatSessions(
              data.sessions.map((s: any) => ({
                id: s.id,
                title: s.title,
                messages: s.messages,
                updatedAt: new Date(s.updatedAt).getTime(),
              })),
            );
          }
        })
        .catch((e) => console.error("Failed to load chat history", e));
      return;
    }
    try {
      const raw = localStorage.getItem(CHAT_SESSIONS_STORAGE_KEY);
      if (raw) setChatSessions(JSON.parse(raw));
    } catch (e) {
      console.error("Failed to load chat history", e);
    }
  }, []);

  // Save the current conversation on every change, so switching to a new/other chat
  // never loses what was just said. The "initial" greeting alone doesn't count as content.
  useEffect(() => {
    const persistable = messages.filter(
      (m): m is Message & { content: string } =>
        m.id !== "initial" && typeof m.content === "string",
    );
    if (persistable.length === 0) return;

    if (!sessionIdRef.current) {
      sessionIdRef.current = Date.now().toString();
    }
    const sessionId = sessionIdRef.current;
    const firstUserMsg = persistable.find((m) => m.role === "user");
    const title = firstUserMsg ? firstUserMsg.content.slice(0, 60) : "New chat";
    const storedMessages: StoredMessage[] = persistable.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      attachedReportLabels: m.attachedReportLabels,
    }));

    setChatSessions((prev) => {
      const existingIdx = prev.findIndex((s) => s.id === sessionId);
      const updatedSession: ChatSession = {
        id: sessionId,
        title,
        messages: storedMessages,
        updatedAt: Date.now(),
      };
      const next =
        existingIdx >= 0
          ? prev.map((s, i) => (i === existingIdx ? updatedSession : s))
          : [updatedSession, ...prev];

      const userId = getCurrentUserId();
      if (userId) {
        fetch(`/api/chat/sessions/${userId}/${sessionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, messages: storedMessages }),
        }).catch((e) => console.error("Failed to save chat history", e));
      } else {
        try {
          localStorage.setItem(CHAT_SESSIONS_STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
          console.error("Failed to save chat history", e);
        }
      }
      return next;
    });
  }, [messages]);

  const startNewChat = () => {
    setMessages([getInitialMessage()]);
    setSelectedReports([]);
    sessionIdRef.current = null;
    setShowHistoryMenu(false);
  };

  const loadSession = (session: ChatSession) => {
    setMessages(
      session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        attachedReportLabels: m.attachedReportLabels,
      })),
    );
    setSelectedReports([]);
    sessionIdRef.current = session.id;
    setShowHistoryMenu(false);
  };

  // Deleting a session is two-step: clicking the trash icon only stages it for
  // confirmation; the actual removal happens in confirmDeleteSession.
  const [sessionPendingDelete, setSessionPendingDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const requestDeleteSession = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessionPendingDelete({ id: session.id, title: session.title || "New chat" });
  };

  const cancelDeleteSession = () => setSessionPendingDelete(null);

  const confirmDeleteSession = () => {
    if (!sessionPendingDelete) return;
    const { id } = sessionPendingDelete;
    const wasActiveSession = sessionIdRef.current === id;

    setChatSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      const userId = getCurrentUserId();
      if (userId) {
        fetch(`/api/chat/sessions/${userId}/${id}`, { method: "DELETE" }).catch((err) =>
          console.error("Failed to delete chat session", err),
        );
      } else {
        try {
          localStorage.setItem(CHAT_SESSIONS_STORAGE_KEY, JSON.stringify(next));
        } catch (err) {
          console.error("Failed to save chat history", err);
        }
      }
      return next;
    });

    setSessionPendingDelete(null);

    // Deleting the chat currently on screen must clear it immediately and drop
    // straight into a fresh chat, rather than leaving the stale messages visible.
    // The prompt cap (promptCount) is intentionally untouched here.
    if (wasActiveSession) {
      startNewChat();
    }
  };

  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [selectedReports, setSelectedReports] = useState<
    { key: string; label: string; ai_report: any }[]
  >([]);
  const plusMenuRef = useRef<HTMLDivElement>(null);

  // Reports available to attach: prefer the map of {geneName: {ai_report, ...}} passed in as
  // contextData (dashboard usage); fall back to the logged-in user's profile in localStorage.
  const getAvailableReports = (): { key: string; label: string; ai_report: any }[] => {
    try {
      let reportsMap: Record<string, any> | null = null;
      if (
        contextData &&
        typeof contextData === "object" &&
        !Array.isArray(contextData) &&
        !contextData.page_1 &&
        !contextData._meta
      ) {
        reportsMap = contextData;
      } else {
        const userProfileStr = localStorage.getItem("userProfile");
        if (userProfileStr) {
          const profile = JSON.parse(userProfileStr);
          if (profile.reports) reportsMap = profile.reports;
        }
      }
      if (!reportsMap) return [];
      return Object.entries(reportsMap)
        .filter(([, data]: [string, any]) => data && data.ai_report)
        .map(([key, data]: [string, any]) => ({
          key,
          label: key,
          ai_report: data.ai_report,
        }));
    } catch (e) {
      console.error("Error reading available reports", e);
      return [];
    }
  };

  // Every genomic topic the app currently offers, and the gene codes that identify it in
  // a user's `gene_type` enrollment string — lets us tell "opted in, report pending" apart
  // from "never opted into this test" instead of implying every topic is just processing.
  const TOPIC_GENE_MAP: { topic: string; keyword: string; genes: string[] }[] = [
    { topic: "Caffeine Response", keyword: "caffeine", genes: ["CYP1A2", "ADORA2A"] },
    { topic: "Muscle Power vs Endurance", keyword: "muscle", genes: ["ACTN3", "ACE"] },
    { topic: "Hair Thickness & Root Structure", keyword: "hair", genes: ["EDAR", "FGFR2"] },
  ];

  // Returns the gene codes the user is enrolled for, or null if `gene_type` isn't known
  // (e.g. profile not loaded yet) — callers should skip opt-in categorization in that case
  // rather than guessing.
  const getOptedGeneCodes = (): string[] | null => {
    try {
      const userProfileStr = localStorage.getItem("userProfile");
      if (!userProfileStr) return null;
      const profile = JSON.parse(userProfileStr);
      if (!profile.gene_type || typeof profile.gene_type !== "string") return null;
      return profile.gene_type
        .toUpperCase()
        .split(",")
        .map((g: string) => g.trim())
        .filter(Boolean);
    } catch (e) {
      return null;
    }
  };

  const toggleReportSelection = (report: {
    key: string;
    label: string;
    ai_report: any;
  }) => {
    setSelectedReports((prev) =>
      prev.some((r) => r.key === report.key)
        ? prev.filter((r) => r.key !== report.key)
        : [...prev, report],
    );
  };

  const [responseLength, setResponseLength] = useState<
    "short" | "medium" | "long"
  >("medium");
  const [isLengthMenuOpen, setIsLengthMenuOpen] = useState(false);
  const lengthMenuRef = useRef<HTMLDivElement>(null);

  // Lets the "Chat with Qodai Coach" buttons rendered inside a report iframe open this
  // widget without any prop drilling through the report viewer/dashboard tree.
  useEffect(() => {
    const handleOpenRequest = () => {
      setIsFullScreen(false);
      setIsOpen(true);
    };
    window.addEventListener('open-qodai-chat', handleOpenRequest);
    return () => window.removeEventListener('open-qodai-chat', handleOpenRequest);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        plusMenuRef.current &&
        !plusMenuRef.current.contains(event.target as Node)
      ) {
        setIsPlusMenuOpen(false);
      }
      if (
        lengthMenuRef.current &&
        !lengthMenuRef.current.contains(event.target as Node)
      ) {
        setIsLengthMenuOpen(false);
      }
      if (
        historyMenuRef.current &&
        !historyMenuRef.current.contains(event.target as Node)
      ) {
        setShowHistoryMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const suggestions = [
    "How does my caffeine gene affect me?",
    "Tips to improve my sleep",
    "Hair care recommendations",
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isTyping]);

  // When closing, also reset full screen mode after animation
  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => setIsFullScreen(false), 200);
  };

  const handleSend = async (
    text: string,
    customMessages?: Message[],
    isRetry = false,
  ) => {
    if (!text.trim()) return;
    if (isPromptLimitReached) return;

    // Decrement immediately so the UI doesn't sit on the stale count while the request
    // is in flight; the /api/chat response below then reconciles with the backend's
    // authoritative count for logged-in users.
    const userId = getCurrentUserId();
    if (!isRetry) {
      setPromptCount((prev) => {
        const next = prev + 1;
        if (!userId) {
          try {
            localStorage.setItem(PROMPT_COUNT_STORAGE_KEY, next.toString());
          } catch (e) {
            console.error("Failed to save prompt count", e);
          }
        }
        return next;
      });
    }

    // Snapshot the attached reports for this message, then clear the composer's
    // selection so it doesn't silently carry over to the next, unrelated message.
    const reportsForThisMessage = selectedReports;
    setSelectedReports([]);

    // Add user message
    const userMsgId = Date.now().toString();
    const newUserMsg: Message = {
      id: userMsgId,
      role: "user",
      content: text,
      attachedReportLabels:
        reportsForThisMessage.length > 0
          ? reportsForThisMessage.map((r) => r.label)
          : undefined,
    };
    const baseMessages = customMessages || messages;
    const updatedMessages = [...baseMessages, newUserMsg];

    setMessages(updatedMessages);
    setMessage("");
    setIsTyping(true);

    try {
      // Build dynamic system prompt with user context
      let userContext = "";
      let hasReports = false;

      if (reportsForThisMessage.length > 0) {
        const reportsStr = reportsForThisMessage
          .map((r) => `--- ${r.label} ---\\n${JSON.stringify(r.ai_report)}`)
          .join("\\n\\n");
        userContext += `\\n\\nThe user has attached the following report(s) to this conversation. Prioritize these when answering:\\n${reportsStr}\\n`;
        hasReports = true;
      } else if (contextData) {
        userContext += `\\n\\nTemporary Test Data Context (USE THIS DATA IF THE USER ASKS ABOUT THEIR REPORTS):\\n${JSON.stringify(contextData)}\\n`;
        hasReports = true;
      } else {
        const userProfileStr = localStorage.getItem("userProfile");
        if (userProfileStr) {
          try {
            const profile = JSON.parse(userProfileStr);
            userContext += `\\n\\nUser Context:\\nName: ${profile.full_name || "User"}\\n`;

            const getStatus = (isCompleted: any, timestamp?: string) => {
              if (!isCompleted) return "Pending";
              if (!timestamp) return "Completed";
              const date = new Date(timestamp);
              return isNaN(date.getTime())
                ? "Completed"
                : date
                  .toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })
                  .replace(",", "");
            };

            userContext += `Profile Journey Statuses:\\n`;
            userContext += `- Registered: ${getStatus(true, profile.created_at || profile.status_timestamps?.registered)}\\n`;
            userContext += `- Sample Collected: ${getStatus(profile.sample_collected, profile.status_timestamps?.collected)}\\n`;
            userContext += `- Sample Received: ${getStatus(profile.sample_received, profile.status_timestamps?.received)}\\n`;
            let repStatus = "Pending";
            if (profile.report_generated) {
              repStatus = profile.report_verified
                ? getStatus(true, profile.status_timestamps?.generated)
                : "Generated (Waiting for Admin Approval)";
            }
            userContext += `- Report Status: ${repStatus}\\n\\n`;

            if (profile.phenotypic_data) {
              userContext += `Phenotypic Data: ${JSON.stringify(profile.phenotypic_data)}\\n`;
            }
            if (profile.reports && Object.keys(profile.reports).length > 0) {
              const reportsStr = Object.values(profile.reports)
                .map((r: any) => r.ai_report)
                .filter(Boolean)
                .join("\\n\\n");
              if (reportsStr) {
                userContext += `AI Reports: ${reportsStr}\\n`;
                hasReports = true;
              }
            }
          } catch (e) {
            console.error("Error parsing user profile for context", e);
          }
        }
      }

      if (!hasReports) {
        userContext += `AI Reports: (No reports are available in the user's profile yet.)\\n`;
      }

      // Topics the user actually has genomic reports for. The model must not answer
      // questions about topics outside this list (e.g. hair care when there's no hair
      // report) with generic/fabricated advice — it should say that report isn't ready yet.
      const availableReportLabels = getAvailableReports().map((r) => r.label);
      userContext += `\\n\\nAvailable Report Topics: ${availableReportLabels.length > 0 ? availableReportLabels.join(", ") : "(none yet)"}\\n`;

      // Split out remaining topics into "opted in but not generated yet" vs "never opted
      // in" using gene_type, so the model doesn't tell someone their hair report is coming
      // when they were never enrolled for hair testing in the first place.
      const optedGeneCodes = getOptedGeneCodes();
      if (optedGeneCodes) {
        const pendingTopics: string[] = [];
        const notOptedTopics: string[] = [];
        TOPIC_GENE_MAP.forEach(({ topic, keyword, genes }) => {
          const alreadyAvailable = availableReportLabels.some((l) =>
            l.toLowerCase().includes(keyword),
          );
          if (alreadyAvailable) return;
          const isOpted = genes.some((g) => optedGeneCodes.includes(g));
          if (isOpted) pendingTopics.push(topic);
          else notOptedTopics.push(topic);
        });
        if (pendingTopics.length > 0) {
          userContext += `Opted-In Tests (Report Pending): ${pendingTopics.join(", ")}\\n`;
        }
        if (notOptedTopics.length > 0) {
          userContext += `Tests NOT Opted-In (not part of this user's genomic profile): ${notOptedTopics.join(", ")}\\n`;
        }
      }

      const lengthInstruction =
        responseLength === "short"
          ? "Keep your response concise and brief."
          : responseLength === "long"
            ? "Provide a detailed and comprehensive response."
            : "Provide a standard medium-length response.";

      const systemPrompt = {
        role: "system",
        content: `You are QodAI, a helpful personal health companion for the My Body Qode (MBQ) app. ${lengthInstruction}\\n\\nCRITICAL RULES:\\n1. NEVER mention a "knowledge cutoff" date (e.g. October 2023).\\n2. If the user asks about their "MBQ report", "report", or health data, YOU MUST use the 'User Context' provided below.\\n3. If the 'User Context' says "No reports are available", tell the user: "I don't see your genomic report in your profile yet. Your report is currently being processed by our team. Please check your email daily for the latest updates." AND explicitly mention their latest completed sample status from the 'Profile Journey Statuses' (e.g. "Based on your profile journey, your sample was received on [Date]").\\n4. The 'Available Report Topics' line lists the ONLY genomic reports the user currently has. If the user asks about a topic that is NOT in that list, do NOT give generic advice or fabricate insights. Instead check which of these applies: (a) if the topic appears in 'Opted-In Tests (Report Pending)', the user IS enrolled for that test — tell them the report is still being generated/processed, referencing their 'Profile Journey Statuses'; (b) if the topic appears in 'Tests NOT Opted-In', the user was never enrolled for that test — do NOT imply a report is coming, instead tell them this test isn't part of their current genomic profile and they would need to opt into/order that specific test to get insights on it; (c) if neither list is present at all, fall back to the general "report isn't available yet" messaging from rule 3. Only discuss a topic in depth when a matching report is actually listed in 'Available Report Topics'.\\n5. NEVER mention rsIDs (e.g. "rs1815739", "rs4646994") or any SNP/marker/variant ID under any circumstances, even if the user directly asks for it, asks you to "look it up", or insists. Do not name, confirm, deny, or hint at what a gene's rsID is. If asked, politely say that level of technical detail isn't something you share, and redirect to what the result actually means for them (e.g. "I don't share specific marker IDs, but I can tell you what your ACTN3 result means for you — want me to?"). Always refer to findings by gene name and genotype only (e.g. "ACTN3 (RR)"), never by rsID.\\n${userContext}`,
      };

      const chatHistory = [
        systemPrompt,
        ...updatedMessages
          .filter((m) => typeof m.content === "string")
          .map((m) => ({
            role: m.role === "bot" ? "assistant" : m.role,
            content: m.content as string,
          })),
      ];

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatHistory, userId }),
      });

      if (response.status === 403) {
        const limitData = await response.json();
        if (typeof limitData.promptCount === "number") setPromptCount(limitData.promptCount);
        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + 1).toString(), role: "bot", content: PROMPT_LIMIT_MESSAGE },
        ]);
        return;
      }

      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json();

      if (userId && typeof data.promptCount === "number") {
        setPromptCount(data.promptCount);
      }

      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "bot", content: data.reply },
      ]);
    } catch (error) {
      console.error("Chat API Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "bot",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFeedback = (msgId: string, feedback: "sad" | "neutral" | "happy") => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === msgId
          ? {
            ...msg,
            feedback,
            showFeedbackTextarea: true,
          }
          : msg,
      ),
    );
  };

  const handleFeedbackTextChange = (msgId: string, text: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === msgId
          ? {
            ...msg,
            feedbackText: text,
          }
          : msg,
      ),
    );
  };

  const handleFeedbackSubmit = async (msgId: string) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg || !msg.feedback) return;

    try {
      await fetch('/api/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emoji: msg.feedback,
          feedback: msg.feedbackText,
          message_id: msgId
        })
      });
    } catch (e) {
      console.error('Feedback save error', e);
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
            ...m,
            showFeedbackTextarea: false,
            feedbackSubmitted: true,
          }
          : m,
      ),
    );
  };

  const handleRetry = (msgId: string) => {
    const msgIndex = messages.findIndex((m) => m.id === msgId);
    if (msgIndex <= 0) return;

    const prevMsg = messages[msgIndex - 1];
    if (prevMsg && prevMsg.role === "user") {
      const newMessages = messages.slice(0, msgIndex - 1);
      setMessages(newMessages);
      handleSend(prevMsg.content as string, newMessages, true);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95, borderRadius: 24 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              borderRadius: isFullScreen ? 0 : 24,
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95, borderRadius: 24 }}
            transition={{
              layout: { type: "spring", bounce: 0.05, duration: 0.4 },
              default: { duration: 0.2 },
            }}
            className={`fixed bg-white shadow-2xl border border-[#E8E8E5] overflow-hidden z-[60] flex flex-col ${isFullScreen
              ? "inset-0 w-full h-full"
              : "bottom-[85px] right-4 sm:right-6 w-[calc(100vw-32px)] sm:w-[400px]"
              }`}
            style={{
              maxHeight: isFullScreen ? "100vh" : "calc(100vh - 120px)",
            }}
          >
            {/* Header */}
            <motion.div
              layout
              className="p-4 flex items-center justify-between border-b border-[#E8E8E5] bg-white z-30 relative"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F5F3FF] flex items-center justify-center text-[#6057D7]">
                  <Sparkles size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-[#1A1A19] text-sm">QodAI</h3>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${isPromptLimitReached
                        ? "bg-red-50 text-red-600 border-red-200"
                        : "bg-[#F5F3FF] text-[#6057D7] border-[#DEDCFA]"
                        }`}
                      title="Prompts used"
                    >
                      Messages left {Math.max(MAX_USER_PROMPTS - promptCount, 0)}/{MAX_USER_PROMPTS}
                    </span>
                  </div>
                  <p className="text-xs text-[#8B8B86]">
                    Your personal health companion
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[#8B8B86]">
                <div className="relative" ref={historyMenuRef}>
                  <button
                    onClick={() => setShowHistoryMenu(!showHistoryMenu)}
                    className="p-1.5 hover:bg-[#F0F0ED] rounded-full transition-colors cursor-pointer"
                    title="Chat history"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  <AnimatePresence>
                    {showHistoryMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full right-0 mt-2 w-[280px] bg-white rounded-[16px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#E8E8E5] py-2 z-50 flex flex-col max-h-[360px]"
                      >
                        <button
                          onClick={startNewChat}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-[#F5F3FF] transition-colors text-sm font-semibold text-[#1A1A19] w-full text-left"
                        >
                          <MessageSquarePlus size={16} className="text-[#6057D7]" />
                          <span>New Chat</span>
                        </button>
                        <div className="border-t border-[#E8E8E5] mt-1 pt-1.5 flex flex-col overflow-y-auto px-1.5">
                          <span className="px-2.5 py-1 text-xs font-semibold text-[#8B8B86] uppercase tracking-wide">
                            History
                          </span>
                          {chatSessions.length === 0 ? (
                            <p className="px-2.5 py-2 text-sm text-[#8B8B86]">
                              No previous chats yet.
                            </p>
                          ) : (
                            [...chatSessions]
                              .sort((a, b) => b.updatedAt - a.updatedAt)
                              .map((session) => (
                                <div
                                  key={session.id}
                                  onClick={() => loadSession(session)}
                                  className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[#F5F3FF] text-sm cursor-pointer ${sessionIdRef.current === session.id ? "bg-[#F5F3FF]" : ""}`}
                                >
                                  <span className="flex-1 truncate text-[#1A1A19]">
                                    {session.title || "New chat"}
                                  </span>
                                  <button
                                    onClick={(e) => requestDeleteSession(session, e)}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#E8E5FB] rounded-full text-[#8B8B86] hover:text-red-500 transition-all shrink-0 cursor-pointer"
                                    title="Delete chat"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="p-1.5 hover:bg-[#F0F0ED] rounded-full transition-colors cursor-pointer"
                  title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                >
                  {isFullScreen ? (
                    <Minimize2 size={18} />
                  ) : (
                    <Maximize2 size={18} />
                  )}
                </button>
                <button
                  onClick={handleClose}
                  className="p-1.5 hover:bg-[#F0F0ED] rounded-full transition-colors cursor-pointer"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </motion.div>

            {/* Chat Feedback Overlay */}
            <AnimatePresence>
              {showAppFeedbackPrompt && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                >
                  <motion.div
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.95 }}
                    className="bg-white rounded-2xl shadow-2xl p-6 w-[90%] max-w-[400px] flex flex-col items-center text-center"
                  >
                    <h4 className="text-lg font-bold text-[#1A1A19] mb-2">Help Us Improve!</h4>
                    <p className="text-sm text-[#5c6473] mb-6">We are making our systems better, please contribute your thoughts to make the experience better.</p>

                    <div className="flex gap-6 justify-center mb-6">
                      <button
                        onClick={() => {
                          setSelectedAppEmoji('sad');
                          setShowAppTextarea(true);
                        }}
                        className={`p-3 rounded-full transition-all ${selectedAppEmoji === 'sad' ? 'bg-gray-100 ring-2 ring-gray-200 scale-110' : 'hover:bg-gray-50 hover:scale-105'}`}
                      >
                        <picture>
                          <source srcSet="https://fonts.gstatic.com/s/e/notoemoji/latest/1f61e/512.webp" type="image/webp" />
                          <img src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f61e/512.gif" alt="😞" width="48" height="48" />
                        </picture>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedAppEmoji('neutral');
                          setShowAppTextarea(true);
                        }}
                        className={`p-3 rounded-full transition-all ${selectedAppEmoji === 'neutral' ? 'bg-gray-100 ring-2 ring-gray-200 scale-110' : 'hover:bg-gray-50 hover:scale-105'}`}
                      >
                        <picture>
                          <source srcSet="https://fonts.gstatic.com/s/e/notoemoji/latest/1f610/512.webp" type="image/webp" />
                          <img src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f610/512.gif" alt="😐" width="48" height="48" />
                        </picture>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedAppEmoji('happy');
                          setShowAppTextarea(true);
                        }}
                        className={`p-3 rounded-full transition-all ${selectedAppEmoji === 'happy' ? 'bg-gray-100 ring-2 ring-gray-200 scale-110' : 'hover:bg-gray-50 hover:scale-105'}`}
                      >
                        <picture>
                          <source srcSet="https://fonts.gstatic.com/s/e/notoemoji/latest/1f603/512.webp" type="image/webp" />
                          <img src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f603/512.gif" alt="😃" width="48" height="48" />
                        </picture>
                      </button>
                    </div>

                    <AnimatePresence>
                      {showAppTextarea && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="w-full overflow-hidden"
                        >
                          <textarea
                            value={appFeedbackInput}
                            onChange={(e) => setAppFeedbackInput(e.target.value)}
                            placeholder="Any additional thoughts? (Optional)"
                            className="w-full h-24 p-3 text-left border border-[#E8E8E5] rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-[#6057D7] resize-none"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex gap-3 justify-end w-full mt-2">
                      <button
                        onClick={() => {
                          setShowAppFeedbackPrompt(false);
                          setSelectedAppEmoji(null);
                          setShowAppTextarea(false);
                          setAppFeedbackInput('');
                        }}
                        className="px-4 py-2 text-sm font-semibold text-[#5c6473] hover:text-[#1A1A19]"
                      >
                        Skip
                      </button>
                      <button
                        disabled={!selectedAppEmoji || submittingAppFeedback}
                        onClick={async () => {
                          if (!selectedAppEmoji) return;
                          setSubmittingAppFeedback(true);
                          try {
                            await fetch('/api/chat/feedback', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                emoji: selectedAppEmoji,
                                feedback: appFeedbackInput,
                                message_count: messages.filter(m => m.role === 'bot' && m.id !== 'initial').length
                              })
                            });
                          } catch (e) {
                            console.error('Feedback save error', e);
                          }
                          setSubmittingAppFeedback(false);
                          setShowAppFeedbackPrompt(false);
                          setAppFeedbackInput('');
                          setSelectedAppEmoji(null);
                          setShowAppTextarea(false);
                        }}
                        className="px-6 py-2 bg-[#6057D7] hover:bg-[#4F46B8] text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                      >
                        {submittingAppFeedback ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit'}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Delete Chat Confirmation Overlay */}
            <AnimatePresence>
              {sessionPendingDelete && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm"
                >
                  <motion.div
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.95 }}
                    className="bg-white rounded-2xl shadow-2xl p-6 w-[90%] max-w-[360px] flex flex-col items-center text-center"
                  >
                    <h4 className="text-lg font-bold text-[#1A1A19] mb-2">Delete this chat?</h4>
                    <p className="text-sm text-[#5c6473] mb-6">
                      "{sessionPendingDelete.title}" will be permanently deleted. This can't be undone.
                    </p>
                    <div className="flex gap-3 justify-end w-full">
                      <button
                        onClick={cancelDeleteSession}
                        className="px-4 py-2 text-sm font-semibold text-[#5c6473] hover:text-[#1A1A19]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={confirmDeleteSession}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chat Body */}
            <motion.div
              layout
              className={`p-4 flex-1 overflow-y-auto flex flex-col gap-4 ${isFullScreen ? "bg-white px-4 sm:px-8" : "bg-[#F9F9F8]"}`}
              style={{ paddingBottom: inputAreaHeight ? inputAreaHeight + 24 : 128 }}
            >
              <div
                className={`flex-1 flex flex-col gap-6 w-full ${isFullScreen ? "max-w-3xl mx-auto" : ""}`}
              >
                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.2 }}
                      className={`p-3 rounded-2xl shadow-sm text-sm leading-relaxed max-w-[85%] ${msg.role === "user"
                        ? "bg-[#6057D7] text-white self-end rounded-tr-sm"
                        : "bg-white text-[#1A1A19] border border-[#E8E8E5] self-start rounded-tl-sm"
                        }`}
                    >
                      {typeof msg.content === "string" ? (
                        <div className="flex flex-col gap-1">
                          {msg.role === "user" ? (
                            <>
                              {msg.attachedReportLabels &&
                                msg.attachedReportLabels.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                                    {msg.attachedReportLabels.map((label) => (
                                      <div
                                        key={label}
                                        className="flex items-center gap-1.5 bg-white/15 rounded-lg px-2 py-1 text-xs font-medium text-white"
                                      >
                                        <FileCheck size={12} className="shrink-0" />
                                        <span className="truncate max-w-[140px]">
                                          {label}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              <div className="whitespace-pre-wrap break-words text-white text-[15px] leading-relaxed">
                                {msg.content}
                              </div>
                            </>
                          ) : (
                            <div className="prose prose-sm max-w-none break-words prose-p:text-[#1A1A19] prose-a:text-[#6057D7] prose-pre:bg-[#F9F9F8] prose-pre:border prose-pre:border-[#E8E8E5] prose-pre:text-[#1A1A19] prose-pre:relative prose-pre:overflow-x-auto prose-pre:max-w-full overflow-hidden">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{ code: CustomCodeBlock }}
                              >
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          )}

                          {/* Action Bar for Bot Messages */}
                          {msg.role === "bot" && msg.id !== "initial" && (
                            <div className="flex flex-col mt-2 pt-2 border-t border-[#E8E8E5] opacity-90 hover:opacity-100 transition-opacity w-full">
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-[#8B8B86] mr-1">How was this response?</span>
                                  <button
                                    onClick={() => handleFeedback(msg.id, "sad")}
                                    className={`p-1 rounded-full transition-all ${msg.feedback === 'sad' ? 'bg-gray-100 ring-1 ring-gray-200 scale-110' : 'hover:bg-gray-50 hover:scale-105'}`}
                                  >
                                    <picture>
                                      <source srcSet="https://fonts.gstatic.com/s/e/notoemoji/latest/1f61e/512.webp" type="image/webp" />
                                      <img src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f61e/512.gif" alt="😞" width="24" height="24" />
                                    </picture>
                                  </button>
                                  <button
                                    onClick={() => handleFeedback(msg.id, "neutral")}
                                    className={`p-1 rounded-full transition-all ${msg.feedback === 'neutral' ? 'bg-gray-100 ring-1 ring-gray-200 scale-110' : 'hover:bg-gray-50 hover:scale-105'}`}
                                  >
                                    <picture>
                                      <source srcSet="https://fonts.gstatic.com/s/e/notoemoji/latest/1f610/512.webp" type="image/webp" />
                                      <img src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f610/512.gif" alt="😐" width="24" height="24" />
                                    </picture>
                                  </button>
                                  <button
                                    onClick={() => handleFeedback(msg.id, "happy")}
                                    className={`p-1 rounded-full transition-all ${msg.feedback === 'happy' ? 'bg-gray-100 ring-1 ring-gray-200 scale-110' : 'hover:bg-gray-50 hover:scale-105'}`}
                                  >
                                    <picture>
                                      <source srcSet="https://fonts.gstatic.com/s/e/notoemoji/latest/1f603/512.webp" type="image/webp" />
                                      <img src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f603/512.gif" alt="😃" width="24" height="24" />
                                    </picture>
                                  </button>
                                </div>
                                <button
                                  onClick={() => handleRetry(msg.id)}
                                  className="px-2 py-1 rounded-md text-[#8B8B86] hover:bg-[#F0F0ED] hover:text-[#1A1A19] transition-colors flex items-center gap-1.5"
                                  title="Regenerate response"
                                >
                                  <RotateCcw size={13} />
                                  <span className="text-[11px] font-medium tracking-wide">
                                    Retry
                                  </span>
                                </button>
                              </div>

                              <AnimatePresence>
                                {msg.showFeedbackTextarea && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="w-full overflow-hidden mt-2"
                                  >
                                    <textarea
                                      value={msg.feedbackText || ''}
                                      onChange={(e) => handleFeedbackTextChange(msg.id, e.target.value)}
                                      placeholder="Any additional thoughts? (Optional)"
                                      className="w-full h-16 p-2 text-xs border border-[#E8E8E5] rounded-lg mb-2 focus:outline-none focus:ring-1 focus:ring-[#6057D7] resize-none"
                                    />
                                    <div className="flex gap-2 justify-end w-full">
                                      <button
                                        onClick={() => {
                                          setMessages((prev) =>
                                            prev.map((m) =>
                                              m.id === msg.id
                                                ? { ...m, showFeedbackTextarea: false, feedbackText: '', feedback: undefined }
                                                : m
                                            )
                                          );
                                        }}
                                        className="px-3 py-1 text-xs font-semibold text-[#5c6473] hover:text-[#1A1A19]"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={() => handleFeedbackSubmit(msg.id)}
                                        className="px-4 py-1.5 bg-[#6057D7] hover:bg-[#4F46B8] text-white rounded-md text-xs font-bold transition-colors"
                                      >
                                        Submit
                                      </button>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              {msg.feedbackSubmitted && (
                                <div className="text-[11px] text-green-600 mt-1 flex items-center gap-1">
                                  <Check size={12} /> Feedback submitted, thank you!
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        msg.content
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white text-[#1A1A19] border border-[#E8E8E5] self-start rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm w-fit flex items-center gap-2"
                  >
                    <span className="flex items-center justify-center -ml-1 [&_canvas]:!size-[22px]">
                      <ThinkingOrb state="searching" size={20} theme="light" />
                    </span>
                    <span className="text-xs font-semibold text-[#8B8B86] animate-pulse">
                      QodAI is thinking...
                    </span>
                  </motion.div>
                )}

                <div ref={messagesEndRef} className="h-1" />
              </div>

              {messages.length === 1 && !isPromptLimitReached && (
                <div
                  className={`flex flex-col gap-2 mt-auto pt-2 w-full ${isFullScreen ? "max-w-3xl mx-auto" : ""}`}
                >
                  <AnimatePresence>
                    {suggestions.map((suggestion, index) => (
                      <motion.button
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => handleSend(suggestion)}
                        className="text-left px-4 py-2.5 rounded-full border border-[#DEDCFA] bg-white text-sm text-[#6057D7] hover:bg-[#F5F3FF] transition-colors shadow-sm cursor-pointer w-fit relative z-20"
                      >
                        {suggestion}
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>

            {/* Input Area */}
            <motion.div
              ref={inputAreaRef}
              layout
              className={`absolute bottom-0 left-0 w-full p-4 pt-12 z-20 flex flex-col justify-end ${isFullScreen ? "px-4 sm:px-8 pb-6" : ""}`}
            >
              {/* Gradient & Blur Backgrounds */}
              <div
                className={`absolute inset-0 bg-gradient-to-t ${isFullScreen ? "from-white via-white/90" : "from-[#F9F9F8] via-[#F9F9F8]/90"} to-transparent pointer-events-none`}
              />
              <div className="absolute inset-0 backdrop-blur-md pointer-events-none [mask-image:linear-gradient(to_top,black_50%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_top,black_50%,transparent_100%)]" />

              {isPromptLimitReached ? (
                <div
                  className={`relative flex items-center justify-center text-center px-5 py-4 rounded-[24px] mx-auto w-full ${isFullScreen ? "max-w-3xl bg-[#F0F4F9]" : "max-w-4xl bg-white border border-[#E8E8E5] shadow-md"}`}
                >
                  <p className="text-sm text-[#5c6473] leading-relaxed">
                    {PROMPT_LIMIT_MESSAGE}
                  </p>
                </div>
              ) : (
                <div
                  className={`relative flex flex-col gap-0 p-1.5 rounded-[24px] mx-auto w-full ${isFullScreen ? "max-w-3xl bg-[#F0F4F9] shadow-none" : "max-w-4xl bg-white border border-[#E8E8E5] shadow-md"}`}
                >
                  {selectedReports.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-2 pt-1.5 pb-2">
                      {selectedReports.map((report) => (
                        <div
                          key={report.key}
                          className="flex items-center gap-2 bg-[#F5F3FF] border border-[#DEDCFA] rounded-xl pl-2.5 pr-1.5 py-1.5 text-xs"
                        >
                          <FileCheck size={14} className="text-[#6057D7] shrink-0" />
                          <span className="text-[#1A1A19] font-medium max-w-[140px] truncate">
                            {report.label}
                          </span>
                          <button
                            onClick={() =>
                              setSelectedReports((prev) =>
                                prev.filter((r) => r.key !== report.key),
                              )
                            }
                            className="p-0.5 hover:bg-[#E8E5FB] rounded-full text-[#8B8B86] hover:text-[#1A1A19] transition-colors cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-end gap-0">
                    {/* Plus Button & Menu Container */}
                    <div className="relative" ref={plusMenuRef}>
                      <button
                        onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
                        className="w-9 h-9 flex items-center justify-center text-[#8B8B86] hover:text-[#1A1A19] hover:bg-[#E8E8E5] rounded-full transition-colors shrink-0 cursor-pointer z-10 relative"
                      >
                        <Plus
                          size={18}
                          className={`transition-transform duration-200 ${isPlusMenuOpen ? "rotate-45" : ""}`}
                        />
                      </button>

                      <AnimatePresence>
                        {isPlusMenuOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute bottom-full left-0 mb-2 w-[300px] bg-white rounded-[20px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#E8E8E5] py-2 z-50 flex flex-col max-h-[340px]"
                          >
                            <span className="px-4 pb-1.5 text-xs font-semibold text-[#8B8B86] uppercase tracking-wide">
                              Attach a report
                            </span>
                            <div className="flex flex-col overflow-y-auto px-1.5">
                              {getAvailableReports().length === 0 ? (
                                <p className="px-3 py-3 text-sm text-[#8B8B86]">
                                  No AI reports available yet.
                                </p>
                              ) : (
                                getAvailableReports().map((report) => {
                                  const isSelected = selectedReports.some(
                                    (r) => r.key === report.key,
                                  );
                                  return (
                                    <button
                                      key={report.key}
                                      onClick={() => toggleReportSelection(report)}
                                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F5F3FF] transition-colors text-sm text-[#1A1A19] w-full text-left"
                                    >
                                      <div
                                        className={`w-[18px] h-[18px] rounded-md border flex items-center justify-center shrink-0 transition-colors ${isSelected ? "bg-[#6057D7] border-[#6057D7]" : "border-[#D9D9D6]"}`}
                                      >
                                        {isSelected && (
                                          <Check size={12} className="text-white" />
                                        )}
                                      </div>
                                      <span className="truncate">{report.label}</span>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                            <div className="border-t border-[#E8E8E5] mt-1.5 pt-1.5 flex flex-col">
                              <button
                                className="flex items-center gap-3 px-4 py-2 hover:bg-[#F5F3FF] transition-colors text-sm text-[#1A1A19] w-full text-left"
                                onClick={() => {
                                  setIsPlusMenuOpen(false);
                                  // TODO: Trigger file upload input
                                }}
                              >
                                <FileUp size={18} className="text-[#8B8B86]" />
                                <span>Upload PDF</span>
                              </button>
                            </div>
                            {selectedReports.length > 0 && (
                              <button
                                onClick={() => setIsPlusMenuOpen(false)}
                                className="mx-3 mt-1.5 px-3 py-2 rounded-full bg-[#6057D7] text-white text-sm font-semibold hover:bg-[#4B44B3] transition-colors cursor-pointer"
                              >
                                Done ({selectedReports.length} selected)
                              </button>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <TextareaAutosize
                      maxRows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Ask me anything..."
                      className="flex-1 bg-transparent border-none outline-none text-sm text-[#1A1A19] placeholder:text-[#8B8B86] pl-1 pr-2 py-2 resize-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (window.innerWidth < 768) {
                            // On mobile, let default (new line) happen
                            return;
                          }
                          if (e.shiftKey) {
                            // Shift+Enter creates a new line
                            return;
                          }
                          // Desktop, no shift: send
                          e.preventDefault();
                          handleSend(message);
                        }
                      }}
                    />
                    <div className="flex items-center gap-1">
                      <div className="relative" ref={lengthMenuRef}>
                        <button
                          onClick={() => setIsLengthMenuOpen(!isLengthMenuOpen)}
                          className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors shrink-0 cursor-pointer z-10 relative ${isLengthMenuOpen ? "bg-[#F0F0ED] text-[#1A1A19]" : "text-[#8B8B86] hover:text-[#1A1A19] hover:bg-[#E8E8E5]"}`}
                          title="Response Length"
                        >
                          <SlidersHorizontal size={16} />
                        </button>

                        <AnimatePresence>
                          {isLengthMenuOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              transition={{ duration: 0.15 }}
                              className="absolute bottom-full right-0 mb-2 w-32 bg-white rounded-[16px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#E8E8E5] py-2 z-50 flex flex-col"
                            >
                              {(["short", "medium", "long"] as const).map((len) => (
                                <button
                                  key={len}
                                  onClick={() => {
                                    setResponseLength(len);
                                    setIsLengthMenuOpen(false);
                                  }}
                                  className="flex items-center justify-between px-4 py-2 hover:bg-[#F5F3FF] transition-colors text-sm text-[#1A1A19] w-full text-left capitalize"
                                >
                                  <span>{len}</span>
                                  {responseLength === len && (
                                    <Check size={14} className="text-[#6057D7]" />
                                  )}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <button
                        className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors shrink-0 cursor-pointer ${message.trim() ? "bg-[#6057D7] text-white shadow-md hover:bg-[#4B44B3]" : "bg-transparent text-[#8B8B86]"}`}
                        onClick={() => handleSend(message)}
                      >
                        <Send
                          size={16}
                          className={message.trim() ? "" : "-ml-0.5"}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <p className="relative text-center text-[8px] tracking-wide text-[#8B8B86] mt-3 drop-shadow-sm opacity-80">
                Powered by QodAI
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      {(!isOpen || !isFullScreen) && (
        <motion.button
          className="fixed bottom-6 right-6 w-14 h-14 bg-[#6057D7] rounded-full shadow-[0_8px_20px_rgba(96,87,215,0.3)] flex items-center justify-center text-white hover:bg-[#4B44B3] transition-colors z-[60] cursor-pointer"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <Sparkles size={24} />
          {!isOpen && (
            <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white"></span>
          )}
        </motion.button>
      )}
    </>
  );
}
