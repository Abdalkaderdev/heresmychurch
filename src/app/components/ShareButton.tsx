import { Share2, Copy, Check, MessageCircle, Twitter } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Church } from "./church-data";

interface ShareButtonProps {
  church: Church;
  className?: string;
}

export function ShareButton({ church, className = "" }: ShareButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const shareUrl = `https://heresmychurch.abdalkader.dev/country/${church.state}/${church.shortId || church.id}`;
  const shareTitle = church.name;
  const shareText = `Check out ${church.name} on Here's My Church`;

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

  const handleShare = async () => {
    // Try native Web Share API first (mobile browsers)
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err) {
        // User cancelled or share failed, fall through to menu
        if ((err as Error).name === "AbortError") return;
      }
    }
    // Show fallback menu
    setShowMenu(true);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setShowMenu(false);
      }, 1500);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setShowMenu(false);
      }, 1500);
    }
  };

  const socialLinks = [
    {
      name: "WhatsApp",
      icon: MessageCircle,
      url: `https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`,
      color: "bg-green-600/20 text-green-400 hover:bg-green-600/30",
    },
    {
      name: "Twitter",
      icon: Twitter,
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      color: "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30",
    },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={handleShare}
        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium text-white/70 bg-white/8 hover:bg-white/12 transition-colors ${className}`}
        style={{ boxShadow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.2), inset 0 -1px 0 0 rgba(0, 0, 0, 0.1)" }}
        title="Share this church"
      >
        <Share2 size={14} />
        Share
      </button>

      {/* Fallback share menu */}
      {showMenu && (
        <div className="absolute bottom-full left-0 mb-2 w-48 rounded-xl shadow-xl overflow-hidden z-50"
          style={{ backgroundColor: "rgba(30, 16, 64, 0.98)" }}
        >
          <div className="p-2 space-y-1">
            {/* Copy link */}
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left hover:bg-white/10 transition-colors"
            >
              {copied ? (
                <Check size={16} className="text-green-400 flex-shrink-0" />
              ) : (
                <Copy size={16} className="text-white/60 flex-shrink-0" />
              )}
              <span className="text-sm text-white/80">
                {copied ? "Link copied!" : "Copy link"}
              </span>
            </button>

            {/* Divider */}
            <div className="h-px bg-white/10 mx-2" />

            {/* Social share links */}
            {socialLinks.map((link) => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowMenu(false)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors ${link.color}`}
              >
                <link.icon size={16} className="flex-shrink-0" />
                <span className="text-sm">{link.name}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
