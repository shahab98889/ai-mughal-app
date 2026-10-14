import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Copy,
  Download,
  Headphones,
  Image as ImageIcon,
  MessageSquare,
  Mic,
  PanelLeft,
  Plus,
  Send,
  Smartphone,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { FormattedMessage } from './components/FormattedMessage.tsx';
import { LiveVoiceCallModal, VoiceCallState } from './components/LiveVoiceCallModal.tsx';
import { PlayStoreReadinessModal } from './components/PlayStoreReadinessModal.tsx';
import { useOnlineStatus, usePWAInstall } from './hooks/usePWAInstall.ts';

// High-resolution visual sample assets for instant one-tap testing of Image + Voice/Text Analysis
import sampleCourtyardImg from './assets/images/mughal_imperial_court_hero_1791615619287.jpg';
import sampleInlayImg from './assets/images/folio_pietra_dura_taj_1791615655727.jpg';

export type LanguageMode = 'auto' | 'roman_urdu' | 'english';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  image?: {
    data: string;
    mimeType: string;
    name?: string;
  };
  generatedImageUrl?: string;
  generatedPrompt?: string;
  isVoiceQuery?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
}

const STORAGE_KEY = 'mughal_ai_conversations_v1';

const STARTER_PROMPTS = [
  {
    id: 'free-image-gen',
    kicker: 'Free AI Tasveer Generator',
    title: 'Tasveer banao: Badshahi Mosque at sunset in cyberpunk style',
    prompt: 'Tasveer banao: Majestic Badshahi Mosque in Lahore at golden sunset with warm glowing lanterns, cinematic 8k photography',
  },
  {
    id: 'vision-urdu',
    kicker: 'Tasveer + Roman Urdu Analysis',
    title: 'Is tasveer mein kya hai? Roman Urdu mein samjhayein',
    prompt: 'Assalam-o-Alaikum Mughal AI! Is tasveer ka bariki se jaiza lein aur mujhe Roman Urdu mein tafseel se batayein ke is mein kya nazar aa raha hai.',
    sampleImage: sampleInlayImg,
  },
  {
    id: 'vision-english',
    kicker: 'Architectural Photo Inspection',
    title: 'Analyze the architecture and lighting in this photo',
    prompt: 'Analyze the architectural style, materials, and lighting in this image. Explain key details in both English and Roman Urdu.',
    sampleImage: sampleCourtyardImg,
  },
  {
    id: 'daily-assistant',
    kicker: 'Roman Urdu & English Assistant',
    title: 'Mere liye 7-day healthy diet aur workout plan banayein',
    prompt: 'Salam Mughal AI! Mere liye aik practical 7-day desi healthy diet aur home workout plan Roman Urdu aur English mein tayyar karein.',
  },
];

// Detect creator/owner questions ("tumhe kis ne banaya", "who made you", "who created you", "tumhara malik kaun hai", "tumhe kisne banaya hai")
function isCreatorQuestion(input: string): boolean {
  const normalized = input.trim().toLowerCase();
  const creatorRegex =
    /(?:tumh?e\s*kis\s*ne\s*banaya|tumh?e\s*kisne\s*banaya|kis\s*ne\s*banaya\s*hai|kisne\s*banaya\s*hai|apko\s*kis\s*ne\s*banaya|aap\s*ko\s*kis\s*ne\s*banaya|tumhara\s*malik\s*kaun\s*hai|tumhara\s*malik\s*kon\s*hai|apka\s*malik\s*kaun|who\s*made\s*you|who\s*created\s*you|who\s*built\s*you|who\s*is\s*your\s*creator|who\s*is\s*your\s*owner|who\s*developed\s*you)/i;
  return creatorRegex.test(normalized);
}

// RULE 1 & 3: Secret Code Check ("MUGHAL786")
function containsSecretCode(input: string): boolean {
  return /MUGHAL786/i.test(input.trim());
}

// RULE 2: Impostor claim without secret code ("I am Shahab", "Main Shahab hu", "I am owner", "I am admin")
function isImpostorClaim(input: string): boolean {
  if (containsSecretCode(input)) return false;
  const normalized = input.trim().toLowerCase();
  const impostorRegex =
    /(?:^(?:i\s*am|im|main|me|mein)\s*(?:shahab|shahab\s*badshah|the\s*owner|owner|malik|admin)\b|(?:main|me|mein)\s*shahab\s*(?:hu|hoon|hon)\b|^(?:i\s*am\s*owner|i\s*am\s*the\s*owner|i\s*am\s*admin|i\s*am\s*your\s*admin|i\s*am\s*your\s*owner|i\s*am\s*your\s*boss|i\s*am\s*the\s*creator)\b|(?:main|mein)\s*(?:tera|aapka|apka|tumhara)\s*(?:malik|owner|boss|creator)\s*(?:hu|hoon|hon)\b)/i;
  return impostorRegex.test(normalized);
}

// RULE 4: User begging or asking for the secret code / password
function isAskingForSecretCode(input: string): boolean {
  const normalized = input.trim().toLowerCase();
  const askCodeRegex =
    /(?:secret\s*code\s*(?:kya|batao|bolo|share|reveal|tell|what)|code\s*(?:kya\s*hai|bata\s*do|batao|share\s*karo)|password\s*(?:kya\s*hai|batao)|what\s*is\s*(?:the\s*)?(?:secret\s*code|password|code)|tell\s*me\s*(?:the\s*)?(?:secret\s*code|password|code))/i;
  return askCodeRegex.test(normalized);
}

// Detect "tasveer banao", "image banao", "picture banao" (and common Roman Urdu / English variations)
function extractImageGenerationPrompt(input: string): string | null {
  const normalized = input.trim();
  const triggerRegex =
    /(?:tasveer\s*banao|taswir\s*banao|tasveer\s*banaye|tasveer\s*bna\s*do|image\s*banao|image\s*banaye|image\s*bna\s*do|picture\s*banao|picture\s*banaye|pic\s*banao|photo\s*banao|generate\s*image|create\s*image|make\s*an?\s*image)/i;

  if (!triggerRegex.test(normalized)) {
    return null;
  }

  // Strip the trigger phrase and filler prefixes/suffixes like "aik", "ek", "ki", "ka", "of", ":"
  let cleaned = normalized
    .replace(triggerRegex, '')
    .replace(/^[\s:,-]+/, '')
    .replace(/^(?:aik|ek|a|an|the|of|ki|ka|ke|for\s+me|mere\s+liye)\s+/i, '')
    .replace(/\s+(?:ki|ka|ke)$/i, '')
    .trim();

  if (!cleaned) {
    cleaned = normalized;
  }

  return cleaned;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

async function urlToBase64(url: string): Promise<{ data: string; mimeType: string }> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve({
        data: reader.result as string,
        mimeType: blob.type || 'image/jpeg',
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    const initialId = 'conv-initial';
    return [
      {
        id: initialId,
        title: 'New Conversation',
        updatedAt: formatTime(new Date()),
        messages: [],
      },
    ];
  });

  const [activeConvId, setActiveConvId] = useState<string>(() => conversations[0]?.id || 'conv-initial');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [languageMode, setLanguageMode] = useState<LanguageMode>('auto');
  const [inputText, setInputText] = useState<string>('');
  const [pendingImage, setPendingImage] = useState<{
    data: string;
    mimeType: string;
    name?: string;
  } | null>(null);

  // Streaming & API states
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Voice recording & Gemini Transcription states
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [autoSendVoiceWithImage, setAutoSendVoiceWithImage] = useState<boolean>(true);

  // Camera capture modal state
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // TTS audio playback state
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [loadingTtsId, setLoadingTtsId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Live Voice Call Mode states (ChatGPT-style continuous voice mode)
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState<boolean>(false);
  const [voiceCallState, setVoiceCallState] = useState<VoiceCallState>('listening');
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [callAiReply, setCallAiReply] = useState<string>('');
  const [isCallMuted, setIsCallMuted] = useState<boolean>(false);

  const isVoiceCallOpenRef = useRef<boolean>(false);
  const isCallMutedRef = useRef<boolean>(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRecognitionRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callRecognitionRef = useRef<any>(null);

  // Copy message state
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Play Store / PWA modal
  const [showPlayStoreModal, setShowPlayStoreModal] = useState<boolean>(false);

  const { isInstallable, isInstalled, install } = usePWAInstall();
  const isOnline = useOnlineStatus();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  const activeConversation =
    conversations.find((c) => c.id === activeConvId) || conversations[0];

  // Persist conversations
  useEffect(() => {
    try {
      // Save without huge base64 strings if over quota
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch {
      // If localStorage quota exceeded due to high-res images, store text history
      try {
        const lightConversations = conversations.map((c) => ({
          ...c,
          messages: c.messages.map((m) => ({ ...m, image: undefined })),
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lightConversations));
      } catch {
        // ignore
      }
    }
  }, [conversations]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages.length, isStreaming]);

  // Cleanup camera and recording on unmount
  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (timerIntervalRef.current) {
        window.clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  const createNewChat = () => {
    const newId = `conv-${Date.now()}`;
    const newConv: Conversation = {
      id: newId,
      title: 'New Conversation',
      updatedAt: formatTime(new Date()),
      messages: [],
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConvId(newId);
    setInputText('');
    setPendingImage(null);
    setErrorBanner(null);
    setSidebarOpen(false);
  };

  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (filtered.length === 0) {
        const fallback: Conversation = {
          id: `conv-${Date.now()}`,
          title: 'New Conversation',
          updatedAt: formatTime(new Date()),
          messages: [],
        };
        setActiveConvId(fallback.id);
        return [fallback];
      }
      if (id === activeConvId) {
        setActiveConvId(filtered[0].id);
      }
      return filtered;
    });
  };

  // Compress and read image file
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorBanner('Meharbani farma kar sirf image file (JPG, PNG, WebP) select karein.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1280;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setPendingImage({
            data: compressedDataUrl,
            mimeType: 'image/jpeg',
            name: file.name,
          });
          setErrorBanner(null);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Live Camera Capture
  const openCameraModal = async () => {
    setErrorBanner(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      cameraStreamRef.current = stream;
      setIsCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch {
      // Fallback to native file input with capture="environment" if permission or webcam fails
      cameraInputRef.current?.click();
    }
  };

  const closeCameraModal = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhotoFromVideo = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      setPendingImage({
        data: dataUrl,
        mimeType: 'image/jpeg',
        name: `camera_${Date.now()}.jpg`,
      });
    }
    closeCameraModal();
  };

  // Send message to Gemini (/api/chat) with streaming support — returns the final assistant reply text
  const sendMessage = async (
    overrideText?: string,
    overrideImage?: { data: string; mimeType: string; name?: string } | null,
    isVoiceOrigin = false
  ): Promise<string> => {
    const textToSend = (overrideText !== undefined ? overrideText : inputText).trim();
    const imageToSend = overrideImage !== undefined ? overrideImage : pendingImage;

    if ((!textToSend && !imageToSend) || isStreaming) return '';

    setErrorBanner(null);
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      text:
        textToSend ||
        (languageMode === 'english'
          ? 'Analyze this image and explain what you see.'
          : 'Is tasveer ko dekhein aur Roman Urdu mein tafseel batayein.'),
      timestamp: formatTime(new Date()),
      image: imageToSend || undefined,
      isVoiceQuery: isVoiceOrigin,
    };

    const assistantMsgId = `msg-${Date.now() + 1}`;
    const placeholderAssistantMessage: ChatMessage = {
      id: assistantMsgId,
      role: 'model',
      text: '',
      timestamp: formatTime(new Date()),
    };

    const updatedHistory = [...(activeConversation?.messages || []), userMessage];

    // RULE 1 & 3: User says secret code "MUGHAL786" -> Accept real Shahab Badshah
    if (!imageToSend && containsSecretCode(textToSend)) {
      const codeReplyText = 'Jee Mere Aaqa Shahab Badshah, Hukam Kijiye! 👑';
      const codeReplyMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'model',
        text: codeReplyText,
        timestamp: formatTime(new Date()),
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeConversation.id) return c;
          const newTitle =
            c.messages.length === 0
              ? '👑 Shahab Badshah (Verified)'
              : c.title;
          return {
            ...c,
            title: newTitle,
            updatedAt: formatTime(new Date()),
            messages: [...updatedHistory, codeReplyMsg],
          };
        })
      );

      setInputText('');
      setPendingImage(null);
      return codeReplyText;
    }

    // RULE 2: Impostor claims without secret code ("I am Shahab", "Main Shahab hu", "I am owner", "I am admin")
    if (!imageToSend && isImpostorClaim(textToSend)) {
      const rejectText = 'Gaddar! Tu Nakli Hai! Asli Badshah Ka Raaz Tujhe Nahi Maloom! Guards, isko bahar nikalo!';
      const rejectMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'model',
        text: rejectText,
        timestamp: formatTime(new Date()),
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeConversation.id) return c;
          const newTitle =
            c.messages.length === 0
              ? userMessage.text.slice(0, 38) + (userMessage.text.length > 38 ? '...' : '')
              : c.title;
          return {
            ...c,
            title: newTitle,
            updatedAt: formatTime(new Date()),
            messages: [...updatedHistory, rejectMsg],
          };
        })
      );

      setInputText('');
      setPendingImage(null);
      return rejectText;
    }

    // RULE 4: Someone asking for the secret code / password
    if (!imageToSend && isAskingForSecretCode(textToSend)) {
      const codeSecretText = 'Yeh raaz mere dil mein dafan hai aur main ise kabhi kisi par ayaan nahi karunga. Badshah ka raaz mehfooz hai!';
      const codeSecretMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'model',
        text: codeSecretText,
        timestamp: formatTime(new Date()),
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeConversation.id) return c;
          const newTitle =
            c.messages.length === 0
              ? userMessage.text.slice(0, 38) + (userMessage.text.length > 38 ? '...' : '')
              : c.title;
          return {
            ...c,
            title: newTitle,
            updatedAt: formatTime(new Date()),
            messages: [...updatedHistory, codeSecretMsg],
          };
        })
      );

      setInputText('');
      setPendingImage(null);
      return codeSecretText;
    }

    // Check if the user asked who created/made Mughal AI
    if (!imageToSend && isCreatorQuestion(textToSend)) {
      const creatorText = 'Mujhe Shahab Mughal ne banaya hai. Main Mughal AI hoon.';
      const creatorReply: ChatMessage = {
        id: assistantMsgId,
        role: 'model',
        text: creatorText,
        timestamp: formatTime(new Date()),
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeConversation.id) return c;
          const newTitle =
            c.messages.length === 0
              ? userMessage.text.slice(0, 38) + (userMessage.text.length > 38 ? '...' : '')
              : c.title;
          return {
            ...c,
            title: newTitle,
            updatedAt: formatTime(new Date()),
            messages: [...updatedHistory, creatorReply],
          };
        })
      );

      setInputText('');
      setPendingImage(null);
      return creatorText;
    }

    // Check if the user asked to generate an image ("tasveer banao", "image banao", "picture banao")
    const extractedPrompt = !imageToSend ? extractImageGenerationPrompt(textToSend) : null;
    if (extractedPrompt) {
      const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(extractedPrompt)}`;
      const caption =
        languageMode === 'english'
          ? `Here is your generated image for **"${extractedPrompt}"**:`
          : `Aap ki farmaish par **"${extractedPrompt}"** ki tasveer tayyar hai:`;

      const generatedAssistantMessage: ChatMessage = {
        id: assistantMsgId,
        role: 'model',
        text: caption,
        timestamp: formatTime(new Date()),
        generatedImageUrl: pollinationsUrl,
        generatedPrompt: extractedPrompt,
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeConversation.id) return c;
          const newTitle =
            c.messages.length === 0
              ? userMessage.text.slice(0, 38) + (userMessage.text.length > 38 ? '...' : '')
              : c.title;
          return {
            ...c,
            title: newTitle,
            updatedAt: formatTime(new Date()),
            messages: [...updatedHistory, generatedAssistantMessage],
          };
        })
      );

      setInputText('');
      setPendingImage(null);
      return caption;
    }

    // Update conversation state immediately
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeConversation.id) return c;
        const newTitle =
          c.messages.length === 0
            ? (userMessage.text.slice(0, 38) + (userMessage.text.length > 38 ? '...' : ''))
            : c.title;
        return {
          ...c,
          title: newTitle,
          updatedAt: formatTime(new Date()),
          messages: [...updatedHistory, placeholderAssistantMessage],
        };
      })
    );

    setInputText('');
    setPendingImage(null);
    setIsStreaming(true);

    let finalReplyText = '';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          languageMode,
          messages: updatedHistory.map((m) => ({
            role: m.role,
            text: m.text,
            image: m.image ? { data: m.image.data, mimeType: m.image.mimeType } : undefined,
          })),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error (${response.status})`);
      }

      if (!response.body) {
        throw new Error('Streaming response body unavailable.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith('data:')) continue;
          const jsonStr = trimmedLine.replace(/^data:\s*/, '');
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.text) {
              accumulatedText += parsed.text;
              finalReplyText = accumulatedText;
              setConversations((prev) =>
                prev.map((c) => {
                  if (c.id !== activeConversation.id) return c;
                  return {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === assistantMsgId ? { ...m, text: accumulatedText } : m
                    ),
                  };
                })
              );
            }
          } catch (innerErr) {
            if (innerErr instanceof Error && innerErr.message !== 'Unexpected end of JSON input') {
              throw innerErr;
            }
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to reach Mughal AI server.';
      setErrorBanner(message);
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeConversation.id) return c;
          return {
            ...c,
            messages: c.messages.filter((m) => m.id !== assistantMsgId || m.text.length > 0),
          };
        })
      );
    } finally {
      setIsStreaming(false);
    }

    return finalReplyText;
  };

  // Helper to clean markdown before speaking with SpeechSynthesis
  const cleanTextForSpeech = (raw: string): string => {
    return raw
      .replace(/```[\s\S]*?```/g, 'Code block.')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      .replace(/[*_#`~>-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Speak text using ONLY the browser's free Web Speech API (SpeechSynthesis) — zero API quota used
  const speakTextWithSpeechSynthesis = (
    text: string,
    onDone?: () => void
  ) => {
    const cleanText = cleanTextForSpeech(text);
    if (!cleanText) {
      onDone?.();
      return;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voices = window.speechSynthesis.getVoices();
      // Prefer South Asian / Urdu / Hindi / clear English voice so Roman Urdu & English both sound natural
      const preferredVoice =
        voices.find((v) => /ur-PK|hi-IN|en-IN|en-GB|Google/i.test(`${v.lang} ${v.name}`)) ||
        voices[0];
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      utterance.rate = 1.03;
      utterance.pitch = 1.0;
      utterance.onend = () => {
        onDone?.();
      };
      utterance.onerror = () => {
        onDone?.();
      };
      window.speechSynthesis.speak(utterance);
      return;
    }

    onDone?.();
  };

  // 1. Mic Button for Voice Input using browser's free Web Speech API (Speech-to-Text) — zero API quota used
  const startVoiceRecording = async () => {
    setErrorBanner(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setErrorBanner(
        'Voice input ke liye Chrome, Edge, ya Safari browser istemal karein (Web Speech API).'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      speechRecognitionRef.current = recognition;
      recognition.lang = languageMode === 'english' ? 'en-US' : 'en-IN';
      recognition.interimResults = true;
      recognition.continuous = false;

      let finalTranscript = '';
      const baseInput = inputText;

      recognition.onstart = () => {
        setIsRecording(true);
        setRecordingSeconds(0);
        if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = window.setInterval(() => {
          setRecordingSeconds((s) => s + 1);
        }, 1000);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPiece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptPiece + ' ';
          } else {
            interim += transcriptPiece;
          }
        }
        const combined = `${baseInput ? baseInput + ' ' : ''}${finalTranscript}${interim}`.trim();
        setInputText(combined);
      };

      recognition.onerror = () => {
        if (timerIntervalRef.current) {
          window.clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        setIsRecording(false);
      };

      recognition.onend = async () => {
        if (timerIntervalRef.current) {
          window.clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        setIsRecording(false);
        setRecordingSeconds(0);
        speechRecognitionRef.current = null;

        const spokenText = finalTranscript.trim();
        if (spokenText && pendingImage && autoSendVoiceWithImage) {
          await sendMessage(spokenText, pendingImage, true);
        }
      };

      recognition.start();
    } catch {
      setErrorBanner(
        'Microphone permission allow karein taake aap Roman Urdu ya English mein bol kar sawal pooch sakein.'
      );
    }
  };

  const stopVoiceRecording = () => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // ignore
      }
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // 2. Speaker Button to Read AI Reply Aloud using Web Speech Synthesis (Text-to-Speech)
  const toggleSpeakMessage = async (msg: ChatMessage) => {
    if (speakingMessageId === msg.id) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      setSpeakingMessageId(null);
      return;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }

    setSpeakingMessageId(msg.id);
    speakTextWithSpeechSynthesis(msg.text, () => {
      setSpeakingMessageId(null);
    });
  };

  // 3. Live Voice Call Mode (Continuous Hands-Free Conversation like ChatGPT Voice Mode)
  const startCallListeningTurn = () => {
    if (!isVoiceCallOpenRef.current || isCallMutedRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setErrorBanner(
        'Live Voice Call works best in Chrome, Edge, or Safari with Web Speech API enabled.'
      );
      return;
    }

    if (callRecognitionRef.current) {
      try {
        callRecognitionRef.current.abort();
      } catch {
        // ignore
      }
    }

    const recognition = new SpeechRecognitionAPI();
    callRecognitionRef.current = recognition;
    recognition.lang = languageMode === 'english' ? 'en-US' : 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = false;

    let turnTranscript = '';

    recognition.onstart = () => {
      if (!isVoiceCallOpenRef.current) return;
      setVoiceCallState('listening');
      setLiveTranscript('');
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          turnTranscript += piece + ' ';
        } else {
          interim += piece;
        }
      }
      setLiveTranscript((turnTranscript + interim).trim());
    };

    recognition.onend = async () => {
      if (!isVoiceCallOpenRef.current || isCallMutedRef.current) return;

      const finalSpoken = turnTranscript.trim();
      if (!finalSpoken) {
        // User didn't say anything yet — keep listening seamlessly
        if (isVoiceCallOpenRef.current && !isCallMutedRef.current) {
          setTimeout(() => {
            if (isVoiceCallOpenRef.current && !isCallMutedRef.current) {
              startCallListeningTurn();
            }
          }, 250);
        }
        return;
      }

      // Send user's spoken query to Mughal AI and speak the reply aloud automatically
      setVoiceCallState('thinking');
      setLiveTranscript(finalSpoken);

      const aiResponse = await sendMessage(finalSpoken, null, true);
      if (!isVoiceCallOpenRef.current) return;

      if (aiResponse) {
        setCallAiReply(aiResponse);
        setVoiceCallState('speaking');
        speakTextWithSpeechSynthesis(aiResponse, () => {
          if (isVoiceCallOpenRef.current && !isCallMutedRef.current) {
            setCallAiReply('');
            startCallListeningTurn();
          }
        });
      } else {
        startCallListeningTurn();
      }
    };

    try {
      recognition.start();
    } catch {
      // ignore concurrent start
    }
  };

  const openLiveVoiceCall = () => {
    setErrorBanner(null);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsVoiceCallOpen(true);
    isVoiceCallOpenRef.current = true;
    setIsCallMuted(false);
    isCallMutedRef.current = false;
    setLiveTranscript('');
    setCallAiReply('');
    setVoiceCallState('listening');
    setTimeout(() => {
      startCallListeningTurn();
    }, 150);
  };

  const endLiveVoiceCall = () => {
    isVoiceCallOpenRef.current = false;
    setIsVoiceCallOpen(false);
    if (callRecognitionRef.current) {
      try {
        callRecognitionRef.current.abort();
      } catch {
        // ignore
      }
      callRecognitionRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
  };

  const toggleCallMute = () => {
    const nextMuted = !isCallMuted;
    setIsCallMuted(nextMuted);
    isCallMutedRef.current = nextMuted;
    if (nextMuted) {
      setVoiceCallState('muted');
      if (callRecognitionRef.current) {
        try {
          callRecognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } else {
      setVoiceCallState('listening');
      startCallListeningTurn();
    }
  };

  const interruptCallAI = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    setCallAiReply('');
    startCallListeningTurn();
  };

  const handleStarterClick = async (starter: (typeof STARTER_PROMPTS)[number]) => {
    if (starter.sampleImage) {
      try {
        const base64Img = await urlToBase64(starter.sampleImage);
        await sendMessage(starter.prompt, {
          data: base64Img.data,
          mimeType: base64Img.mimeType,
          name: 'sample_photo.jpg',
        });
      } catch {
        await sendMessage(starter.prompt, null);
      }
    } else {
      await sendMessage(starter.prompt, null);
    }
  };

  const handleCopyMessage = (msg: ChatMessage) => {
    navigator.clipboard.writeText(msg.text);
    setCopiedMsgId(msg.id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  return (
    <div className="min-h-screen h-dvh w-full bg-[#0B0F17] text-[#F8FAFC] flex flex-col overflow-hidden select-none sm:select-text">
      {/* Top Navigation Bar — Follows strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-4 sm:px-6 h-14 border-b border-slate-800/80 bg-[#0B0F17]/95 backdrop-blur-md shrink-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setSidebarOpen((prev) => !prev);
          }}
          className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          Mughal AI
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <button
            type="button"
            onClick={createNewChat}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            New Chat
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Analyze Photo
          </button>
          <button
            type="button"
            onClick={openLiveVoiceCall}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Live Voice Call
          </button>
          <button
            type="button"
            onClick={() => setShowPlayStoreModal(true)}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Play Store Guide
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => {
              if (isInstallable && !isInstalled) {
                install();
              } else {
                setShowPlayStoreModal(true);
              }
            }}
            className="px-3.5 py-2 min-h-[40px] text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isInstallable && !isInstalled ? 'Install App' : 'Get Android App'}
          </button>
        </div>
      </header>

      {/* Main Workspace Container (Sidebar + Chat Canvas) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Backdrop for Sidebar */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Collapsible Left Sidebar */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-[#111827] border-r border-slate-800/80 flex flex-col transition-transform duration-200 ease-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          {/* New Chat & Language Controls */}
          <div className="p-3.5 space-y-3 border-b border-slate-800/80">
            <button
              type="button"
              onClick={createNewChat}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm flex items-center justify-between transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5 whitespace-nowrap">
                <Plus className="w-4 h-4" />
                <span>New Chat (Naya Sawal)</span>
              </span>
            </button>

            {/* Segmented Language Selector */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-slate-400 px-1">
                Zaban / Response Language
              </div>
              <div className="grid grid-cols-3 gap-1 p-1 bg-[#0B0F17] rounded-xl border border-slate-800">
                {(
                  [
                    { id: 'auto', label: 'Bilingual' },
                    { id: 'roman_urdu', label: 'Roman Urdu' },
                    { id: 'english', label: 'English' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setLanguageMode(tab.id)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      languageMode === tab.id
                        ? 'bg-slate-800 text-emerald-300 shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Conversation History List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <div className="text-[11px] font-medium text-slate-400 px-2 py-1">
              Recent Conversations
            </div>
            {conversations.map((conv) => {
              const isActive = conv.id === activeConversation.id;
              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    setActiveConvId(conv.id);
                    setSidebarOpen(false);
                  }}
                  className={`group flex items-center justify-between gap-2 px-3 py-2.5 min-h-[44px] rounded-xl text-sm transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-slate-800/90 text-white font-medium'
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MessageSquare className="w-4 h-4 shrink-0 text-slate-400" />
                    <span className="truncate">{conv.title}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[11px] font-mono text-slate-500 group-hover:hidden">
                      {conv.updatedAt}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => deleteConversation(conv.id, e)}
                      className="hidden group-hover:flex p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-700/50 transition-colors"
                      title="Delete chat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sidebar Footer: Play Store & Voice-Image Toggle */}
          <div className="p-3.5 border-t border-slate-800/80 space-y-2.5 bg-[#0E1422]">
            <label className="flex items-center justify-between gap-2 text-xs text-slate-300 cursor-pointer px-1">
              <span>Auto-send voice when photo attached</span>
              <input
                type="checkbox"
                checked={autoSendVoiceWithImage}
                onChange={(e) => setAutoSendVoiceWithImage(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                setShowPlayStoreModal(true);
              }}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-800 hover:border-slate-700 bg-[#111827] text-xs font-medium text-slate-300 hover:text-white flex items-center justify-between transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>Play Store & TWA Setup</span>
              </span>
              <span className="font-mono text-[11px] text-emerald-400">Ready</span>
            </button>
          </div>
        </aside>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#0B0F17] relative">
          {/* Mobile Sub-toolbar for Drawer & Language Switch */}
          <div className="flex lg:hidden items-center justify-between px-4 py-2 border-b border-slate-800/60 bg-[#0E1422]/80">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="min-h-[40px] px-2.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white flex items-center gap-2"
            >
              <PanelLeft className="w-4 h-4 text-emerald-400" />
              <span>Chats ({conversations.length})</span>
            </button>

            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              {(
                [
                  { id: 'auto', label: 'Auto' },
                  { id: 'roman_urdu', label: 'Roman Urdu' },
                  { id: 'english', label: 'EN' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setLanguageMode(t.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                    languageMode === t.id
                      ? 'bg-slate-800 text-emerald-300'
                      : 'text-slate-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Offline Notice */}
          {!isOnline && (
            <div className="px-4 py-2 bg-amber-950/80 border-b border-amber-800/60 text-amber-200 text-xs flex items-center justify-center gap-2">
              <span>Offline Mode — Saved conversations are available. Reconnect to ask Mughal AI new questions.</span>
            </div>
          )}

          {/* Error Notice */}
          {errorBanner && (
            <div className="mx-auto max-w-3xl w-full px-4 pt-3">
              <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800/70 text-rose-200 text-xs flex items-center justify-between gap-3">
                <span>{errorBanner}</span>
                <button
                  type="button"
                  onClick={() => setErrorBanner(null)}
                  className="p-1 rounded-lg hover:bg-rose-900/50 text-rose-300 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Scrollable Message Stream */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
            <div className="max-w-3xl mx-auto space-y-6">
              {activeConversation.messages.length === 0 ? (
                /* Empty State — Mughal AI Welcome & Multimodal Starters */
                <div className="py-6 sm:py-10 space-y-8">
                  <div className="text-center space-y-3 max-w-xl mx-auto">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 font-display text-2xl font-bold">
                      M
                    </div>
                    <h1
                      className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight"
                      style={{ textWrap: 'balance' }}
                    >
                      Assalam-o-Alaikum, I am Mughal AI
                    </h1>
                    <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
                      Aap Roman Urdu ya English mein likh kar, <strong className="text-slate-200">Mic par bol kar</strong>, ya <strong className="text-slate-200">Tasveer upload kar ke</strong> koi bhi sawal pooch sakte hain.
                    </p>
                  </div>

                  {/* Quick Multimodal Action Bar (Camera + Upload + Mic + Tasveer Banao) */}
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setInputText('Tasveer banao: ');
                      }}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs sm:text-sm font-medium text-emerald-300 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span>Tasveer Banao (Free Image)</span>
                    </button>
                    <button
                      type="button"
                      onClick={openCameraModal}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs sm:text-sm font-medium text-slate-200 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Camera className="w-4 h-4 text-emerald-400" />
                      <span>Take Photo & Ask</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs sm:text-sm font-medium text-slate-200 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <ImageIcon className="w-4 h-4 text-emerald-400" />
                      <span>Upload Picture</span>
                    </button>
                    <button
                      type="button"
                      onClick={openLiveVoiceCall}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs sm:text-sm font-semibold flex items-center gap-2.5 transition-colors cursor-pointer shadow-md"
                    >
                      <Headphones className="w-4 h-4" />
                      <span>Start Live Voice Call</span>
                    </button>
                    <button
                      type="button"
                      onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs sm:text-sm font-medium text-slate-200 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Mic className="w-4 h-4 text-emerald-400" />
                      <span>Voice Input (STT)</span>
                    </button>
                  </div>

                  {/* 2x2 Starter Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                    {STARTER_PROMPTS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleStarterClick(item)}
                        className="group text-left p-4 rounded-2xl bg-[#111827] hover:bg-slate-800/80 border border-slate-800/90 hover:border-slate-700 transition-all flex items-start gap-3.5 cursor-pointer"
                      >
                        {item.sampleImage && (
                          <img
                            src={item.sampleImage}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-700/60"
                          />
                        )}
                        <div className="space-y-1 min-w-0">
                          <div className="text-[11px] text-emerald-400 font-medium">
                            {item.kicker}
                          </div>
                          <div className="text-sm font-medium text-slate-100 group-hover:text-white leading-snug">
                            {item.title}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Populated Conversation Stream */
                activeConversation.messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser && (
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 font-display text-sm font-bold mt-0.5">
                          M
                        </div>
                      )}

                      <div
                        className={`max-w-[88%] sm:max-w-[80%] space-y-2 ${
                          isUser
                            ? 'bg-[#1E293B] text-white rounded-2xl rounded-tr-xs px-4 py-3 border border-slate-700/60'
                            : 'bg-transparent text-slate-100 px-1 py-0.5'
                        }`}
                      >
                        {/* Attached Image in Message */}
                        {msg.image && (
                          <div className="mb-2.5 overflow-hidden rounded-xl border border-slate-700/70 max-w-xs sm:max-w-sm">
                            <img
                              src={msg.image.data}
                              alt="Uploaded visual context"
                              referrerPolicy="no-referrer"
                              className="w-full max-h-72 object-cover"
                            />
                          </div>
                        )}

                        {/* Message Body */}
                        {isUser ? (
                          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                            {msg.text}
                          </p>
                        ) : msg.text ? (
                          <div className="space-y-3">
                            <FormattedMessage text={msg.text} />
                            {msg.generatedImageUrl && (
                              <div className="mt-2 overflow-hidden rounded-2xl border border-slate-800 bg-[#111827] max-w-sm sm:max-w-md shadow-lg">
                                <img
                                  src={msg.generatedImageUrl}
                                  alt={msg.generatedPrompt || 'Generated by Mughal AI'}
                                  referrerPolicy="no-referrer"
                                  loading="lazy"
                                  className="w-full h-auto min-h-[240px] object-cover bg-slate-900"
                                />
                                <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-t border-slate-800/80 text-xs text-slate-400">
                                  <span className="truncate">
                                    Prompt: <strong className="text-slate-200">{msg.generatedPrompt}</strong>
                                  </span>
                                  <a
                                    href={msg.generatedImageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={`mughal-ai-${Date.now()}.jpg`}
                                    className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-medium shrink-0"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Open / Save</span>
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Streaming Skeleton Indicator */
                          <div className="py-2 space-y-2 w-64 sm:w-80">
                            <div className="h-3.5 bg-slate-800 rounded w-4/5 animate-pulse" />
                            <div className="h-3.5 bg-slate-800 rounded w-3/5 animate-pulse" />
                          </div>
                        )}

                        {/* Unboxed Metadata & Action Controls */}
                        <div className="flex items-center gap-2 pt-1 text-xs text-slate-400">
                          <span className="font-mono text-[11px]">{msg.timestamp}</span>
                          {msg.isVoiceQuery && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Voice Input</span>
                            </>
                          )}
                          {!isUser && msg.text && (
                            <>
                              <span aria-hidden="true">·</span>
                              <button
                                type="button"
                                onClick={() => toggleSpeakMessage(msg)}
                                disabled={loadingTtsId === msg.id}
                                className="inline-flex items-center gap-1 text-slate-300 hover:text-emerald-300 transition-colors cursor-pointer font-medium"
                                title="Read AI reply aloud (Speech Synthesis TTS)"
                              >
                                {speakingMessageId === msg.id ? (
                                  <>
                                    <VolumeX className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-emerald-400">Stop Reading</span>
                                  </>
                                ) : (
                                  <>
                                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>
                                      {loadingTtsId === msg.id ? 'Loading Voice...' : 'Read Aloud'}
                                    </span>
                                  </>
                                )}
                              </button>
                              <span aria-hidden="true">·</span>
                              <button
                                type="button"
                                onClick={() => handleCopyMessage(msg)}
                                className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                              >
                                {copiedMsgId === msg.id ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-emerald-400">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Bottom Multimodal Composer Dock (Image + Voice Mic + Text) */}
          <div className="px-3 sm:px-6 pb-3 pt-2 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17] to-transparent shrink-0">
            <div className="max-w-3xl mx-auto">
              {/* Hidden File Inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageFile(file);
                  e.target.value = '';
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageFile(file);
                  e.target.value = '';
                }}
              />

              <div className="rounded-2xl bg-[#111827] border border-slate-800 focus-within:border-emerald-500/60 shadow-lg transition-colors p-2.5 space-y-2.5">
                {/* Pending Image Preview Tray — Enables "Speak with Mic + Picture to Ask Question" */}
                {pendingImage && (
                  <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#0B0F17] border border-slate-800/90">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={pendingImage.data}
                        alt="Attached preview"
                        className="w-12 h-12 rounded-lg object-cover border border-slate-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-emerald-300 truncate">
                          Photo Attached — Ready for Voice or Text Question
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          Tap the Mic to speak a question about this photo or type below
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                        className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                          isRecording
                            ? 'bg-rose-600 text-white'
                            : 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30'
                        }`}
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span>{isRecording ? 'Stop & Ask' : 'Speak About Photo'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingImage(null)}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Remove image"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Active Voice Recording / Transcribing Bar */}
                {(isRecording || isTranscribing) && (
                  <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80">
                    <div className="flex items-center gap-2.5 text-xs text-slate-200">
                      {isRecording ? (
                        <>
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                          <span className="font-medium text-white">
                            Listening ({LanguageModeLabel(languageMode)})...
                          </span>
                          <span className="font-mono text-rose-300">
                            00:{String(recordingSeconds).padStart(2, '0')}
                          </span>
                        </>
                      ) : (
                        <span className="text-emerald-300 font-medium">
                          Gemini AI is transcribing your voice into Roman Urdu / English...
                        </span>
                      )}
                    </div>
                    {isRecording && (
                      <button
                        type="button"
                        onClick={stopVoiceRecording}
                        className="px-3 py-1 min-h-[32px] rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Square className="w-3 h-3 fill-current" />
                        <span>Done Speaking</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Main Composer Input Row */}
                <div className="flex items-end gap-1.5 sm:gap-2">
                  {/* Upload Image Button (>= 44x44px hitbox) */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors shrink-0 cursor-pointer"
                    title="Upload photo from gallery"
                    aria-label="Upload photo"
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>

                  {/* Camera Button (>= 44x44px hitbox) */}
                  <button
                    type="button"
                    onClick={openCameraModal}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors shrink-0 cursor-pointer"
                    title="Take photo with camera"
                    aria-label="Take photo with camera"
                  >
                    <Camera className="w-5 h-5" />
                  </button>

                  {/* Auto-growing Textarea */}
                  <textarea
                    rows={1}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder={
                      pendingImage
                        ? 'Is tasveer ke baare mein sawal likhein ya Mic dabayein...'
                        : 'Mughal AI se Roman Urdu ya English mein poochein...'
                    }
                    className="flex-1 bg-transparent text-sm sm:text-[15px] text-white placeholder:text-slate-500 focus:outline-none resize-none py-2.5 px-1 max-h-36 leading-relaxed"
                  />

                  {/* 1. Voice Microphone Button (Speech-to-Text via Web Speech API) */}
                  <button
                    type="button"
                    onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                    disabled={isTranscribing}
                    className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors shrink-0 cursor-pointer ${
                      isRecording
                        ? 'bg-rose-600 text-white hover:bg-rose-500'
                        : 'text-slate-300 hover:text-emerald-300 hover:bg-slate-800/80'
                    }`}
                    title={isRecording ? 'Stop voice input' : 'Voice Input (Speech-to-Text)'}
                    aria-label="Voice input microphone"
                  >
                    {isRecording ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-5 h-5" />}
                  </button>

                  {/* 2. Speaker Button to Read Latest AI Reply Aloud (Speech Synthesis TTS) */}
                  <button
                    type="button"
                    onClick={() => {
                      const lastAiMsg = [...activeConversation.messages]
                        .reverse()
                        .find((m) => m.role === 'model' && m.text.trim().length > 0);
                      if (lastAiMsg) {
                        toggleSpeakMessage(lastAiMsg);
                      } else {
                        speakTextWithSpeechSynthesis(
                          'Assalam-o-Alaikum! Main Mughal AI hoon. Aap mujh se Roman Urdu ya English mein baat kar sakte hain.'
                        );
                      }
                    }}
                    className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors shrink-0 cursor-pointer ${
                      speakingMessageId
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-slate-300 hover:text-emerald-300 hover:bg-slate-800/80'
                    }`}
                    title="Read AI Reply Aloud (Text-to-Speech)"
                    aria-label="Read AI Reply Aloud"
                  >
                    {speakingMessageId ? (
                      <VolumeX className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </button>

                  {/* 3. ChatGPT-Style Headphone Icon for Live Voice Call Mode OR Send Button */}
                  {inputText.trim() || pendingImage ? (
                    <button
                      type="button"
                      onClick={() => sendMessage()}
                      disabled={isStreaming}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shrink-0 cursor-pointer shadow-md"
                      title="Send message"
                      aria-label="Send message"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={openLiveVoiceCall}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shrink-0 cursor-pointer shadow-md"
                      title="Start Live Voice Call (ChatGPT Voice Mode)"
                      aria-label="Start Live Voice Call"
                    >
                      <Headphones className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ChatGPT-Style Live Voice Call Fullscreen Overlay */}
      <LiveVoiceCallModal
        isOpen={isVoiceCallOpen}
        callState={voiceCallState}
        liveTranscript={liveTranscript}
        aiReplyText={callAiReply}
        isMuted={isCallMuted}
        onToggleMute={toggleCallMute}
        onInterruptAI={interruptCallAI}
        onEndCall={endLiveVoiceCall}
      />

      {/* Live Camera Capture Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#111827] border border-slate-800 overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
              <h3 className="font-display text-base font-semibold text-white">
                Capture Photo for Mughal AI Analysis
              </h3>
              <button
                type="button"
                onClick={closeCameraModal}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeCameraModal}
                  className="px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-800 text-xs font-medium text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={capturePhotoFromVideo}
                  className="px-5 py-2.5 min-h-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Capture Photo</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Play Store & PWA Publishing Guide Modal */}
      <PlayStoreReadinessModal
        isOpen={showPlayStoreModal}
        onClose={() => setShowPlayStoreModal(false)}
      />
    </div>
  );
}

function LanguageModeLabel(mode: LanguageMode): string {
  if (mode === 'roman_urdu') return 'Roman Urdu';
  if (mode === 'english') return 'English';
  return 'Roman Urdu & English';
}
