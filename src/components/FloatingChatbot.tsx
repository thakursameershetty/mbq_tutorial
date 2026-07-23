import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, MoreHorizontal, Plus, Send, Maximize2, Minimize2, Copy, Check, ThumbsUp, ThumbsDown, RotateCcw, FileCheck, FileUp, SlidersHorizontal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TextareaAutosize from 'react-textarea-autosize';

interface FloatingChatbotProps {
  userName?: string;
}

type Message = {
  id: string;
  role: 'bot' | 'user';
  content: React.ReactNode;
  feedback?: 'like' | 'dislike';
};

const CustomCodeBlock = ({ node, inline, className, children, ...props }: any) => {
  const match = /language-(\w+)/.exec(className || '');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
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
          {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
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

export default function FloatingChatbot({ userName = 'User' }: FloatingChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [message, setMessage] = useState('');

  const firstName = userName.split(' ')[0] || 'User';

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'initial',
      role: 'bot',
      content: (
        <>
          <p className="mb-3">Hi {firstName}! 👋</p>
          <p className="mb-3">I'm your AI assistant. Ask me anything about your genomic profile, caffeine response, sleep, hair health or personalized recommendations.</p>
          <p className="mb-0">How can I help you today?</p>
        </>
      )
    }
  ]);

  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);

  const [responseLength, setResponseLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [isLengthMenuOpen, setIsLengthMenuOpen] = useState(false);
  const lengthMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (plusMenuRef.current && !plusMenuRef.current.contains(event.target as Node)) {
        setIsPlusMenuOpen(false);
      }
      if (lengthMenuRef.current && !lengthMenuRef.current.contains(event.target as Node)) {
        setIsLengthMenuOpen(false);
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
    "Hair care recommendations"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const handleSend = async (text: string, customMessages?: Message[]) => {
    if (!text.trim()) return;

    // Add user message
    const userMsgId = Date.now().toString();
    const newUserMsg: Message = { id: userMsgId, role: 'user', content: text };
    const baseMessages = customMessages || messages;
    const updatedMessages = [...baseMessages, newUserMsg];

    setMessages(updatedMessages);
    setMessage('');
    setIsTyping(true);

    try {
      // Build dynamic system prompt with user context
      let userContext = "";
      let hasReports = false;
      const userProfileStr = localStorage.getItem('userProfile');

      if (userProfileStr) {
        try {
          const profile = JSON.parse(userProfileStr);
          userContext += `\\n\\nUser Context:\\nName: ${profile.full_name || 'User'}\\n`;

          const getStatus = (isCompleted: any, timestamp?: string) => {
            if (!isCompleted) return "Pending";
            if (!timestamp) return "Completed";
            const date = new Date(timestamp);
            return isNaN(date.getTime()) ? "Completed" : date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');
          };

          userContext += `Profile Journey Statuses:\\n`;
          userContext += `- Registered: ${getStatus(true, profile.created_at || profile.status_timestamps?.registered)}\\n`;
          userContext += `- Sample Collected: ${getStatus(profile.sample_collected, profile.status_timestamps?.collected)}\\n`;
          userContext += `- Sample Received: ${getStatus(profile.sample_received, profile.status_timestamps?.received)}\\n`;
          let repStatus = "Pending";
          if (profile.report_generated) {
            repStatus = profile.report_verified ? getStatus(true, profile.status_timestamps?.generated) : "Generated (Waiting for Admin Approval)";
          }
          userContext += `- Report Status: ${repStatus}\\n\\n`;

          if (profile.phenotypic_data) {
            userContext += `Phenotypic Data: ${JSON.stringify(profile.phenotypic_data)}\\n`;
          }
          if (profile.reports && Object.keys(profile.reports).length > 0) {
            const reportsStr = Object.values(profile.reports).map((r: any) => r.ai_report).filter(Boolean).join('\\n\\n');
            if (reportsStr) {
              userContext += `AI Reports: ${reportsStr}\\n`;
              hasReports = true;
            }
          }
        } catch (e) {
          console.error("Error parsing user profile for context", e);
        }
      }

      if (!hasReports) {
        userContext += `AI Reports: (No reports are available in the user's profile yet.)\\n`;
      }

      const lengthInstruction = responseLength === 'short'
        ? "Keep your response concise and brief."
        : responseLength === 'long'
          ? "Provide a detailed and comprehensive response."
          : "Provide a standard medium-length response.";

      const systemPrompt = {
        role: 'system',
        content: `You are QODAi, a helpful personal health companion for the My Body Qode (MBQ) app. ${lengthInstruction}\\n\\nCRITICAL RULES:\\n1. NEVER mention a "knowledge cutoff" date (e.g. October 2023).\\n2. If the user asks about their "MBQ report", "report", or health data, YOU MUST use the 'User Context' provided below.\\n3. If the 'User Context' says "No reports are available", tell the user: "I don't see your genomic report in your profile yet. Your report is currently being processed by our team. Please check your email daily for the latest updates." AND explicitly mention their latest completed sample status from the 'Profile Journey Statuses' (e.g. "Based on your profile journey, your sample was received on [Date]").\\n${userContext}`
      };

      const chatHistory = [
        systemPrompt,
        ...updatedMessages
          .filter(m => typeof m.content === 'string')
          .map(m => ({ role: m.role === 'bot' ? 'assistant' : m.role, content: m.content as string }))
      ];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistory })
      });

      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();

      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'bot', content: data.reply }
      ]);
    } catch (error) {
      console.error('Chat API Error:', error);
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'bot', content: "Sorry, I encountered an error. Please try again." }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFeedback = (msgId: string, feedback: 'like' | 'dislike') => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === msgId ? { ...msg, feedback: msg.feedback === feedback ? undefined : feedback } : msg
      )
    );
  };

  const handleRetry = (msgId: string) => {
    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex <= 0) return;

    const prevMsg = messages[msgIndex - 1];
    if (prevMsg && prevMsg.role === 'user') {
      const newMessages = messages.slice(0, msgIndex - 1);
      setMessages(newMessages);
      handleSend(prevMsg.content as string, newMessages);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95, borderRadius: 24 }}
            animate={{ opacity: 1, y: 0, scale: 1, borderRadius: isFullScreen ? 0 : 24 }}
            exit={{ opacity: 0, y: 20, scale: 0.95, borderRadius: 24 }}
            transition={{
              layout: { type: "spring", bounce: 0.05, duration: 0.4 },
              default: { duration: 0.2 }
            }}
            className={`fixed bg-white shadow-2xl border border-[#E8E8E5] overflow-hidden z-50 flex flex-col ${isFullScreen
              ? 'inset-0 w-full h-full'
              : 'bottom-[85px] right-4 sm:right-6 w-[calc(100vw-32px)] sm:w-[400px]'
              }`}
            style={{ maxHeight: isFullScreen ? '100vh' : 'calc(100vh - 120px)' }}
          >
            {/* Header */}
            <motion.div layout className="p-4 flex items-center justify-between border-b border-[#E8E8E5] bg-white z-30 relative">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F5F3FF] flex items-center justify-center text-[#6057D7]">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-[#1A1A19] text-sm">QODAi</h3>
                  <p className="text-xs text-[#8B8B86]">Your personal health companion</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[#8B8B86]">
                <button className="p-1.5 hover:bg-[#F0F0ED] rounded-full transition-colors cursor-pointer">
                  <MoreHorizontal size={18} />
                </button>
                <button
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="p-1.5 hover:bg-[#F0F0ED] rounded-full transition-colors cursor-pointer"
                  title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                >
                  {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
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

            {/* Chat Body */}
            <motion.div layout className={`p-4 pb-32 flex-1 overflow-y-auto flex flex-col gap-4 ${isFullScreen ? 'bg-white px-4 sm:px-8' : 'bg-[#F9F9F8]'}`}>
              <div className={`flex-1 flex flex-col gap-6 w-full ${isFullScreen ? 'max-w-3xl mx-auto' : ''}`}>
                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.2 }}
                      className={`p-3 rounded-2xl shadow-sm text-sm leading-relaxed max-w-[85%] ${msg.role === 'user'
                        ? 'bg-[#6057D7] text-white self-end rounded-tr-sm'
                        : 'bg-white text-[#1A1A19] border border-[#E8E8E5] self-start rounded-tl-sm'
                        }`}
                    >
                      {typeof msg.content === 'string' ? (
                        <div className="flex flex-col gap-1">
                          {msg.role === 'user' ? (
                            <div className="whitespace-pre-wrap break-words text-white text-[15px] leading-relaxed">
                              {msg.content}
                            </div>
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
                          {msg.role === 'bot' && msg.id !== 'initial' && (
                            <div className="flex items-center gap-1.5 mt-1 pt-1 opacity-80 hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleFeedback(msg.id, 'like')}
                                className={`p-1.5 rounded-md transition-colors ${msg.feedback === 'like' ? 'text-[#6057D7] bg-[#F5F3FF]' : 'text-[#8B8B86] hover:bg-[#F0F0ED] hover:text-[#1A1A19]'}`}
                                title="Helpful"
                              >
                                <ThumbsUp size={14} fill={msg.feedback === 'like' ? "currentColor" : "none"} />
                              </button>
                              <button
                                onClick={() => handleFeedback(msg.id, 'dislike')}
                                className={`p-1.5 rounded-md transition-colors ${msg.feedback === 'dislike' ? 'text-red-500 bg-red-50' : 'text-[#8B8B86] hover:bg-[#F0F0ED] hover:text-[#1A1A19]'}`}
                                title="Not helpful"
                              >
                                <ThumbsDown size={14} fill={msg.feedback === 'dislike' ? "currentColor" : "none"} />
                              </button>
                              <div className="w-[1px] h-3 bg-[#E8E8E5] mx-1"></div>
                              <button
                                onClick={() => handleRetry(msg.id)}
                                className="px-2 py-1.5 rounded-md text-[#8B8B86] hover:bg-[#F0F0ED] hover:text-[#1A1A19] transition-colors flex items-center gap-1.5"
                                title="Regenerate response"
                              >
                                <RotateCcw size={13} />
                                <span className="text-[11px] font-medium tracking-wide">Retry</span>
                              </button>
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
                    className="bg-white text-[#1A1A19] border border-[#E8E8E5] self-start rounded-2xl rounded-tl-sm p-4 shadow-sm w-fit flex gap-1"
                  >
                    <motion.div className="w-1.5 h-1.5 bg-[#8B8B86] rounded-full" animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} />
                    <motion.div className="w-1.5 h-1.5 bg-[#8B8B86] rounded-full" animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} />
                    <motion.div className="w-1.5 h-1.5 bg-[#8B8B86] rounded-full" animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} />
                  </motion.div>
                )}

                <div ref={messagesEndRef} className="h-1" />
              </div>

              {messages.length === 1 && (
                <div className={`flex flex-col gap-2 mt-auto pt-2 w-full ${isFullScreen ? 'max-w-3xl mx-auto' : ''}`}>
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
            <motion.div layout className={`absolute bottom-0 left-0 w-full p-4 pt-12 z-20 flex flex-col justify-end ${isFullScreen ? 'px-4 sm:px-8 pb-6' : ''}`}>
              {/* Gradient & Blur Backgrounds */}
              <div className={`absolute inset-0 bg-gradient-to-t ${isFullScreen ? 'from-white via-white/90' : 'from-[#F9F9F8] via-[#F9F9F8]/90'} to-transparent pointer-events-none`} />
              <div className="absolute inset-0 backdrop-blur-md pointer-events-none [mask-image:linear-gradient(to_top,black_50%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_top,black_50%,transparent_100%)]" />

              <div className={`relative flex items-end gap-0 p-1.5 rounded-[24px] mx-auto w-full ${isFullScreen ? 'max-w-3xl bg-[#F0F4F9] shadow-none' : 'max-w-4xl bg-white border border-[#E8E8E5] shadow-md'}`}>

                {/* Plus Button & Menu Container */}
                <div className="relative" ref={plusMenuRef}>
                  <button
                    onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
                    className="w-9 h-9 flex items-center justify-center text-[#8B8B86] hover:text-[#1A1A19] hover:bg-[#E8E8E5] rounded-full transition-colors shrink-0 cursor-pointer z-10 relative"
                  >
                    <Plus size={18} className={`transition-transform duration-200 ${isPlusMenuOpen ? 'rotate-45' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isPlusMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-full left-0 mb-2 w-[280px] bg-white rounded-[20px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#E8E8E5] py-2 z-50 flex flex-col"
                      >
                        <div className="flex flex-col">
                          <button
                            className="flex items-center gap-3 px-4 py-2 hover:bg-[#F5F3FF] transition-colors text-sm text-[#1A1A19] w-full text-left"
                            onClick={() => {
                              setIsPlusMenuOpen(false);
                              // TODO: Open report selection modal
                            }}
                          >
                            <FileCheck size={18} className="text-[#6057D7]" />
                            <span>Select AI Report</span>
                          </button>
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
                    if (e.key === 'Enter') {
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
                      className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors shrink-0 cursor-pointer z-10 relative ${isLengthMenuOpen ? 'bg-[#F0F0ED] text-[#1A1A19]' : 'text-[#8B8B86] hover:text-[#1A1A19] hover:bg-[#E8E8E5]'}`}
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
                          {(['short', 'medium', 'long'] as const).map(len => (
                            <button
                              key={len}
                              onClick={() => {
                                setResponseLength(len);
                                setIsLengthMenuOpen(false);
                              }}
                              className="flex items-center justify-between px-4 py-2 hover:bg-[#F5F3FF] transition-colors text-sm text-[#1A1A19] w-full text-left capitalize"
                            >
                              <span>{len}</span>
                              {responseLength === len && <Check size={14} className="text-[#6057D7]" />}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button
                    className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors shrink-0 cursor-pointer ${message.trim() ? 'bg-[#6057D7] text-white shadow-md hover:bg-[#4B44B3]' : 'bg-transparent text-[#8B8B86]'}`}
                    onClick={() => handleSend(message)}
                  >
                    <Send size={16} className={message.trim() ? "" : "-ml-0.5"} />
                  </button>
                </div>
              </div>
              <p className="relative text-center text-[8px] tracking-wide text-[#8B8B86] mt-3 drop-shadow-sm opacity-80">
                Powered by QODAi
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#6057D7] rounded-full shadow-[0_8px_20px_rgba(96,87,215,0.3)] flex items-center justify-center text-white hover:bg-[#4B44B3] transition-colors z-40 cursor-pointer"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Sparkles size={24} />
        {!isOpen && (
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white"></span>
        )}
      </motion.button>
    </>
  );
}
